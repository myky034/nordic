BEGIN;

-- Slice 6a — immigration rules (decisions confirmed by the project owner,
-- 2026-09-23; PROJECT_SPEC.md Section 21):
--
-- 1. Same shape as Slice 5 ("Option A"): immigration_rules hold IDENTITY only
--    (country, rule type, official title, official page, evidence of
--    existence). Requirements — financial thresholds, permit length,
--    processing time — are facts linked by facts.immigration_rule_id, so they
--    reuse evidence/review/conflict/history. No free-text "summary" column:
--    an unsourced paraphrase of immigration law is exactly what AGENTS.md
--    Section 1.5 forbids.
-- 2. The document proving a rule exists MUST come from a T1 source registered
--    for the same country, and the rule's official page must be on that
--    source's origin. Facts attached to a rule may come from any tier; the UI
--    labels non-T1 evidence.
-- 3. Public visibility additionally requires the evidence source to be
--    registry-'verified' (and, for rules, still T1). This is evaluated on every
--    read, so un-verifying or downgrading a source hides its immigration
--    content immediately instead of leaving stale claims public.
-- 4. The legal disclaimer is a UI concern (see app/(public)/(explore)/immigration).

INSERT INTO public.permissions(key,description) VALUES
 ('immigration.manage','Propose immigration rules backed by a T1 document');
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,'immigration.manage' FROM public.roles r
WHERE EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

