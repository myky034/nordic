BEGIN;

-- L3a — fact types with Vietnamese/English labels and structured values
-- (plan: docs/architecture/fact-types-plan.md; Decision Log 2026-10-13).
--
-- * Comparison metrics (Slice 7) become the single vocabulary of FACT TYPES:
--   comparison_metrics → fact_types, facts.metric_id → fact_type_id. A
--   comparison metric is now a fact type with comparable = true. One
--   vocabulary, not two lists for the same idea (AGENTS.md §4).
-- * Each type has a Vietnamese and an English label and definition, a value
--   kind (money / number / date / text) and the entity it applies to. key,
--   value_kind, applies_to and category are fixed once created: facts typed
--   with them must not change meaning.
-- * A typed fact carries structured values next to the verbatim `value`,
--   which stays required and untranslated. For money/number the number must
--   appear in the excerpt, for dates the year (D3) — the same rule the AI
--   extraction applies. Nothing is converted between units or currencies.
-- * No fact type is created here; administrators create them (D5).

-- The table had no rows when this was planned (2026-10-13); the new NOT NULL
-- columns have no default on purpose, so refuse to run on data rather than
-- invent labels for it.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.comparison_metrics) THEN RAISE EXCEPTION 'fact_types_migration_needs_empty_metrics'; END IF;
END $$;

ALTER TABLE public.comparison_metrics RENAME TO fact_types;
ALTER TABLE public.fact_types RENAME CONSTRAINT comparison_metrics_pkey TO fact_types_pkey;
ALTER TABLE public.fact_types RENAME CONSTRAINT comparison_metrics_key_key TO fact_types_key_key;
ALTER INDEX public.comparison_metrics_category_idx RENAME TO fact_types_category_idx;
ALTER POLICY comparison_metrics_read ON public.fact_types RENAME TO fact_types_read;
ALTER TABLE public.fact_types RENAME COLUMN label TO label_vi;
ALTER TABLE public.fact_types RENAME COLUMN description TO definition_vi;
ALTER TABLE public.fact_types
 ADD COLUMN label_en text NOT NULL CHECK(length(btrim(label_en)) BETWEEN 1 AND 200),
 ADD COLUMN definition_en text NOT NULL CHECK(length(btrim(definition_en)) BETWEEN 1 AND 1000),
 ADD COLUMN value_kind text NOT NULL CHECK(value_kind IN ('money','number','date','text')),
 ADD COLUMN applies_to text NOT NULL CHECK(applies_to IN ('programme','university','immigration_rule','occupation','country')),
 ADD COLUMN min_value numeric,
 ADD COLUMN max_value numeric,
 ADD COLUMN comparable boolean NOT NULL DEFAULT false,
 -- A valid range only makes sense for numbers (e.g. IELTS 0–9).
 ADD CONSTRAINT fact_types_range_kind CHECK(value_kind='number' OR (min_value IS NULL AND max_value IS NULL)),
 ADD CONSTRAINT fact_types_range_order CHECK(min_value IS NULL OR max_value IS NULL OR min_value <= max_value);

ALTER TABLE public.facts RENAME COLUMN metric_id TO fact_type_id;
ALTER TABLE public.facts RENAME CONSTRAINT facts_metric_id_fkey TO facts_fact_type_id_fkey;
ALTER TABLE public.facts RENAME CONSTRAINT facts_metric_country TO facts_fact_type_country;
ALTER INDEX public.facts_metric_country_idx RENAME TO facts_fact_type_country_idx;
ALTER TABLE public.facts
 ADD COLUMN value_number numeric,
 ADD COLUMN value_currency text CHECK(value_currency IS NULL OR value_currency ~ '^[A-Z]{3}$'),
 ADD COLUMN value_period text CHECK(value_period IS NULL OR value_period IN ('year','semester','month','week','total','one_off')),
 ADD COLUMN value_date date,
 -- Structured values only exist for a typed fact.
 ADD CONSTRAINT facts_structured_needs_type CHECK(fact_type_id IS NOT NULL OR num_nonnulls(value_number,value_currency,value_period,value_date) = 0);

