BEGIN;

-- Slice 9 — crawler worker, incremental crawl, change detection.
-- Decisions confirmed by the project owner on 2026-09-25 (PROJECT_SPEC.md
-- Section 21):
--   1. Only URLs registered per source (crawl_targets) are fetched; an optional
--      sitemap target lists URLs filtered by a path prefix. No link following.
--   2. The crawler connects as a dedicated least-privilege role: it can ONLY
--      execute the crawler_* functions below — no table access at all — so a
--      leaked credential cannot read or change anything else (not even user
--      workspaces). This replaces the service-role key named in spec Section 4.
--   3. Extracted page text is stored privately (document_texts, editors only)
--      for change review and Slice 10 extraction; never shown publicly in full
--      (AGENTS.md Section 8).
--   4. When a page behind a published fact changes, the fact stays public with
--      a warning and enters a "source changed" review queue; a reviewer
--      confirms it (revalidated) or withdraws it (rejected).

-- Crawled documents hash the normalised extracted text, not raw bytes: pages
-- embed rotating tokens/timestamps that would otherwise create a new version
-- (and flag facts) on every run.
ALTER TABLE public.documents DROP CONSTRAINT documents_hash_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_hash_check CHECK (
  content_hash ~ '^[0-9a-f]{64}$' AND metadata_hash ~ '^[0-9a-f]{64}$' AND hash_method IN ('sha256-raw-v1', 'sha256-text-v1'));

-- What to fetch. Admin-managed (crawler.manage), same origin as the source.
CREATE TABLE public.crawl_targets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE RESTRICT,
 url text NOT NULL CHECK(length(url) <= 2048 AND url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$'),
 kind text NOT NULL DEFAULT 'page' CHECK(kind IN ('page','sitemap')),
 -- Sitemap targets only: keep URLs whose path starts with this prefix.
 path_prefix text CHECK(path_prefix IS NULL OR path_prefix ~ '^/[^[:space:]]{0,200}$'),
 max_urls integer NOT NULL DEFAULT 20 CHECK(max_urls BETWEEN 1 AND 100),
 -- CSS selector for the main content (e.g. "main"); null = main, article or body.
 content_selector text CHECK(content_selector IS NULL OR length(btrim(content_selector)) BETWEEN 1 AND 200),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id, url),
 CHECK(kind = 'sitemap' OR path_prefix IS NULL)
);

-- Incremental state per fetched URL (page targets and sitemap-listed URLs).
CREATE TABLE public.crawl_url_states (
 source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE RESTRICT,
 url text NOT NULL,
 etag text CHECK(etag IS NULL OR length(etag) <= 500),
 last_modified text CHECK(last_modified IS NULL OR length(last_modified) <= 100),
 last_hash varchar(64),
 last_status integer,
 last_outcome text,
 last_fetched_at timestamptz,
 last_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
 PRIMARY KEY(source_id, url)
);

CREATE TABLE public.crawler_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 trigger text NOT NULL CHECK(trigger IN ('schedule','manual','local')),
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','succeeded','partial','failed')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 note text CHECK(note IS NULL OR length(note) <= 1000),
 counts jsonb
);
CREATE INDEX crawler_runs_started_idx ON public.crawler_runs(started_at DESC);

CREATE TABLE public.crawler_run_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
 target_id uuid REFERENCES public.crawl_targets(id) ON DELETE SET NULL,
 url text NOT NULL,
 http_status integer,
 outcome text NOT NULL CHECK(outcome IN ('created','unchanged','not_modified','robots_disallowed','skipped_type','too_large','error')),
 error_category text CHECK(error_category IS NULL OR length(error_category) <= 100),
 duration_ms integer,
 document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
 flagged_facts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crawler_run_items_run_idx ON public.crawler_run_items(run_id, created_at);

-- Private extracted text of crawled documents.
CREATE TABLE public.document_texts (
 document_id uuid PRIMARY KEY REFERENCES public.documents(id) ON DELETE CASCADE,
 text text NOT NULL CHECK(length(text) <= 200000),
 extractor text NOT NULL CHECK(extractor IN ('html-text-v1')),
 extracted_at timestamptz NOT NULL DEFAULT now()
);

-- Change detection flag on published facts.
ALTER TABLE public.facts
 ADD COLUMN source_changed_at timestamptz,
 ADD COLUMN source_changed_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
CREATE INDEX facts_source_changed_idx ON public.facts(source_changed_at) WHERE source_changed_at IS NOT NULL;
ALTER TABLE public.fact_reviews DROP CONSTRAINT fact_reviews_decision_check;
ALTER TABLE public.fact_reviews ADD CONSTRAINT fact_reviews_decision_check CHECK(decision IN ('reviewed','rejected','conflicted','revalidated'));

