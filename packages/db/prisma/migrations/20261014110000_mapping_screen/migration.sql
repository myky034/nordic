BEGIN;

-- L5a — "map facts" screen, database part (docs/architecture/mapping-screen-plan.md;
-- Decision Log 2026-10-14, approved Q1–Q6; Linear KHLOE-155).
--
-- D1 editor_document_entity(): editors may see which reviewed entity a crawled
--    page belongs to (document_entity() itself stays internal to the worker).
-- D2 fact_duplicate_of(): ONE duplicate rule for AI and manual proposals.
-- D3 propose_fact(): a manual excerpt must be in the page's crawled text.
-- D4 propose_fact(): a manual duplicate is refused (facts_duplicate).
-- O3 (self-review) is still pending: nothing here changes who may review.

-- ---------------------------------------------------------------- D2 duplicates

-- A non-rejected fact on the same document is the same claim when:
--  (a) subject, predicate and value match (the earlier AI rule); or
--  (b) the value matches and the fact types match, or either has no type
--      ("two years" untyped vs "two years" typed as a duration); or
--  (c) the fact type matches and one excerpt contains the other (a shorter
--      re-extraction of an already proposed sentence).
-- Compared after extraction_norm() (case, spacing, digit separators).
CREATE FUNCTION public.fact_duplicate_of(p_document uuid, p_subject text, p_predicate text, p_value text, p_fact_type uuid, p_excerpt text)
RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT f.id FROM public.facts f
 WHERE f.document_id = p_document AND f.status <> 'rejected' AND (
   (public.extraction_norm(f.subject) = public.extraction_norm(p_subject)
     AND public.extraction_norm(f.predicate) = public.extraction_norm(p_predicate)
     AND public.extraction_norm(f.value) = public.extraction_norm(p_value))
   OR (public.extraction_norm(f.value) = public.extraction_norm(p_value)
     AND (f.fact_type_id IS NOT DISTINCT FROM p_fact_type OR f.fact_type_id IS NULL OR p_fact_type IS NULL))
   OR (p_fact_type IS NOT NULL AND f.fact_type_id = p_fact_type AND EXISTS(
     SELECT 1 FROM public.evidence e WHERE e.fact_id = f.id AND (
       position(public.extraction_norm(p_excerpt) IN public.extraction_norm(e.excerpt)) > 0
       OR position(public.extraction_norm(e.excerpt) IN public.extraction_norm(p_excerpt)) > 0)))
 )
 ORDER BY f.created_at LIMIT 1
$$;

-- ---------------------------------------------------------------- D3 + D4 manual proposals

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
 -- L5 Q4: the excerpt must be in the crawled page text, as for AI proposals.
 -- Documents without stored text (imported metadata) keep the earlier rule.
 IF EXISTS(SELECT 1 FROM public.document_texts t WHERE t.document_id=p_document
     AND position(public.extraction_norm(p_excerpt) IN public.extraction_norm(t.text)) = 0) THEN
   RAISE EXCEPTION 'facts_excerpt_not_in_document';
 END IF;
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
 -- L5 Q3: one duplicate rule for every way in.
 IF public.fact_duplicate_of(p_document, p_subject, p_predicate, p_value, p_fact_type, p_excerpt) IS NOT NULL THEN
   RAISE EXCEPTION 'facts_duplicate';
 END IF;
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

-- ---------------------------------------------------------------- AI proposals use the shared rule

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

   -- L5 Q3: the shared duplicate rule, judged with the type actually kept.
   IF public.fact_duplicate_of(r.document_id, v_subject, v_predicate, v_value, v_type_id, v_excerpt) IS NOT NULL THEN
     v_outcome := 'duplicate'; v_reason := 'Already proposed for this document (same value or same type and excerpt)';
   END IF;
 END IF;
 IF v_reason IS NULL THEN
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

-- ---------------------------------------------------------------- D1 page entity for editors

-- What the mapping screen needs to know about a page: the one reviewed
-- entity whose official URL it is (L3c rule), with a name to show.
CREATE FUNCTION public.editor_document_entity(p_document uuid)
RETURNS TABLE(kind text, entity_id uuid, name text, country_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT (public.has_permission('facts.propose') OR public.has_permission('facts.review')) THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 RETURN QUERY SELECT e.kind, e.entity_id,
   coalesce((SELECT p.name FROM public.programmes p WHERE p.id=e.entity_id AND e.kind='programme'),
            (SELECT u.name FROM public.universities u WHERE u.id=e.entity_id AND e.kind='university'),
            (SELECT r.title FROM public.immigration_rules r WHERE r.id=e.entity_id AND e.kind='immigration_rule')),
   e.country_id
 FROM public.document_entity(p_document) e;
END $$;

REVOKE ALL ON FUNCTION public.fact_duplicate_of(uuid,text,text,text,uuid,text), public.editor_document_entity(uuid)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.editor_document_entity(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
