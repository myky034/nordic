BEGIN;

-- Slice 10a — AI extraction of candidate facts (decisions confirmed by the
-- project owner on 2026-09-28, PROJECT_SPEC.md Section 21):
--   1. Provider: any OpenAI-compatible endpoint (first: Google Gemini free
--      tier). Only public page text from document_texts is sent — never user
--      data, notes or workspaces.
--   2. The worker runs outside Next.js (GitHub Actions), connecting as a
--      least-privilege role (nordic_extractor_ops) that can only execute the
--      extractor_* functions below. The LLM key never reaches Vercel.
--   3. Only documents an editor explicitly requested are processed
--      (extraction_requests).
--   4. Limits: at most 10 documents per run (worker default 5), text cut at
--      50 000 characters by the worker, at most 30 proposals per document.
--
-- Model output is untrusted (AGENTS.md 1.3, 9). Every candidate is validated
-- HERE, not only in the worker: the excerpt must occur verbatim in the stored
-- page text, every number in the value must occur in the excerpt, dates must be
-- grounded, the topic must come from a fixed list and the country from the
-- countries table. Accepted candidates become status 'proposed' facts created
-- by the configured AI account; nothing is reviewed, conflicted or published
-- automatically, and no university/programme/rule/occupation is linked (a
-- reviewer does that).

-- ---------------------------------------------------------------- facts origin
ALTER TABLE public.facts
 ADD COLUMN origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','ai')),
 ADD COLUMN ai_model text CHECK(ai_model IS NULL OR length(ai_model) BETWEEN 1 AND 100),
 -- The model's self-reported confidence: a hint for reviewers, not a trust or
 -- truth score (AGENTS.md 11). Never used to publish or rank anything.
 ADD COLUMN ai_confidence numeric(3,2) CHECK(ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
 ADD CONSTRAINT facts_ai_fields CHECK(origin='ai' OR (ai_model IS NULL AND ai_confidence IS NULL));

-- ---------------------------------------------------------------- tables
-- Singleton: which account AI proposals are attributed to. Set by an admin;
-- the account must be able to propose and must NOT be able to review.
CREATE TABLE public.extraction_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 ai_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.extraction_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trigger text NOT NULL CHECK(trigger IN ('schedule','manual','local')),
 provider text NOT NULL CHECK(length(provider) BETWEEN 1 AND 200),
 model text NOT NULL CHECK(length(model) BETWEEN 1 AND 100),
 prompt_version text NOT NULL CHECK(length(prompt_version) BETWEEN 1 AND 50),
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','partial','failed')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 input_tokens integer NOT NULL DEFAULT 0 CHECK(input_tokens >= 0),
 output_tokens integer NOT NULL DEFAULT 0 CHECK(output_tokens >= 0),
 counts jsonb,
 note text CHECK(note IS NULL OR length(note) <= 1000)
);
CREATE INDEX extraction_runs_started_idx ON public.extraction_runs(started_at DESC);

CREATE TABLE public.extraction_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed','cancelled')),
 run_id uuid REFERENCES public.extraction_runs(id) ON DELETE SET NULL,
 note text CHECK(note IS NULL OR length(note) <= 1000),
 input_tokens integer CHECK(input_tokens IS NULL OR input_tokens >= 0),
 output_tokens integer CHECK(output_tokens IS NULL OR output_tokens >= 0),
 truncated boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz,
 finished_at timestamptz
);
-- One open request per document at a time.
CREATE UNIQUE INDEX extraction_requests_open_idx ON public.extraction_requests(document_id) WHERE status IN ('pending','running');
CREATE INDEX extraction_requests_status_idx ON public.extraction_requests(status, created_at);

CREATE TABLE public.extraction_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL REFERENCES public.extraction_runs(id) ON DELETE CASCADE,
 request_id uuid NOT NULL REFERENCES public.extraction_requests(id) ON DELETE CASCADE,
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
 outcome text NOT NULL CHECK(outcome IN ('proposed','invalid','duplicate','limit')),
 reason text CHECK(reason IS NULL OR length(reason) <= 300),
 fact_id uuid REFERENCES public.facts(id) ON DELETE SET NULL,
 -- Raw model candidate kept for audit (variable shape: JSON is appropriate).
 candidate jsonb NOT NULL CHECK(length(candidate::text) <= 10000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX extraction_items_request_idx ON public.extraction_items(request_id);
CREATE INDEX extraction_items_run_idx ON public.extraction_items(run_id);

-- ---------------------------------------------------------------- RLS
ALTER TABLE public.extraction_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extraction_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.extraction_settings, public.extraction_runs, public.extraction_requests, public.extraction_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.extraction_settings, public.extraction_runs, public.extraction_requests, public.extraction_items TO authenticated;
CREATE POLICY extraction_settings_read ON public.extraction_settings FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review') OR public.has_permission('roles.manage'));
CREATE POLICY extraction_runs_editors ON public.extraction_runs FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));
CREATE POLICY extraction_requests_editors ON public.extraction_requests FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));
CREATE POLICY extraction_items_editors ON public.extraction_items FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));

