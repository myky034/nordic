BEGIN;

-- L4a — flexible facts: the fact type and the structured value are additions,
-- not conditions (docs/architecture/flexible-facts-plan.md; Decision Log
-- 2026-10-14, approved Q1–Q5).
--
-- 1. A typed fact may have NO structured value. When it has one, it must be
--    complete for the type's kind, and its number (or the date's year) must be
--    in the excerpt (L3 D3, unchanged).
-- 2. extractor_propose(): grounding failures still make a candidate invalid;
--    a wrong fact type or structured value only drops that part, and every
--    adjustment is recorded on the extraction item (editors only).
-- 3. set_fact_type(): a reviewer may set, change or remove the type and
--    structured value of a PROPOSED fact, checked like a manual entry and
--    recorded append-only in fact_type_changes. The verbatim value, excerpt,
--    document and linked entity are never editable.

-- ---------------------------------------------------------------- integrity

-- Currency and period only exist as part of a complete amount. Holds for
-- every existing row: money facts were always stored complete (L3a).
ALTER TABLE public.facts ADD CONSTRAINT facts_money_complete
 CHECK(num_nonnulls(value_currency, value_period) = 0
   OR (value_number IS NOT NULL AND value_currency IS NOT NULL AND value_period IS NOT NULL));

-- The one rule for "does this structured value fit this kind", shared by the
-- three ways in (manual proposal, AI, reviewer). Empty always fits; anything
-- given must be complete. Range checks need the type row, so they are passed in.
CREATE FUNCTION public.structured_value_fits(p_kind text, p_min numeric, p_max numeric,
 p_number numeric, p_currency text, p_period text, p_date date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE p_kind
   WHEN 'money' THEN p_date IS NULL AND (num_nonnulls(p_number, p_currency, p_period) = 0
     OR (p_number >= 0 AND p_currency ~ '^[A-Z]{3}$' AND p_period IN ('year','semester','month','week','total','one_off')))
   WHEN 'number' THEN num_nonnulls(p_currency, p_period, p_date) = 0 AND (p_number IS NULL
     OR ((p_min IS NULL OR p_number >= p_min) AND (p_max IS NULL OR p_number <= p_max)))
   WHEN 'date' THEN num_nonnulls(p_number, p_currency, p_period) = 0
   ELSE num_nonnulls(p_number, p_currency, p_period, p_date) = 0
 END, false)
$$;

-- The token a structured value must show in the excerpt: its number, or the
-- year of its date; NULL when there is nothing to check.
CREATE FUNCTION public.structured_value_in_excerpt(p_excerpt text, p_number numeric, p_date date)
RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(bool_and(public.extraction_norm(p_excerpt) ~ ('(^|[^0-9])' || t || '([^0-9]|$)')), true)
 FROM (SELECT public.extraction_norm(trim_scale(p_number)::text) AS t WHERE p_number IS NOT NULL
       UNION ALL SELECT to_char(p_date, 'YYYY') WHERE p_date IS NOT NULL) tokens
$$;

-- ---------------------------------------------------------------- manual proposals

-- Same signature as L3a; only the structured-value check changes (Q1).
CREATE OR REPLACE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,
 p_country uuid,p_from date,p_until date,p_excerpt text,
 p_university uuid DEFAULT NULL,p_programme uuid DEFAULT NULL,p_deadline_type text DEFAULT NULL,p_immigration_rule uuid DEFAULT NULL,
 p_occupation uuid DEFAULT NULL,p_reference_period text DEFAULT NULL,p_fact_type uuid DEFAULT NULL,
 p_value_number numeric DEFAULT NULL,p_value_currency text DEFAULT NULL,p_value_period text DEFAULT NULL,p_value_date date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents; v_entity_country uuid; v_country uuid := p_country; v_type public.fact_types;
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
   -- L4 Q1: nothing, or a complete value for the kind.
   IF NOT public.structured_value_fits(v_type.value_kind, v_type.min_value, v_type.max_value,
       p_value_number, p_value_currency, p_value_period, p_value_date) THEN
     RAISE EXCEPTION 'facts_type_value_invalid';
   END IF;
   IF NOT public.structured_value_in_excerpt(p_excerpt, p_value_number, p_value_date) THEN
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