-- ---------------------------------------------------------------- saving fact types

DROP FUNCTION public.save_metric(uuid,text,text,text,text,text,boolean);
CREATE FUNCTION public.save_fact_type(p_id uuid,p_key text,p_label_vi text,p_label_en text,p_definition_vi text,p_definition_en text,
 p_value_kind text,p_applies_to text,p_category text,p_unit text,p_min numeric,p_max numeric,p_comparable boolean,p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_prev public.fact_types;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('metrics.manage') THEN RAISE EXCEPTION 'fact_types_forbidden'; END IF;
 IF p_active IS NULL OR p_comparable IS NULL THEN RAISE EXCEPTION 'fact_types_invalid'; END IF;
 BEGIN
   IF p_id IS NULL THEN
     INSERT INTO public.fact_types(key,label_vi,label_en,definition_vi,definition_en,value_kind,applies_to,category,unit_hint,min_value,max_value,comparable,active,created_by)
     VALUES(p_key,btrim(p_label_vi),btrim(p_label_en),btrim(p_definition_vi),btrim(p_definition_en),p_value_kind,p_applies_to,p_category,
       nullif(btrim(p_unit),''),p_min,p_max,p_comparable,p_active,auth.uid()) RETURNING id INTO v_id;
   ELSE
     SELECT * INTO v_prev FROM public.fact_types WHERE id=p_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'fact_types_not_found'; END IF;
     -- Facts typed with this type must keep their meaning.
     IF p_key IS DISTINCT FROM v_prev.key OR p_value_kind IS DISTINCT FROM v_prev.value_kind
        OR p_applies_to IS DISTINCT FROM v_prev.applies_to OR p_category IS DISTINCT FROM v_prev.category THEN
       RAISE EXCEPTION 'fact_types_immutable';
     END IF;
     UPDATE public.fact_types SET label_vi=btrim(p_label_vi),label_en=btrim(p_label_en),definition_vi=btrim(p_definition_vi),
       definition_en=btrim(p_definition_en),unit_hint=nullif(btrim(p_unit),''),min_value=p_min,max_value=p_max,
       comparable=p_comparable,active=p_active,updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
   END IF;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'fact_types_duplicate';
   WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'fact_types_invalid';
 END;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'fact_type.saved',v_id,
   jsonb_build_object('before',to_jsonb(v_prev),'after',jsonb_build_object('key',p_key,'label_vi',btrim(p_label_vi),'label_en',btrim(p_label_en),
     'value_kind',p_value_kind,'applies_to',p_applies_to,'category',p_category,'unit_hint',p_unit,'min',p_min,'max',p_max,
     'comparable',p_comparable,'active',p_active)));
 RETURN v_id;
END $$;

-- ---------------------------------------------------------------- proposing facts