INSERT INTO public.permissions(key, description) VALUES ('crawler.manage', 'Register crawl URLs for sources and view crawler runs');
INSERT INTO public.role_permissions(role_id, permission_key)
SELECT r.id, 'crawler.manage' FROM public.roles r
WHERE EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

-- Read access for operators; no anonymous access; writes only via functions.
ALTER TABLE public.crawl_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_url_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_texts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crawl_targets, public.crawl_url_states, public.crawler_runs, public.crawler_run_items, public.document_texts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.crawl_targets, public.crawl_url_states, public.crawler_runs, public.crawler_run_items, public.document_texts TO authenticated;
CREATE POLICY crawl_targets_operators ON public.crawl_targets FOR SELECT TO authenticated USING(public.has_permission('crawler.manage'));
CREATE POLICY crawl_url_states_operators ON public.crawl_url_states FOR SELECT TO authenticated USING(public.has_permission('crawler.manage'));
CREATE POLICY crawler_runs_operators ON public.crawler_runs FOR SELECT TO authenticated USING(public.has_permission('crawler.manage'));
CREATE POLICY crawler_run_items_operators ON public.crawler_run_items FOR SELECT TO authenticated USING(public.has_permission('crawler.manage'));
CREATE POLICY document_texts_editors ON public.document_texts FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review') OR public.has_permission('documents.ingest'));

-- ---------------------------------------------------------------- admin RPCs
CREATE FUNCTION public.save_crawl_target(p_id uuid, p_source uuid, p_url text, p_kind text, p_prefix text, p_max_urls integer, p_selector text, p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_source_url text; v_prev public.crawl_targets;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('crawler.manage') THEN RAISE EXCEPTION 'crawler_forbidden'; END IF;
 SELECT canonical_url INTO v_source_url FROM public.sources WHERE id=p_source;
 IF v_source_url IS NULL THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
 -- Registered URLs must belong to the registered source (AGENTS.md Section 6).
 IF public.url_origin(p_url) IS DISTINCT FROM public.url_origin(v_source_url) THEN RAISE EXCEPTION 'crawler_url_not_source'; END IF;
 IF p_kind IS NULL OR p_active IS NULL OR p_max_urls IS NULL THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
 BEGIN
   IF p_id IS NULL THEN
     INSERT INTO public.crawl_targets(source_id,url,kind,path_prefix,max_urls,content_selector,active,created_by)
     VALUES(p_source,p_url,p_kind,nullif(btrim(p_prefix),''),p_max_urls,nullif(btrim(p_selector),''),p_active,auth.uid()) RETURNING id INTO v_id;
   ELSE
     SELECT * INTO v_prev FROM public.crawl_targets WHERE id=p_id FOR UPDATE;
     IF NOT FOUND OR v_prev.source_id <> p_source THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
     UPDATE public.crawl_targets SET url=p_url, kind=p_kind, path_prefix=nullif(btrim(p_prefix),''), max_urls=p_max_urls,
       content_selector=nullif(btrim(p_selector),''), active=p_active, updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
   END IF;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'crawler_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'crawler_invalid';
 END;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'crawl_target.saved',v_id,
   jsonb_build_object('before',to_jsonb(v_prev),'after',jsonb_build_object('source_id',p_source,'url',p_url,'kind',p_kind,'path_prefix',p_prefix,'max_urls',p_max_urls,'content_selector',p_selector,'active',p_active)));
 RETURN v_id;
END $$;