-- ---------------------------------------------------------------- AI proposals

-- Every part of a candidate the database removed, in plain words (Q2).
ALTER TABLE public.extraction_items
 ADD COLUMN adjustments text[] NOT NULL DEFAULT '{}' CHECK(cardinality(adjustments) <= 10);

CREATE OR REPLACE FUNCTION public.extractor_propose(p_run uuid, p_request uuid, p_candidate jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 r public.extraction_requests; d public.documents; v_text text; v_account uuid; v_model text;
 v_topic text := btrim(p_candidate->>'topic'); v_subject text := btrim(p_candidate->>'subject');
 v_predicate text := btrim(p_candidate->>'predicate'); v_value text := btrim(p_candidate->>'value');
 v_unit text := nullif(btrim(p_candidate->>'unit'),''); v_excerpt text := btrim(p_candidate->>'excerpt');
 v_slug text := nullif(btrim(p_candidate->>'country'),''); v_period text := nullif(btrim(p_candidate->>'reference_period'),'');
 v_from_raw text := nullif(btrim(p_candidate->>'valid_from'),''); v_until_raw text := nullif(btrim(p_candidate->>'valid_until'),'');
 v_type_key text := nullif(btrim(p_candidate->>'fact_type'),'');
 v_num_raw text := nullif(btrim(p_candidate->>'value_number'),'');
 v_currency text := upper(nullif(btrim(p_candidate->>'value_currency'),''));
 v_vperiod text := nullif(btrim(p_candidate->>'value_period'),'');
 v_date_raw text := nullif(btrim(p_candidate->>'value_date'),'');
 v_from date; v_until date; v_country uuid; v_conf numeric; v_nexcerpt text; v_token text;
 v_reason text; v_outcome text := 'invalid'; v_fact uuid; v_notes text[] := '{}';
 v_type public.fact_types; v_type_id uuid; v_num numeric; v_vdate date; v_drop boolean;
 v_entity_kind text; v_entity uuid; v_entity_country uuid;
BEGIN
 SELECT * INTO r FROM public.extraction_requests WHERE id=p_request AND run_id=p_run AND status='running' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'extraction_request_not_running'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.extraction_runs WHERE id=p_run AND status='running') THEN RAISE EXCEPTION 'extraction_run_closed'; END IF;
 IF p_candidate IS NULL OR jsonb_typeof(p_candidate) <> 'object' OR length(p_candidate::text) > 10000 THEN RAISE EXCEPTION 'extraction_invalid'; END IF;
 v_account := public.extraction_account();
 IF v_account IS NULL THEN RAISE EXCEPTION 'extraction_account_missing'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=r.document_id;
 SELECT text INTO v_text FROM public.document_texts WHERE document_id=r.document_id;
 SELECT model INTO v_model FROM public.extraction_runs WHERE id=p_run;
 SELECT e.kind, e.entity_id, e.country_id INTO v_entity_kind, v_entity, v_entity_country FROM public.document_entity(r.document_id) e;
 v_nexcerpt := public.extraction_norm(v_excerpt);

 -- Group 1 — grounding: any failure makes the whole candidate invalid. The
 -- first failure is recorded as the reason.
 IF (SELECT count(*) FROM public.extraction_items WHERE request_id=p_request AND outcome='proposed') >= 30 THEN
   v_outcome := 'limit'; v_reason := 'More than 30 proposals for one document';
 ELSIF v_topic IS NULL OR NOT (v_topic = ANY(public.extraction_topics())) THEN v_reason := 'Topic not in the allowed list';
 ELSIF coalesce(length(v_subject),0) NOT BETWEEN 1 AND 200 OR coalesce(length(v_predicate),0) NOT BETWEEN 1 AND 200
    OR coalesce(length(v_value),0) NOT BETWEEN 1 AND 2000 OR coalesce(length(v_unit),0) > 100 THEN v_reason := 'Missing or too long subject/predicate/value/unit';
 ELSIF coalesce(length(v_excerpt),0) NOT BETWEEN 20 AND 500 THEN v_reason := 'Excerpt must be 20-500 characters';
 -- The core anti-fabrication rule: evidence must exist in the stored page text.
 ELSIF position(v_nexcerpt IN public.extraction_norm(v_text)) = 0 THEN v_reason := 'Excerpt not found verbatim in the document text';
 ELSIF v_slug IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.countries WHERE slug=v_slug) THEN v_reason := 'Unknown country';
 ELSIF v_period IS NOT NULL AND v_period !~ '^[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?$' THEN v_reason := 'Invalid reference period';
 ELSIF (v_from_raw IS NOT NULL AND v_from_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR (v_until_raw IS NOT NULL AND v_until_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
   v_reason := 'Dates must be YYYY-MM-DD';
 -- CASE (not OR) so a non-numeric value is never cast; parenthesised because
 -- PL/pgSQL would otherwise end the ELSIF condition at the CASE's first THEN.
 ELSIF (p_candidate ? 'confidence') AND (CASE WHEN jsonb_typeof(p_candidate->'confidence')='number'
      THEN (p_candidate->>'confidence')::numeric NOT BETWEEN 0 AND 1 ELSE true END) THEN
   v_reason := 'Confidence must be a number between 0 and 1';
 -- The linked page decides the country; a different stated country is a contradiction.
 ELSIF v_entity_country IS NOT NULL AND v_slug IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.countries WHERE slug=v_slug AND id=v_entity_country) THEN
   v_reason := 'Country does not match the linked page';
 END IF;
 IF v_reason IS NULL THEN
   BEGIN
     v_from := v_from_raw::date; v_until := v_until_raw::date;
   EXCEPTION WHEN others THEN v_reason := 'Dates must be real calendar dates';
   END;
 END IF;
 IF v_reason IS NULL AND v_until IS NOT NULL AND v_from IS NOT NULL AND v_until < v_from THEN v_reason := 'valid_until is before valid_from'; END IF;
 -- Every number in the verbatim value, and the stated years, must be in the
 -- excerpt (no invented figures). The structured value is checked in group 2.
 IF v_reason IS NULL THEN
   FOR v_token IN SELECT (regexp_matches(public.extraction_norm(v_value || ' ' || coalesce(v_unit,'')), '[0-9]+', 'g'))[1]
     UNION SELECT to_char(v_from,'YYYY') WHERE v_from IS NOT NULL
     UNION SELECT to_char(v_until,'YYYY') WHERE v_until IS NOT NULL
     UNION SELECT left(v_period,4) WHERE v_period IS NOT NULL
   LOOP
     IF v_nexcerpt !~ ('(^|[^0-9])' || v_token || '([^0-9]|$)') THEN v_reason := 'Number ' || v_token || ' not found in the excerpt'; EXIT; END IF;
   END LOOP;
 END IF;
 IF v_reason IS NULL AND EXISTS(SELECT 1 FROM public.facts f WHERE f.document_id=r.document_id AND f.status<>'rejected'
     AND public.extraction_norm(f.subject)=public.extraction_norm(v_subject) AND public.extraction_norm(f.predicate)=public.extraction_norm(v_predicate)
     AND public.extraction_norm(f.value)=public.extraction_norm(v_value)) THEN
   v_outcome := 'duplicate'; v_reason := 'Same subject, predicate and value already proposed for this document';
 END IF;

 -- Group 2 — the fact type and structured value are additions (L4 Q2): a
 -- wrong part is dropped and noted, the fact itself is kept.
 IF v_reason IS NULL THEN
   SELECT id INTO v_country FROM public.countries WHERE slug=v_slug;
   v_country := coalesce(v_entity_country, v_country);

   IF v_num_raw IS NOT NULL AND v_num_raw !~ '^[0-9]+(\.[0-9]+)?$' THEN
     v_notes := array_append(v_notes, 'Structured number dropped: "' || left(v_num_raw, 40) || '" is not digits with an optional decimal point');
     v_num_raw := NULL;
   END IF;
   v_num := v_num_raw::numeric;
   IF v_date_raw IS NOT NULL THEN
     BEGIN
       IF v_date_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'bad date'; END IF;
       v_vdate := v_date_raw::date;
     EXCEPTION WHEN others THEN
       v_notes := array_append(v_notes, 'Structured date dropped: "' || left(v_date_raw, 40) || '" is not a real YYYY-MM-DD date');
       v_vdate := NULL;
     END;
   END IF;

   IF v_type_key IS NOT NULL THEN
     SELECT * INTO v_type FROM public.fact_types WHERE key=v_type_key AND active;
     IF NOT FOUND THEN
       v_notes := array_append(v_notes, 'Fact type dropped: "' || left(v_type_key, 60) || '" is unknown or retired');
     ELSIF v_type.applies_to <> 'country' AND v_type.applies_to IS DISTINCT FROM v_entity_kind THEN
       v_notes := array_append(v_notes, 'Fact type dropped: "' || v_type.key || '" does not fit this page');
     ELSIF v_type.applies_to = 'country' AND v_country IS NULL THEN
       v_notes := array_append(v_notes, 'Fact type dropped: "' || v_type.key || '" needs a country');
     ELSE
       v_type_id := v_type.id;
     END IF;
   END IF;

   -- The structured value is kept only when it fits the kept type and is in
   -- the excerpt; otherwise all of it is dropped (never half a value).
   IF num_nonnulls(v_num, v_currency, v_vperiod, v_vdate) > 0 THEN
     v_drop := true;
     IF v_type_id IS NULL THEN
       v_notes := array_append(v_notes, 'Structured value dropped: no fact type');
     ELSIF NOT public.structured_value_fits(v_type.value_kind, v_type.min_value, v_type.max_value, v_num, v_currency, v_vperiod, v_vdate) THEN
       v_notes := array_append(v_notes, 'Structured value dropped: does not fit the fact type "' || v_type.key || '"');
     ELSIF NOT public.structured_value_in_excerpt(v_excerpt, v_num, v_vdate) THEN
       v_notes := array_append(v_notes, 'Structured value dropped: ' || coalesce(trim_scale(v_num)::text, to_char(v_vdate,'YYYY')) || ' is not in the excerpt');
     ELSE
       v_drop := false;
     END IF;
     IF v_drop THEN v_num := NULL; v_currency := NULL; v_vperiod := NULL; v_vdate := NULL; END IF;
   END IF;

   v_conf := CASE WHEN p_candidate ? 'confidence' THEN round((p_candidate->>'confidence')::numeric, 2) END;
   INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,reference_period,origin,ai_model,ai_confidence,
     programme_id,university_id,immigration_rule_id,fact_type_id,value_number,value_currency,value_period,value_date)
   VALUES(r.document_id,v_topic,v_subject,v_predicate,v_value,v_unit,v_country,v_from,v_until,v_account,v_period,'ai',v_model,v_conf,
     CASE WHEN v_entity_kind='programme' THEN v_entity END, CASE WHEN v_entity_kind='university' THEN v_entity END,
     CASE WHEN v_entity_kind='immigration_rule' THEN v_entity END,
     v_type_id, v_num, v_currency, v_vperiod, v_vdate) RETURNING id INTO v_fact;
   -- Evidence URL/date come from the immutable document, never from the model.
   INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at) VALUES(v_fact,d.id,d.canonical_url,v_excerpt,d.retrieved_at);
   v_outcome := 'proposed';
 END IF;

 INSERT INTO public.extraction_items(run_id,request_id,document_id,outcome,reason,fact_id,candidate,adjustments)
 VALUES(p_run,p_request,r.document_id,v_outcome,left(v_reason,300),v_fact,p_candidate,v_notes[1:10]);
 RETURN jsonb_build_object('outcome',v_outcome,'reason',v_reason,'fact_id',v_fact,'adjustments',to_jsonb(v_notes));