-- p_metric becomes p_fact_type, plus the structured values (trailing, DEFAULT
-- NULL). Dropped and recreated so only one version exists.
DROP FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text,uuid);
CREATE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,
 p_country uuid,p_from date,p_until date,p_excerpt text,
 p_university uuid DEFAULT NULL,p_programme uuid DEFAULT NULL,p_deadline_type text DEFAULT NULL,p_immigration_rule uuid DEFAULT NULL,
 p_occupation uuid DEFAULT NULL,p_reference_period text DEFAULT NULL,p_fact_type uuid DEFAULT NULL,
 p_value_number numeric DEFAULT NULL,p_value_currency text DEFAULT NULL,p_value_period text DEFAULT NULL,p_value_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents; v_entity_country uuid; v_country uuid := p_country; v_type public.fact_types; v_token text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_document_missing'; END IF;
 IF num_nonnulls(p_university,p_programme,p_immigration_rule,p_occupation) > 1 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_deadline_type IS NOT NULL AND p_deadline_type NOT IN ('fixed','rolling','year_round') THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_reference_period IS NOT NULL AND p_reference_period !~ '^[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?$' THEN RAISE EXCEPTION 'facts_invalid'; END IF;

 IF p_fact_type IS NULL THEN
   IF num_nonnulls(p_value_number,p_value_currency,p_value_period,p_value_date) > 0 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSE
   -- Retired types keep their history but accept no new values.
   SELECT * INTO v_type FROM public.fact_types WHERE id=p_fact_type AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_type_invalid'; END IF;
   -- The type says what the fact is about.
   IF (v_type.applies_to='programme' AND p_programme IS NULL)
      OR (v_type.applies_to='university' AND p_university IS NULL)
      OR (v_type.applies_to='immigration_rule' AND p_immigration_rule IS NULL)
      OR (v_type.applies_to='occupation' AND p_occupation IS NULL)
      OR (v_type.applies_to='country' AND num_nonnulls(p_university,p_programme,p_immigration_rule,p_occupation) > 0) THEN
     RAISE EXCEPTION 'facts_type_entity_mismatch';
   END IF;
   -- Exactly the structured values its kind needs.
   -- Parenthesised: PL/pgSQL would otherwise end the IF condition at the CASE's first THEN.
   IF NOT (CASE v_type.value_kind
       WHEN 'money' THEN p_value_number IS NOT NULL AND p_value_number >= 0 AND p_value_currency IS NOT NULL AND p_value_period IS NOT NULL AND p_value_date IS NULL
       WHEN 'number' THEN p_value_number IS NOT NULL AND num_nonnulls(p_value_currency,p_value_period,p_value_date) = 0
         AND (v_type.min_value IS NULL OR p_value_number >= v_type.min_value) AND (v_type.max_value IS NULL OR p_value_number <= v_type.max_value)
       WHEN 'date' THEN p_value_date IS NOT NULL AND num_nonnulls(p_value_number,p_value_currency,p_value_period) = 0
       ELSE num_nonnulls(p_value_number,p_value_currency,p_value_period,p_value_date) = 0
     END) THEN
     RAISE EXCEPTION 'facts_type_value_invalid';
   END IF;
   -- The structured number (or the year of a date) must be in the excerpt,
   -- compared after the same normalisation as AI candidates (digit groups
   -- "145 000" / "145,000" and decimals "6.5" / "6,5" match).
   v_token := CASE v_type.value_kind
     WHEN 'money' THEN public.extraction_norm(trim_scale(p_value_number)::text)
     WHEN 'number' THEN public.extraction_norm(trim_scale(p_value_number)::text)
     WHEN 'date' THEN to_char(p_value_date,'YYYY') END;
   IF v_token IS NOT NULL AND public.extraction_norm(p_excerpt) !~ ('(^|[^0-9])' || v_token || '([^0-9]|$)') THEN
     RAISE EXCEPTION 'facts_number_not_in_excerpt';
   END IF;
 END IF;

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
 IF (p_occupation IS NOT NULL OR p_fact_type IS NOT NULL) AND v_country IS NULL THEN RAISE EXCEPTION 'facts_country_required'; END IF;
 INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,
   university_id,programme_id,deadline_type,immigration_rule_id,occupation_id,reference_period,fact_type_id,
   value_number,value_currency,value_period,value_date)
 VALUES(p_document,btrim(p_topic),btrim(p_subject),btrim(p_predicate),btrim(p_value),nullif(btrim(p_unit),''),v_country,p_from,p_until,auth.uid(),
   p_university,p_programme,p_deadline_type,p_immigration_rule,p_occupation,p_reference_period,p_fact_type,
   p_value_number,p_value_currency,p_value_period,p_value_date) RETURNING id INTO result;
 -- Evidence URL/date come from the immutable document, never from a submitted URL.
 INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at)
 VALUES(result,d.id,d.canonical_url,btrim(p_excerpt),d.retrieved_at);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.save_fact_type(uuid,text,text,text,text,text,text,text,text,text,numeric,numeric,boolean,boolean),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text,uuid,numeric,text,text,date)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_fact_type(uuid,text,text,text,text,text,text,text,text,text,numeric,numeric,boolean,boolean),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text,uuid,numeric,text,text,date)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
