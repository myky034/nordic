BEGIN;

-- Slice 7b — country comparison (decisions confirmed 2026-09-26, Section 21).
--
-- Facts are free-form (topic/subject/predicate), so two "cost of living"
-- facts for two countries share no key a table could align on. A small,
-- admin-curated vocabulary of comparison metrics provides that key:
-- facts.metric_id says "this claim is a value of metric X for country Y".
--
-- * Metrics are DEFINITIONS only (what is measured, suggested unit). No
--   metric and no value is seeded; operators create them (metrics.manage).
-- * A metric's key and category are immutable once created: facts already
--   attached must not silently change meaning. Label/description/unit hint
--   may be clarified; every save is audited in access_audit.
-- * A metric-linked fact must have a country (the comparison column).
-- * The comparison page shows every public value per cell with its source,
--   tier, period and dates. It never aggregates, averages or scores
--   (AGENTS.md Sections 1.4, 11, 15).

INSERT INTO public.permissions(key,description) VALUES
 ('metrics.manage','Create and edit comparison metric definitions');
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,'metrics.manage' FROM public.roles r
WHERE EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

CREATE TABLE public.comparison_metrics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 key text NOT NULL UNIQUE CHECK(key ~ '^[a-z][a-z0-9_]{1,59}$'),
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 200),
 description text NOT NULL CHECK(length(btrim(description)) BETWEEN 1 AND 1000),
 unit_hint text CHECK(unit_hint IS NULL OR length(btrim(unit_hint)) BETWEEN 1 AND 50),
 category text NOT NULL CHECK(category IN ('education','tuition','living_cost','labour_market','immigration','housing','language','quality_of_life','other')),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comparison_metrics_category_idx ON public.comparison_metrics(category, label);

ALTER TABLE public.facts
 ADD COLUMN metric_id uuid REFERENCES public.comparison_metrics(id) ON DELETE RESTRICT,
 ADD CONSTRAINT facts_metric_country CHECK(metric_id IS NULL OR country_id IS NOT NULL);
CREATE INDEX facts_metric_country_idx ON public.facts(metric_id, country_id);

-- Definitions are public vocabulary (they carry no claims); writes via RPC only.
ALTER TABLE public.comparison_metrics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comparison_metrics FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.comparison_metrics TO anon,authenticated;
CREATE POLICY comparison_metrics_read ON public.comparison_metrics FOR SELECT TO anon,authenticated USING(true);

CREATE FUNCTION public.save_metric(p_id uuid,p_key text,p_label text,p_description text,p_unit text,p_category text,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_prev public.comparison_metrics;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('metrics.manage') THEN RAISE EXCEPTION 'metrics_forbidden'; END IF;
 IF p_active IS NULL THEN RAISE EXCEPTION 'metrics_invalid'; END IF;
 BEGIN
   IF p_id IS NULL THEN
     INSERT INTO public.comparison_metrics(key,label,description,unit_hint,category,active,created_by)
     VALUES(p_key,btrim(p_label),btrim(p_description),nullif(btrim(p_unit),''),p_category,p_active,auth.uid()) RETURNING id INTO v_id;
   ELSE
     SELECT * INTO v_prev FROM public.comparison_metrics WHERE id=p_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'metrics_not_found'; END IF;
     -- Facts attached to this metric must keep their meaning.
     IF p_key IS DISTINCT FROM v_prev.key OR p_category IS DISTINCT FROM v_prev.category THEN RAISE EXCEPTION 'metrics_immutable'; END IF;
     UPDATE public.comparison_metrics SET label=btrim(p_label),description=btrim(p_description),unit_hint=nullif(btrim(p_unit),''),
       active=p_active,updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
   END IF;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'metrics_duplicate';
   WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'metrics_invalid';
 END;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'metric.saved',v_id,
   jsonb_build_object('before',to_jsonb(v_prev),'after',jsonb_build_object('key',p_key,'label',btrim(p_label),'description',btrim(p_description),'unit_hint',p_unit,'category',p_category,'active',p_active)));
 RETURN v_id;
END $$;

-- propose_fact gains p_metric (trailing, DEFAULT NULL); earlier callers keep
-- working. Dropped and recreated so only one version exists.
DROP FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text);
CREATE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,
 p_country uuid,p_from date,p_until date,p_excerpt text,
 p_university uuid DEFAULT NULL,p_programme uuid DEFAULT NULL,p_deadline_type text DEFAULT NULL,p_immigration_rule uuid DEFAULT NULL,
 p_occupation uuid DEFAULT NULL,p_reference_period text DEFAULT NULL,p_metric uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents; v_entity_country uuid; v_country uuid := p_country;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_document_missing'; END IF;
 IF num_nonnulls(p_university,p_programme,p_immigration_rule,p_occupation) > 1 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_deadline_type IS NOT NULL AND p_deadline_type NOT IN ('fixed','rolling','year_round') THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_reference_period IS NOT NULL AND p_reference_period !~ '^[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?$' THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 -- Retired metrics keep their history but accept no new values.
 IF p_metric IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.comparison_metrics WHERE id=p_metric AND active) THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_programme IS NOT NULL THEN
   SELECT u.country_id INTO v_entity_country FROM public.programmes p JOIN public.universities u ON u.id=p.university_id
   WHERE p.id=p_programme AND p.status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_university IS NOT NULL THEN
   SELECT country_id INTO v_entity_country FROM public.universities WHERE id=p_university AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_immigration_rule IS NOT NULL THEN
   SELECT country_id INTO v_entity_country FROM public.immigration_rules WHERE id=p_immigration_rule AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_occupation IS NOT NULL THEN
   SELECT country_id INTO v_entity_country FROM public.occupations WHERE id=p_occupation AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 END IF;
 IF v_entity_country IS NOT NULL THEN
   IF v_country IS NULL THEN v_country := v_entity_country;
   ELSIF v_country<>v_entity_country THEN RAISE EXCEPTION 'facts_country_mismatch'; END IF;
 END IF;
 IF (p_occupation IS NOT NULL OR p_metric IS NOT NULL) AND v_country IS NULL THEN RAISE EXCEPTION 'facts_country_required'; END IF;
 INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,
   university_id,programme_id,deadline_type,immigration_rule_id,occupation_id,reference_period,metric_id)
 VALUES(p_document,btrim(p_topic),btrim(p_subject),btrim(p_predicate),btrim(p_value),nullif(btrim(p_unit),''),v_country,p_from,p_until,auth.uid(),
   p_university,p_programme,p_deadline_type,p_immigration_rule,p_occupation,p_reference_period,p_metric) RETURNING id INTO result;
 -- Evidence URL/date come from the immutable document, never from a submitted URL.
 INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at)
 VALUES(result,d.id,d.canonical_url,btrim(p_excerpt),d.retrieved_at);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.save_metric(uuid,text,text,text,text,text,boolean),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_metric(uuid,text,text,text,text,text,boolean),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text,uuid)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