-- ---------------------------------------------------------------- helpers
-- has_permission() checks the CALLER; this checks a given account (active,
-- confirmed) and is used only inside SECURITY DEFINER functions.
CREATE FUNCTION public.user_has_permission(p_user uuid, p_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role_id=ur.role_id
 JOIN auth.users u ON u.id=ur.user_id WHERE ur.user_id=p_user AND rp.permission_key=p_key AND u.email_confirmed_at IS NOT NULL
 AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until < now()));
$$;

-- The configured AI account, or NULL when missing or no longer suitable.
CREATE FUNCTION public.extraction_account() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT ai_user_id FROM public.extraction_settings
 WHERE public.user_has_permission(ai_user_id,'facts.propose') AND NOT public.user_has_permission(ai_user_id,'facts.review')
$$;

-- Comparison form: NFC, lower case, whitespace collapsed, digit separators
-- removed ("10 656" / "10,656" / "10.656" -> "10656") so a verbatim check is
-- not defeated by formatting alone.
CREATE FUNCTION public.extraction_norm(p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT btrim(regexp_replace(regexp_replace(regexp_replace(lower(normalize(coalesce(p,''),NFC)),
   '([0-9])[ ,.''’' || chr(160) || chr(8239) || ']([0-9])', '\1\2', 'g'),
   '([0-9])[ ,.''’' || chr(160) || chr(8239) || ']([0-9])', '\1\2', 'g'), '\s+', ' ', 'g'))
$$;

-- Topics an AI candidate may use (manual proposals keep free text).
CREATE FUNCTION public.extraction_topics() RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT ARRAY['education','admission','tuition','deadline','scholarship','immigration','labour_market','living_cost','housing','language','other']
$$;

-- ---------------------------------------------------------------- editor/admin RPCs
CREATE FUNCTION public.request_extraction(p_document uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'extraction_forbidden'; END IF;
 -- Only crawled documents carry stored text; nothing else is sent to a model.
 IF NOT EXISTS(SELECT 1 FROM public.document_texts WHERE document_id=p_document) THEN RAISE EXCEPTION 'extraction_no_text'; END IF;
 BEGIN
   INSERT INTO public.extraction_requests(document_id,requested_by) VALUES(p_document,auth.uid()) RETURNING id INTO v_id;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'extraction_already_open';
 END;
 RETURN v_id;
END $$;

CREATE FUNCTION public.cancel_extraction(p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'extraction_forbidden'; END IF;
 UPDATE public.extraction_requests SET status='cancelled', finished_at=now(), note='Cancelled by an editor'
 WHERE id=p_request AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'extraction_not_pending'; END IF;
END $$;

CREATE FUNCTION public.set_extraction_account(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_prev uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('roles.manage') THEN RAISE EXCEPTION 'extraction_forbidden'; END IF;
 -- Same rule as the 2026-09-26 batch: the AI account can propose but can
 -- never review its own proposals.
 IF p_user IS NULL OR NOT public.user_has_permission(p_user,'facts.propose') OR public.user_has_permission(p_user,'facts.review') THEN
   RAISE EXCEPTION 'extraction_account_unsuitable';
 END IF;
 SELECT ai_user_id INTO v_prev FROM public.extraction_settings;
 INSERT INTO public.extraction_settings(id,ai_user_id,updated_by) VALUES(true,p_user,auth.uid())
 ON CONFLICT (id) DO UPDATE SET ai_user_id=EXCLUDED.ai_user_id, updated_by=EXCLUDED.updated_by, updated_at=now();
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'extraction.account_set',p_user,
   jsonb_build_object('before',v_prev,'after',p_user));
END $$;

REVOKE ALL ON FUNCTION public.user_has_permission(uuid,text), public.extraction_account(), public.extraction_norm(text), public.extraction_topics(),
 public.request_extraction(uuid), public.cancel_extraction(uuid), public.set_extraction_account(uuid)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_extraction(uuid), public.cancel_extraction(uuid), public.set_extraction_account(uuid) TO authenticated;

-- ---------------------------------------------------------------- extractor API
-- The worker's database identity. NOLOGIN: the operator creates a LOGIN role
-- (password outside version control) that is a member of this role; see
-- docs/architecture/slice-10a-ai-extraction.md. No table privileges at all.
CREATE ROLE nordic_extractor_ops NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT USAGE ON SCHEMA public TO nordic_extractor_ops;

CREATE FUNCTION public.extractor_start_run(p_trigger text, p_provider text, p_model text, p_prompt_version text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF public.extraction_account() IS NULL THEN RAISE EXCEPTION 'extraction_account_missing'; END IF;
 -- Recover from a crashed worker: runs left open for 2 hours are closed and
 -- their claimed requests marked failed (never silently retried forever).
 UPDATE public.extraction_requests r SET status='failed', finished_at=now(), note='Worker stopped before finishing'
 WHERE r.status='running' AND EXISTS(SELECT 1 FROM public.extraction_runs x WHERE x.id=r.run_id AND x.status='running' AND x.started_at < now() - interval '2 hours');
 UPDATE public.extraction_runs SET status='failed', finished_at=now(), note='Worker stopped before finishing'
 WHERE status='running' AND started_at < now() - interval '2 hours';
 BEGIN
   INSERT INTO public.extraction_runs(trigger,provider,model,prompt_version) VALUES(p_trigger,p_provider,p_model,p_prompt_version) RETURNING id INTO v_id;
 EXCEPTION WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'extraction_invalid';
 END;
 RETURN v_id;
END $$;

CREATE FUNCTION public.extractor_countries() RETURNS TABLE(slug text, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT slug, name FROM public.countries ORDER BY slug
$$;

-- Claims up to p_limit (max 10) pending requests for this run and returns the
-- stored text plus source context. SKIP LOCKED keeps two runs from sharing.
CREATE FUNCTION public.extractor_claim(p_run uuid, p_limit integer)
RETURNS TABLE(request_id uuid, document_id uuid, title text, url text, source_name text, source_tier text, text text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.extraction_runs WHERE id=p_run AND status='running') THEN RAISE EXCEPTION 'extraction_run_closed'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'extraction_invalid'; END IF;
 RETURN QUERY
 WITH picked AS (
   SELECT r.id FROM public.extraction_requests r WHERE r.status='pending' ORDER BY r.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED
 ), claimed AS (
   UPDATE public.extraction_requests r SET status='running', run_id=p_run, started_at=now() FROM picked WHERE r.id=picked.id RETURNING r.id, r.document_id
 )
 SELECT c.id, d.id, d.title, d.canonical_url, s.name, s.source_tier, t.text
 FROM claimed c JOIN public.documents d ON d.id=c.document_id JOIN public.sources s ON s.id=d.source_id
 JOIN public.document_texts t ON t.document_id=d.id;
END $$;

-- Validates ONE model candidate and, if it passes, creates a proposed fact +
-- evidence attributed to the AI account. Every candidate is logged.
CREATE FUNCTION public.extractor_propose(p_run uuid, p_request uuid, p_candidate jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 r public.extraction_requests; d public.documents; v_text text; v_account uuid; v_model text;
 v_topic text := btrim(p_candidate->>'topic'); v_subject text := btrim(p_candidate->>'subject');
 v_predicate text := btrim(p_candidate->>'predicate'); v_value text := btrim(p_candidate->>'value');
 v_unit text := nullif(btrim(p_candidate->>'unit'),''); v_excerpt text := btrim(p_candidate->>'excerpt');
 v_slug text := nullif(btrim(p_candidate->>'country'),''); v_period text := nullif(btrim(p_candidate->>'reference_period'),'');
 v_from_raw text := nullif(btrim(p_candidate->>'valid_from'),''); v_until_raw text := nullif(btrim(p_candidate->>'valid_until'),'');
 v_from date; v_until date; v_country uuid; v_conf numeric; v_nexcerpt text; v_token text;
 v_reason text; v_outcome text := 'invalid'; v_fact uuid;
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
 ELSIF (v_from_raw IS NOT NULL AND v_from_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR (v_until_raw IS NOT NULL AND v_until_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') THEN
   v_reason := 'Dates must be YYYY-MM-DD';
 -- CASE (not OR) so a non-numeric value is never cast; parenthesised because
 -- PL/pgSQL would otherwise end the ELSIF condition at the CASE's first THEN.
 ELSIF (p_candidate ? 'confidence') AND (CASE WHEN jsonb_typeof(p_candidate->'confidence')='number'
      THEN (p_candidate->>'confidence')::numeric NOT BETWEEN 0 AND 1 ELSE true END) THEN
   v_reason := 'Confidence must be a number between 0 and 1';
 END IF;

 IF v_reason IS NULL THEN
   BEGIN
     v_from := v_from_raw::date; v_until := v_until_raw::date;
   EXCEPTION WHEN others THEN v_reason := 'Dates must be real calendar dates';
   END;
 END IF;
 IF v_reason IS NULL AND v_until IS NOT NULL AND v_from IS NOT NULL AND v_until < v_from THEN v_reason := 'valid_until is before valid_from'; END IF;
 -- Every number the model states must be in the excerpt (no invented figures);
 -- stated years of dates / reference period must be there too.
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

 IF v_reason IS NULL THEN
   SELECT id INTO v_country FROM public.countries WHERE slug=v_slug;
   v_conf := CASE WHEN p_candidate ? 'confidence' THEN round((p_candidate->>'confidence')::numeric, 2) END;
   INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,reference_period,origin,ai_model,ai_confidence)
   VALUES(r.document_id,v_topic,v_subject,v_predicate,v_value,v_unit,v_country,v_from,v_until,v_account,v_period,'ai',v_model,v_conf) RETURNING id INTO v_fact;
   -- Evidence URL/date come from the immutable document, never from the model.
   INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at) VALUES(v_fact,d.id,d.canonical_url,v_excerpt,d.retrieved_at);
   v_outcome := 'proposed';
 END IF;

 INSERT INTO public.extraction_items(run_id,request_id,document_id,outcome,reason,fact_id,candidate)
 VALUES(p_run,p_request,r.document_id,v_outcome,left(v_reason,300),v_fact,p_candidate);
 RETURN jsonb_build_object('outcome',v_outcome,'reason',v_reason,'fact_id',v_fact);
END $$;

CREATE FUNCTION public.extractor_finish_request(p_run uuid, p_request uuid, p_status text, p_note text, p_input_tokens integer, p_output_tokens integer, p_truncated boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_status NOT IN ('done','failed') THEN RAISE EXCEPTION 'extraction_invalid'; END IF;
 UPDATE public.extraction_requests SET status=p_status, note=left(p_note,1000), finished_at=now(),
   input_tokens=greatest(coalesce(p_input_tokens,0),0), output_tokens=greatest(coalesce(p_output_tokens,0),0), truncated=coalesce(p_truncated,false)
 WHERE id=p_request AND run_id=p_run AND status='running';
 IF NOT FOUND THEN RAISE EXCEPTION 'extraction_request_not_running'; END IF;
 UPDATE public.extraction_runs SET input_tokens=input_tokens+greatest(coalesce(p_input_tokens,0),0),
   output_tokens=output_tokens+greatest(coalesce(p_output_tokens,0),0) WHERE id=p_run;
END $$;

CREATE FUNCTION public.extractor_finish_run(p_run uuid, p_status text, p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_counts jsonb;
BEGIN
 IF p_status NOT IN ('succeeded','partial','failed') THEN RAISE EXCEPTION 'extraction_invalid'; END IF;
 -- Requests the worker never finished are not left "running".
 UPDATE public.extraction_requests SET status='failed', finished_at=now(), note='Run ended before this document finished'
 WHERE run_id=p_run AND status='running';
 SELECT coalesce(jsonb_object_agg(outcome, n), '{}'::jsonb) INTO v_counts FROM (SELECT outcome, count(*) AS n FROM public.extraction_items WHERE run_id=p_run GROUP BY outcome) x;
 UPDATE public.extraction_runs SET status=p_status, finished_at=now(), note=left(p_note,1000), counts=v_counts WHERE id=p_run AND status='running';
 IF NOT FOUND THEN RAISE EXCEPTION 'extraction_run_closed'; END IF;
 RETURN v_counts;
END $$;

REVOKE ALL ON FUNCTION public.extractor_start_run(text,text,text,text), public.extractor_countries(), public.extractor_claim(uuid,integer),
 public.extractor_propose(uuid,uuid,jsonb), public.extractor_finish_request(uuid,uuid,text,text,integer,integer,boolean), public.extractor_finish_run(uuid,text,text)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extractor_start_run(text,text,text,text), public.extractor_countries(), public.extractor_claim(uuid,integer),
 public.extractor_propose(uuid,uuid,jsonb), public.extractor_finish_request(uuid,uuid,text,text,integer,integer,boolean), public.extractor_finish_run(uuid,text,text)
 TO nordic_extractor_ops;
NOTIFY pgrst, 'reload schema';
COMMIT;