CREATE TABLE public.immigration_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
 rule_type text NOT NULL CHECK(rule_type IN ('student_residence_permit','work_permit','post_study','permanent_residence','citizenship','other')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 300),
 official_url text NOT NULL CHECK(length(official_url)<=2048 AND official_url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$'),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL CHECK(length(btrim(evidence_excerpt)) BETWEEN 1 AND 500),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX immigration_rules_active_title_key ON public.immigration_rules(country_id, rule_type, lower(title)) WHERE status <> 'rejected';
CREATE INDEX immigration_rules_status_country_id_idx ON public.immigration_rules(status, country_id);

CREATE TABLE public.immigration_rule_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 immigration_rule_id uuid NOT NULL REFERENCES public.immigration_rules(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('reviewed','rejected')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX immigration_rule_reviews_rule_idx ON public.immigration_rule_reviews(immigration_rule_id);

-- A fact describes at most one entity (programme, university or rule).
ALTER TABLE public.facts
 ADD COLUMN immigration_rule_id uuid REFERENCES public.immigration_rules(id) ON DELETE RESTRICT,
 DROP CONSTRAINT facts_single_education_entity,
 ADD CONSTRAINT facts_single_entity CHECK(num_nonnulls(university_id, programme_id, immigration_rule_id) <= 1);
CREATE INDEX facts_immigration_rule_id_idx ON public.facts(immigration_rule_id);

-- "Is this document's source verified (and optionally T1)?" is written out in
-- each policy rather than relying on nested RLS: editors can see every row, so
-- an EXISTS against an RLS-protected table would be looser for them.
ALTER TABLE public.immigration_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.immigration_rule_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.immigration_rules,public.immigration_rule_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.immigration_rules TO anon,authenticated;
GRANT SELECT ON public.immigration_rule_reviews TO authenticated;
CREATE POLICY immigration_rules_public ON public.immigration_rules FOR SELECT TO anon,authenticated
 USING(status='reviewed' AND EXISTS(SELECT 1 FROM public.documents d JOIN public.sources s ON s.id=d.source_id
   WHERE d.id=document_id AND s.status='verified' AND s.source_tier='T1'));
CREATE POLICY immigration_rules_editors ON public.immigration_rules FOR SELECT TO authenticated
 USING(public.has_permission('immigration.manage') OR public.has_permission('facts.review') OR public.has_permission('facts.propose'));
CREATE POLICY immigration_rule_reviews_editors ON public.immigration_rule_reviews FOR SELECT TO authenticated
 USING(public.has_permission('immigration.manage') OR public.has_permission('facts.review'));

-- Facts: unchanged for non-immigration facts. A fact linked to a rule is public
-- only while the rule is public AND the fact's own evidence source is verified
-- (any tier; non-T1 is labelled in the UI).
DROP POLICY facts_public ON public.facts;
CREATE POLICY facts_public ON public.facts FOR SELECT TO anon,authenticated
 USING(status IN ('reviewed','conflicted') AND (
   immigration_rule_id IS NULL OR (
     EXISTS(SELECT 1 FROM public.immigration_rules r JOIN public.documents d ON d.id=r.document_id JOIN public.sources s ON s.id=d.source_id
       WHERE r.id=immigration_rule_id AND r.status='reviewed' AND s.status='verified' AND s.source_tier='T1')
     AND EXISTS(SELECT 1 FROM public.documents d JOIN public.sources s ON s.id=d.source_id
       WHERE d.id=document_id AND s.status='verified'))));

-- Origin ("scheme://host[:port]") comparison, lower-cased, for the
-- "official page must be on the authority's site" rule.
CREATE FUNCTION public.url_origin(p_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT substring(lower(p_url) from '^(https?://[^/?#]+)')
$$;

CREATE FUNCTION public.propose_immigration_rule(p_country uuid,p_rule_type text,p_title text,p_official_url text,p_document uuid,p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; v_tier text; v_source_country uuid; v_source_url text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('immigration.manage') THEN RAISE EXCEPTION 'immigration_forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.countries WHERE id=p_country) THEN RAISE EXCEPTION 'immigration_invalid'; END IF;
 IF p_title IS NULL OR p_excerpt IS NULL OR p_official_url IS NULL OR p_rule_type IS NULL THEN RAISE EXCEPTION 'immigration_invalid'; END IF;
 SELECT s.source_tier,s.country_id,s.canonical_url INTO v_tier,v_source_country,v_source_url
 FROM public.documents d JOIN public.sources s ON s.id=d.source_id WHERE d.id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'immigration_document_missing'; END IF;
 IF v_tier IS DISTINCT FROM 'T1' THEN RAISE EXCEPTION 'immigration_requires_t1'; END IF;
 -- A Swedish authority cannot prove a Danish rule; an unassigned source proves neither.
 IF v_source_country IS DISTINCT FROM p_country THEN RAISE EXCEPTION 'immigration_source_country_mismatch'; END IF;
 IF public.url_origin(p_official_url) IS DISTINCT FROM public.url_origin(v_source_url) THEN RAISE EXCEPTION 'immigration_url_not_authority'; END IF;
 BEGIN
   INSERT INTO public.immigration_rules(country_id,rule_type,title,official_url,document_id,evidence_excerpt,created_by)
   VALUES(p_country,p_rule_type,btrim(p_title),p_official_url,p_document,btrim(p_excerpt),auth.uid()) RETURNING id INTO result;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'immigration_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'immigration_invalid';
 END;
 RETURN result;
END $$;

CREATE FUNCTION public.review_immigration_rule(p_id uuid,p_decision text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_tier text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'immigration_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_decision IS NULL OR p_decision NOT IN ('reviewed','rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'immigration_invalid';
 END IF;
 SELECT r.status,s.source_tier INTO v_status,v_tier FROM public.immigration_rules r
 JOIN public.documents d ON d.id=r.document_id JOIN public.sources s ON s.id=d.source_id WHERE r.id=p_id FOR UPDATE OF r;
 IF v_status IS NULL THEN RAISE EXCEPTION 'immigration_missing'; END IF;
 IF v_status<>'proposed' THEN RAISE EXCEPTION 'immigration_already_decided'; END IF;
 -- The source's tier may have been changed since the proposal.
 IF p_decision='reviewed' AND v_tier IS DISTINCT FROM 'T1' THEN RAISE EXCEPTION 'immigration_requires_t1'; END IF;
 UPDATE public.immigration_rules SET status=p_decision,reviewed_at=CASE WHEN p_decision='reviewed' THEN now() END WHERE id=p_id;
 INSERT INTO public.immigration_rule_reviews(immigration_rule_id,actor_id,decision,note) VALUES(p_id,auth.uid(),p_decision,btrim(p_note));
END $$;

-- propose_fact gains p_immigration_rule (trailing, DEFAULT NULL); earlier
-- 10- and 13-argument callers keep working. Dropped and recreated so only one
-- version exists.
DROP FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text);
CREATE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,
 p_country uuid,p_from date,p_until date,p_excerpt text,
 p_university uuid DEFAULT NULL,p_programme uuid DEFAULT NULL,p_deadline_type text DEFAULT NULL,p_immigration_rule uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents; v_entity_country uuid; v_country uuid := p_country;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_document_missing'; END IF;
 IF num_nonnulls(p_university,p_programme,p_immigration_rule) > 1 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_deadline_type IS NOT NULL AND p_deadline_type NOT IN ('fixed','rolling','year_round') THEN RAISE EXCEPTION 'facts_invalid'; END IF;
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
 END IF;
 IF v_entity_country IS NOT NULL THEN
   IF v_country IS NULL THEN v_country := v_entity_country;
   ELSIF v_country<>v_entity_country THEN RAISE EXCEPTION 'facts_country_mismatch'; END IF;
 END IF;
 INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,university_id,programme_id,deadline_type,immigration_rule_id)
 VALUES(p_document,btrim(p_topic),btrim(p_subject),btrim(p_predicate),btrim(p_value),nullif(btrim(p_unit),''),v_country,p_from,p_until,auth.uid(),
   p_university,p_programme,p_deadline_type,p_immigration_rule) RETURNING id INTO result;
 -- Evidence URL/date come from the immutable document, never from a submitted URL.
 INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at)
 VALUES(result,d.id,d.canonical_url,btrim(p_excerpt),d.retrieved_at);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.propose_immigration_rule(uuid,text,text,text,uuid,text),
 public.review_immigration_rule(uuid,text,text),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.propose_immigration_rule(uuid,text,text,text,uuid,text),
 public.review_immigration_rule(uuid,text,text),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