-- Reviewer decision on a fact whose source page changed after review.
CREATE FUNCTION public.resolve_source_change(p_fact uuid, p_decision text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.facts;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 SELECT * INTO f FROM public.facts WHERE id=p_fact FOR UPDATE;
 IF NOT FOUND OR f.source_changed_at IS NULL THEN RAISE EXCEPTION 'facts_not_flagged'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('revalidated','rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'facts_invalid';
 END IF;
 -- The original evidence is kept either way; a still-valid claim is not
 -- silently re-dated or re-sourced (a new proposal would be needed for that).
 UPDATE public.facts SET source_changed_at=NULL, source_changed_document_id=NULL,
   status=CASE WHEN p_decision='rejected' THEN 'rejected' ELSE status END WHERE id=p_fact;
 INSERT INTO public.fact_reviews(fact_id,actor_id,decision,note) VALUES(p_fact,auth.uid(),p_decision,btrim(p_note));
END $$;

REVOKE ALL ON FUNCTION public.save_crawl_target(uuid,uuid,text,text,text,integer,text,boolean), public.resolve_source_change(uuid,text,text)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_crawl_target(uuid,uuid,text,text,text,integer,text,boolean), public.resolve_source_change(uuid,text,text) TO authenticated;

-- ---------------------------------------------------------------- crawler API
-- The crawler's database identity. NOLOGIN here: the operator creates a LOGIN
-- role with a password outside version control and grants it this role
-- (see docs/architecture/slice-09-crawler.md). It may only execute the four
-- functions below; each re-validates everything it is given.
CREATE ROLE nordic_crawler_ops NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
GRANT USAGE ON SCHEMA public TO nordic_crawler_ops;

-- A source is crawlable only while enabled, approved and verified — rechecked
-- on every call, so switching a source off stops the next write immediately.
CREATE FUNCTION public.crawler_source_ok(p_source uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sources WHERE id=p_source AND crawl_enabled AND crawl_policy='approved' AND status='verified')
$$;

CREATE FUNCTION public.crawler_start_run(p_trigger text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 INSERT INTO public.crawler_runs(trigger) VALUES(p_trigger) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE FUNCTION public.crawler_due_targets()
RETURNS TABLE(target_id uuid, source_id uuid, source_url text, url text, kind text, path_prefix text, max_urls integer, content_selector text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id, t.source_id, s.canonical_url, t.url, t.kind, t.path_prefix, t.max_urls, t.content_selector
 FROM public.crawl_targets t JOIN public.sources s ON s.id=t.source_id
 WHERE t.active AND s.crawl_enabled AND s.crawl_policy='approved' AND s.status='verified'
 ORDER BY s.id, t.url
$$;

CREATE FUNCTION public.crawler_url_states(p_source uuid)
RETURNS TABLE(url text, etag text, last_modified text, last_hash varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT url, etag, last_modified, last_hash FROM public.crawl_url_states WHERE source_id=p_source AND public.crawler_source_ok(p_source)
$$;

CREATE FUNCTION public.crawler_record(p_run uuid, p_target uuid, p_url text, p_http_status integer, p_outcome text, p_error_category text,
 p_duration_ms integer, p_title text, p_content_hash text, p_metadata_hash text, p_text text, p_etag text, p_last_modified text, p_retrieved_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.crawl_targets; v_source_url text; v_doc uuid; v_created boolean := false; v_outcome text := p_outcome; v_flagged integer := 0;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.crawler_runs WHERE id=p_run AND status='running') THEN RAISE EXCEPTION 'crawler_run_closed'; END IF;
 SELECT * INTO t FROM public.crawl_targets WHERE id=p_target AND active;
 IF NOT FOUND OR NOT public.crawler_source_ok(t.source_id) THEN RAISE EXCEPTION 'crawler_target_not_allowed'; END IF;
 SELECT canonical_url INTO v_source_url FROM public.sources WHERE id=t.source_id;
 -- The URL must be the registered page itself, or (sitemap targets) a URL on
 -- the source's origin under the registered path prefix.
 IF p_url IS NULL OR length(p_url) > 2048 OR p_url !~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$' THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
 IF t.kind='page' AND p_url IS DISTINCT FROM t.url THEN RAISE EXCEPTION 'crawler_url_not_registered'; END IF;
 IF t.kind='sitemap' AND (public.url_origin(p_url) IS DISTINCT FROM public.url_origin(v_source_url)
     OR (t.path_prefix IS NOT NULL AND coalesce(substring(p_url from '^https?://[^/?#]+(/[^?#]*)'), '/') NOT LIKE t.path_prefix || '%')) THEN
   RAISE EXCEPTION 'crawler_url_not_registered';
 END IF;
 IF p_outcome NOT IN ('fetched','not_modified','robots_disallowed','skipped_type','too_large','error') THEN RAISE EXCEPTION 'crawler_invalid'; END IF;

 IF p_outcome='fetched' THEN
   IF p_content_hash !~ '^[0-9a-f]{64}$' OR p_metadata_hash !~ '^[0-9a-f]{64}$' OR p_text IS NULL OR length(p_text) > 200000
      OR p_retrieved_at IS NULL OR p_retrieved_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
   INSERT INTO public.documents(source_id,canonical_url,title,document_type,content_hash,hash_method,metadata_hash,retrieved_at,ingestion_method)
   VALUES(t.source_id,p_url,left(nullif(btrim(p_title),''),300),'webpage',p_content_hash,'sha256-text-v1',p_metadata_hash,p_retrieved_at,'crawler')
   ON CONFLICT (source_id, canonical_url, content_hash) DO NOTHING RETURNING id INTO v_doc;
   v_created := v_doc IS NOT NULL;
   IF v_created THEN
     INSERT INTO public.document_texts(document_id,text,extractor) VALUES(v_doc,p_text,'html-text-v1');
     -- Change detection: published facts whose evidence is an older version of
     -- this same page are flagged for re-review (never changed automatically).
     UPDATE public.facts f SET source_changed_at=now(), source_changed_document_id=v_doc
     WHERE f.status IN ('reviewed','conflicted') AND f.source_changed_at IS NULL
       AND EXISTS(SELECT 1 FROM public.evidence e JOIN public.documents d ON d.id=e.document_id
                  WHERE e.fact_id=f.id AND d.source_id=t.source_id AND d.canonical_url=p_url AND d.id<>v_doc);
     GET DIAGNOSTICS v_flagged = ROW_COUNT;
   ELSE
     SELECT id INTO v_doc FROM public.documents WHERE source_id=t.source_id AND canonical_url=p_url AND content_hash=p_content_hash;
   END IF;
   v_outcome := CASE WHEN v_created THEN 'created' ELSE 'unchanged' END;
 END IF;

 INSERT INTO public.crawl_url_states(source_id,url,etag,last_modified,last_hash,last_status,last_outcome,last_fetched_at,last_document_id)
 VALUES(t.source_id,p_url,left(p_etag,500),left(p_last_modified,100),CASE WHEN p_outcome='fetched' THEN p_content_hash END,p_http_status,v_outcome,now(),v_doc)
 ON CONFLICT (source_id,url) DO UPDATE SET
   etag=CASE WHEN p_outcome IN ('fetched','not_modified') THEN coalesce(EXCLUDED.etag, public.crawl_url_states.etag) ELSE public.crawl_url_states.etag END,
   last_modified=CASE WHEN p_outcome IN ('fetched','not_modified') THEN coalesce(EXCLUDED.last_modified, public.crawl_url_states.last_modified) ELSE public.crawl_url_states.last_modified END,
   last_hash=coalesce(EXCLUDED.last_hash, public.crawl_url_states.last_hash),
   last_status=EXCLUDED.last_status, last_outcome=EXCLUDED.last_outcome, last_fetched_at=now(),
   last_document_id=coalesce(EXCLUDED.last_document_id, public.crawl_url_states.last_document_id);
 IF p_outcome IN ('fetched','not_modified') THEN UPDATE public.sources SET last_crawled_at=now() WHERE id=t.source_id; END IF;
 INSERT INTO public.crawler_run_items(run_id,target_id,url,http_status,outcome,error_category,duration_ms,document_id,flagged_facts)
 VALUES(p_run,p_target,p_url,p_http_status,v_outcome,left(p_error_category,100),p_duration_ms,v_doc,v_flagged);
 RETURN jsonb_build_object('outcome',v_outcome,'document_id',v_doc,'flagged_facts',v_flagged);
END $$;

CREATE FUNCTION public.crawler_finish_run(p_run uuid, p_status text, p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_counts jsonb;
BEGIN
 IF p_status NOT IN ('succeeded','partial','failed') THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
 SELECT coalesce(jsonb_object_agg(outcome, n), '{}'::jsonb) INTO v_counts FROM (SELECT outcome, count(*) AS n FROM public.crawler_run_items WHERE run_id=p_run GROUP BY outcome) x;
 UPDATE public.crawler_runs SET status=p_status, finished_at=now(), note=left(p_note,1000), counts=v_counts WHERE id=p_run AND status='running';
 IF NOT FOUND THEN RAISE EXCEPTION 'crawler_run_closed'; END IF;
 RETURN v_counts;
END $$;

REVOKE ALL ON FUNCTION public.crawler_source_ok(uuid), public.crawler_start_run(text), public.crawler_due_targets(), public.crawler_url_states(uuid),
 public.crawler_record(uuid,uuid,text,integer,text,text,integer,text,text,text,text,text,text,timestamptz), public.crawler_finish_run(uuid,text,text)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crawler_start_run(text), public.crawler_due_targets(), public.crawler_url_states(uuid),
 public.crawler_record(uuid,uuid,text,integer,text,text,integer,text,text,text,text,text,text,timestamptz), public.crawler_finish_run(uuid,text,text)
 TO nordic_crawler_ops;
NOTIFY pgrst, 'reload schema';
COMMIT;
