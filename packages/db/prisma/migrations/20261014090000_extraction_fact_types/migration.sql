BEGIN;

-- L3c — AI proposals with fact types and structured values; the entity comes
-- from the page URL (Decision Log 2026-10-14, option A).
--
-- * A document whose canonical URL matches the official URL of exactly ONE
--   reviewed programme, university or immigration rule is that entity's page.
--   Every proposal extracted from it is linked to that entity. Occupations
--   have no official URL, so they are never matched. The model never picks
--   the entity.
-- * The worker asks extractor_fact_types() which fact types it may use for a
--   document: the types for the matched entity's kind, plus country types.
-- * extractor_propose() accepts fact_type + value_number / value_currency /
--   value_period / value_date and checks them like a manual typed fact
--   (L3a). A failing candidate is recorded as invalid with its reason; it is
--   never re-typed or stored untyped behind the reviewer's back.

-- URL comparison key: scheme and host lower-cased, fragment dropped, a
-- trailing slash before the query or the end removed. Nothing else changes
-- ("exact match" up to these trivial differences; www. is significant).
CREATE FUNCTION public.page_key(p_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_url ~* '^https?://[^/?#]+' THEN
   lower(substring(p_url FROM '^([^:/]+://[^/?#]+)'))
   || regexp_replace(coalesce(substring(p_url FROM '^[^:/]+://[^/?#]+([^#]*)'), ''), '/+(\?|$)', '\1')
 END
$$;

-- The one reviewed entity whose official page this document is, if exactly one.
CREATE FUNCTION public.document_entity(p_document uuid)
RETURNS TABLE(kind text, entity_id uuid, country_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH k AS (SELECT public.page_key(canonical_url) AS key FROM public.documents WHERE id=p_document),
 m AS (
   SELECT 'programme'::text AS kind, p.id AS entity_id, u.country_id FROM public.programmes p
     JOIN public.universities u ON u.id=p.university_id, k
     WHERE p.status='reviewed' AND u.status='reviewed' AND public.page_key(p.official_url)=k.key
   UNION ALL
   SELECT 'university', u.id, u.country_id FROM public.universities u, k
     WHERE u.status='reviewed' AND public.page_key(u.official_url)=k.key
   UNION ALL
   SELECT 'immigration_rule', r.id, r.country_id FROM public.immigration_rules r, k
     WHERE r.status='reviewed' AND public.page_key(r.official_url)=k.key
 )
 SELECT kind, entity_id, country_id FROM m WHERE (SELECT count(*) FROM m) = 1
$$;

-- Fact types the model may use for one claimed request.
CREATE FUNCTION public.extractor_fact_types(p_run uuid, p_request uuid)
RETURNS TABLE(key text, label_en text, definition_en text, value_kind text, applies_to text, unit_hint text, min_value numeric, max_value numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.extraction_requests; v_kind text;
BEGIN
 SELECT * INTO r FROM public.extraction_requests WHERE id=p_request AND run_id=p_run AND status='running';
 IF NOT FOUND THEN RAISE EXCEPTION 'extraction_request_not_running'; END IF;
 SELECT e.kind INTO v_kind FROM public.document_entity(r.document_id) e;
 RETURN QUERY SELECT t.key, t.label_en, t.definition_en, t.value_kind, t.applies_to, t.unit_hint, t.min_value, t.max_value
   FROM public.fact_types t WHERE t.active AND (t.applies_to='country' OR t.applies_to=v_kind) ORDER BY t.applies_to, t.key;
END $$;

CREATE OR REPLACE FUNCTION public.extractor_propose(p_run uuid, p_request uuid, p_candidate jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 r public.extraction_requests; d public.documents; v_text text; v_account uuid; v_model text;
 v_topic text := btrim(p_candidate->>'topic'); v_subject text := btrim(p_candidate->>'subject');
 v_predicate text := btrim(p_candidate->>'predicate'); v_value text := btrim(p_candidate->>'value');
 v_unit text := nullif(btrim(p_candidate->>'unit'),''); v_excerpt text := btrim(p_candidate->>'excerpt');
 v_slug text := nullif(btrim(p_candidate->>'country'),''); v_period text := nullif(btrim(p_candidate->>'reference_period'),'');
 v_from_raw text := nullif(btrim(p_candidate->>'valid_from'),''); v_until_raw text := nullif(btrim(p_candidate->>'valid_until'),'');
 -- L3c: optional fact type and structured value ("" = not stated).
 v_type_key text := nullif(btrim(p_candidate->>'fact_type'),'');
 v_num_raw text := nullif(btrim(p_candidate->>'value_number'),'');
 v_currency text := upper(nullif(btrim(p_candidate->>'value_currency'),''));
 v_vperiod text := nullif(btrim(p_candidate->>'value_period'),'');
 v_date_raw text := nullif(btrim(p_candidate->>'value_date'),'');
 v_from date; v_until date; v_country uuid; v_conf numeric; v_nexcerpt text; v_token text;
 v_reason text; v_outcome text := 'invalid'; v_fact uuid;
 v_type public.fact_types; v_num numeric; v_vdate date;
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

 -- Checks run in order; the first failure is recorded as the reason.
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
 ELSIF (v_from_raw IS NOT NULL AND v_from_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR (v_until_raw IS NOT NULL AND v_until_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    OR (v_date_raw IS NOT NULL AND v_date_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
   v_reason := 'Dates must be YYYY-MM-DD';
 -- CASE (not OR) so a non-numeric value is never cast; parenthesised because
 -- PL/pgSQL would otherwise end the ELSIF condition at the CASE's first THEN.
 ELSIF (p_candidate ? 'confidence') AND (CASE WHEN jsonb_typeof(p_candidate->'confidence')='number'
      THEN (p_candidate->>'confidence')::numeric NOT BETWEEN 0 AND 1 ELSE true END) THEN
   v_reason := 'Confidence must be a number between 0 and 1';
 ELSIF v_num_raw IS NOT NULL AND v_num_raw !~ '^[0-9]+(\.[0-9]+)?$' THEN
   v_reason := 'Structured number must be digits with an optional decimal point';
 -- The linked page decides the country; a different stated country is a contradiction.
 ELSIF v_entity_country IS NOT NULL AND v_slug IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.countries WHERE slug=v_slug AND id=v_entity_country) THEN
   v_reason := 'Country does not match the linked page';
 END IF;

 IF v_reason IS NULL THEN
   BEGIN
     v_from := v_from_raw::date; v_until := v_until_raw::date; v_vdate := v_date_raw::date;
   EXCEPTION WHEN others THEN v_reason := 'Dates must be real calendar dates';
   END;
 END IF;
 IF v_reason IS NULL AND v_until IS NOT NULL AND v_from IS NOT NULL AND v_until < v_from THEN v_reason := 'valid_until is before valid_from'; END IF;
 IF v_reason IS NULL THEN v_num := v_num_raw::numeric; END IF;

 -- L3c: the fact type, checked like a manual typed fact (propose_fact, L3a).
 IF v_reason IS NULL AND v_type_key IS NULL AND num_nonnulls(v_num, v_currency, v_vperiod, v_vdate) > 0 THEN
   v_reason := 'Structured value without a fact type';
 ELSIF v_reason IS NULL AND v_type_key IS NOT NULL THEN
   SELECT * INTO v_type FROM public.fact_types WHERE key=v_type_key AND active;
   IF NOT FOUND THEN v_reason := 'Unknown or retired fact type';
   ELSIF v_type.applies_to <> 'country' AND v_type.applies_to IS DISTINCT FROM v_entity_kind THEN
     v_reason := 'Fact type does not fit this page';
   ELSIF v_type.applies_to = 'country' AND v_entity_country IS NULL AND v_slug IS NULL THEN
     v_reason := 'Fact type needs a country';
   -- coalesce: a missing part (NULL) must fail the check, not skip it.
   ELSIF NOT coalesce(CASE v_type.value_kind
       WHEN 'money' THEN v_num IS NOT NULL AND v_currency ~ '^[A-Z]{3}$' AND v_vperiod IN ('year','semester','month','week','total','one_off') AND v_vdate IS NULL
       WHEN 'number' THEN v_num IS NOT NULL AND num_nonnulls(v_currency, v_vperiod, v_vdate) = 0
         AND (v_type.min_value IS NULL OR v_num >= v_type.min_value) AND (v_type.max_value IS NULL OR v_num <= v_type.max_value)
       WHEN 'date' THEN v_vdate IS NOT NULL AND num_nonnulls(v_num, v_currency, v_vperiod) = 0
       ELSE num_nonnulls(v_num, v_currency, v_vperiod, v_vdate) = 0
     END, false) THEN
     v_reason := 'Structured value does not fit the fact type';
   END IF;
 END IF;

 -- Every number the model states must be in the excerpt (no invented figures);
 -- stated years of dates / reference period, and the structured number or
 -- date year, must be there too.
 IF v_reason IS NULL THEN
   FOR v_token IN SELECT (regexp_matches(public.extraction_norm(v_value || ' ' || coalesce(v_unit,'')), '[0-9]+', 'g'))[1]
     UNION SELECT to_char(v_from,'YYYY') WHERE v_from IS NOT NULL
     UNION SELECT to_char(v_until,'YYYY') WHERE v_until IS NOT NULL
     UNION SELECT left(v_period,4) WHERE v_period IS NOT NULL
     UNION SELECT public.extraction_norm(trim_scale(v_num)::text) WHERE v_num IS NOT NULL
     UNION SELECT to_char(v_vdate,'YYYY') WHERE v_vdate IS NOT NULL
   LOOP
     IF v_nexcerpt !~ ('(^|[^0-9])' || v_token || '([^0-9]|$)') THEN v_reason := 'Number ' || v_token || ' not found in the excerpt'; EXIT; END IF;
   END LOOP;
 END IF;
 IF v_reason IS NULL AND EXISTS(SELECT 1 FROM public.facts f WHERE f.document_id=r.document_id AND f.status<>'rejected'
     AND public.extraction_norm(f.subject)=public.extraction_norm(v_subject) AND public.extraction_norm(f.predicate)=public.extraction_norm(v_predicate)
     AND public.extraction_norm(f.value)=public.extraction_norm(v_value)) THEN
   v_outcome := 'duplicate'; v_reason := 'Same subject, predicate and value already proposed for this document';
 END IF;

 IF v_reason IS NULL THEN
   SELECT id INTO v_country FROM public.countries WHERE slug=v_slug;
   v_country := coalesce(v_entity_country, v_country);
   v_conf := CASE WHEN p_candidate ? 'confidence' THEN round((p_candidate->>'confidence')::numeric, 2) END;
   INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,reference_period,origin,ai_model,ai_confidence,
     programme_id,university_id,immigration_rule_id,fact_type_id,value_number,value_currency,value_period,value_date)
   VALUES(r.document_id,v_topic,v_subject,v_predicate,v_value,v_unit,v_country,v_from,v_until,v_account,v_period,'ai',v_model,v_conf,
     CASE WHEN v_entity_kind='programme' THEN v_entity END, CASE WHEN v_entity_kind='university' THEN v_entity END,
     CASE WHEN v_entity_kind='immigration_rule' THEN v_entity END,
     v_type.id, v_num, v_currency, v_vperiod, v_vdate) RETURNING id INTO v_fact;
   -- Evidence URL/date come from the immutable document, never from the model.
   INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at) VALUES(v_fact,d.id,d.canonical_url,v_excerpt,d.retrieved_at);
   v_outcome := 'proposed';
 END IF;

 INSERT INTO public.extraction_items(run_id,request_id,document_id,outcome,reason,fact_id,candidate)
 VALUES(p_run,p_request,r.document_id,v_outcome,left(v_reason,300),v_fact,p_candidate);
 RETURN jsonb_build_object('outcome',v_outcome,'reason',v_reason,'fact_id',v_fact);
END $$;

REVOKE ALL ON FUNCTION public.page_key(text), public.document_entity(uuid), public.extractor_fact_types(uuid,uuid)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extractor_fact_types(uuid,uuid) TO nordic_extractor_ops;
NOTIFY pgrst, 'reload schema';
COMMIT;