END $$;

-- ---------------------------------------------------------------- reviewer sets the type

CREATE TABLE public.fact_type_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 -- Snapshots of {fact_type_id, value_number, value_currency, value_period, value_date}.
 before jsonb NOT NULL,
 after jsonb NOT NULL,
 note text CHECK(note IS NULL OR length(note) <= 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fact_type_changes_fact_idx ON public.fact_type_changes(fact_id, created_at);
ALTER TABLE public.fact_type_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fact_type_changes FROM PUBLIC, anon, authenticated;
-- Read-only history for editors, like fact_reviews; written only by set_fact_type().
GRANT SELECT ON public.fact_type_changes TO authenticated;
CREATE POLICY fact_type_changes_editors ON public.fact_type_changes FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));

CREATE FUNCTION public.set_fact_type(p_fact uuid, p_fact_type uuid,
 p_value_number numeric DEFAULT NULL, p_value_currency text DEFAULT NULL, p_value_period text DEFAULT NULL,
 p_value_date date DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.facts; v_type public.fact_types; v_excerpt text; v_before jsonb; v_after jsonb;
 v_currency text := upper(nullif(btrim(p_value_currency),'')); v_period text := nullif(btrim(p_value_period),'');
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 -- Same serialisation as review_fact: a type change and a decision never race.
 PERFORM pg_advisory_xact_lock(919202604);
 SELECT * INTO f FROM public.facts WHERE id=p_fact FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_missing'; END IF;
 -- Q3: only before the decision; reviewed facts change through withdraw / replace.
 IF f.status <> 'proposed' THEN RAISE EXCEPTION 'facts_already_decided'; END IF;
 IF p_note IS NOT NULL AND length(p_note) > 1000 THEN RAISE EXCEPTION 'facts_invalid'; END IF;

 IF p_fact_type IS NULL THEN
   IF num_nonnulls(p_value_number, v_currency, v_period, p_value_date) > 0 THEN RAISE EXCEPTION 'facts_type_value_invalid'; END IF;
 ELSE
   SELECT * INTO v_type FROM public.fact_types WHERE id=p_fact_type AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_type_invalid'; END IF;
   -- The type must describe what the fact is already linked to. Country types
   -- need a country (an AI fact on an entity page keeps its entity, L3c).
   IF (v_type.applies_to='programme' AND f.programme_id IS NULL)
      OR (v_type.applies_to='university' AND f.university_id IS NULL)
      OR (v_type.applies_to='immigration_rule' AND f.immigration_rule_id IS NULL)
      OR (v_type.applies_to='occupation' AND f.occupation_id IS NULL) THEN
     RAISE EXCEPTION 'facts_type_entity_mismatch';
   END IF;
   IF f.country_id IS NULL THEN RAISE EXCEPTION 'facts_country_required'; END IF;
   IF NOT public.structured_value_fits(v_type.value_kind, v_type.min_value, v_type.max_value,
       p_value_number, v_currency, v_period, p_value_date) THEN
     RAISE EXCEPTION 'facts_type_value_invalid';
   END IF;
   SELECT excerpt INTO v_excerpt FROM public.evidence WHERE fact_id=f.id ORDER BY created_at LIMIT 1;
   IF NOT public.structured_value_in_excerpt(v_excerpt, p_value_number, p_value_date) THEN
     RAISE EXCEPTION 'facts_number_not_in_excerpt';
   END IF;
 END IF;

 v_before := jsonb_build_object('fact_type_id',f.fact_type_id,'value_number',f.value_number,'value_currency',f.value_currency,
   'value_period',f.value_period,'value_date',f.value_date);
 v_after := jsonb_build_object('fact_type_id',p_fact_type,'value_number',p_value_number,'value_currency',v_currency,
   'value_period',v_period,'value_date',p_value_date);
 IF v_before = v_after THEN RAISE EXCEPTION 'facts_type_unchanged'; END IF;

 UPDATE public.facts SET fact_type_id=p_fact_type, value_number=p_value_number, value_currency=v_currency,
   value_period=v_period, value_date=p_value_date WHERE id=f.id;
 INSERT INTO public.fact_type_changes(fact_id, actor_id, before, after, note)
 VALUES(f.id, auth.uid(), v_before, v_after, nullif(btrim(p_note),''));
END $$;

REVOKE ALL ON FUNCTION public.structured_value_fits(text,numeric,numeric,numeric,text,text,date),
 public.structured_value_in_excerpt(text,numeric,date),
 public.set_fact_type(uuid,uuid,numeric,text,text,date,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_fact_type(uuid,uuid,numeric,text,text,date,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
