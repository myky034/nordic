BEGIN;

-- L6 — the crawler reads pages with a real (headless) browser by default
-- (Decision Log 2026-10-15; docs/architecture/browser-crawler-plan.md;
-- Linear KHLOE-158). Pages that draw their content with JavaScript (tuition,
-- start dates on university pages) otherwise lose it. A registered URL may
-- opt out; sitemaps are always read without a browser.

-- Existing URLs get the new default too (owner decision: browser by default).
ALTER TABLE public.crawl_targets ADD COLUMN render_js boolean NOT NULL DEFAULT true;

-- One more (trailing, defaulted) argument: dropped and recreated so only one
-- version exists, as in earlier slices.
DROP FUNCTION public.save_crawl_target(uuid,uuid,text,text,text,integer,text,boolean);
CREATE FUNCTION public.save_crawl_target(p_id uuid, p_source uuid, p_url text, p_kind text, p_prefix text, p_max_urls integer, p_selector text, p_active boolean,
 p_render_js boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_source_url text; v_prev public.crawl_targets;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('crawler.manage') THEN RAISE EXCEPTION 'crawler_forbidden'; END IF;
 SELECT canonical_url INTO v_source_url FROM public.sources WHERE id=p_source;
 IF v_source_url IS NULL THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
 -- Registered URLs must belong to the registered source (AGENTS.md Section 6).
 IF public.url_origin(p_url) IS DISTINCT FROM public.url_origin(v_source_url) THEN RAISE EXCEPTION 'crawler_url_not_source'; END IF;
 IF p_kind IS NULL OR p_active IS NULL OR p_max_urls IS NULL OR p_render_js IS NULL THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
 BEGIN
   IF p_id IS NULL THEN
     INSERT INTO public.crawl_targets(source_id,url,kind,path_prefix,max_urls,content_selector,active,render_js,created_by)
     VALUES(p_source,p_url,p_kind,nullif(btrim(p_prefix),''),p_max_urls,nullif(btrim(p_selector),''),p_active,p_render_js,auth.uid()) RETURNING id INTO v_id;
   ELSE
     SELECT * INTO v_prev FROM public.crawl_targets WHERE id=p_id FOR UPDATE;
     IF NOT FOUND OR v_prev.source_id <> p_source THEN RAISE EXCEPTION 'crawler_invalid'; END IF;
     UPDATE public.crawl_targets SET url=p_url, kind=p_kind, path_prefix=nullif(btrim(p_prefix),''), max_urls=p_max_urls,
       content_selector=nullif(btrim(p_selector),''), active=p_active, render_js=p_render_js, updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
   END IF;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'crawler_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'crawler_invalid';
 END;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'crawl_target.saved',v_id,
   jsonb_build_object('before',to_jsonb(v_prev),'after',jsonb_build_object('source_id',p_source,'url',p_url,'kind',p_kind,'path_prefix',p_prefix,'max_urls',p_max_urls,'content_selector',p_selector,'active',p_active,'render_js',p_render_js)));
 RETURN v_id;
END $$;

-- The worker needs to know which URLs to render. The return type changes,
-- so the function is dropped and recreated with the same grants.
DROP FUNCTION public.crawler_due_targets();
CREATE FUNCTION public.crawler_due_targets()
RETURNS TABLE(target_id uuid, source_id uuid, source_url text, url text, kind text, path_prefix text, max_urls integer, content_selector text, render_js boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id, t.source_id, s.canonical_url, t.url, t.kind, t.path_prefix, t.max_urls, t.content_selector, t.render_js
 FROM public.crawl_targets t JOIN public.sources s ON s.id=t.source_id
 WHERE t.active AND s.crawl_enabled AND s.crawl_policy='approved' AND s.status='verified'
 ORDER BY s.id, t.url
$$;

REVOKE ALL ON FUNCTION public.save_crawl_target(uuid,uuid,text,text,text,integer,text,boolean,boolean), public.crawler_due_targets()
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_crawl_target(uuid,uuid,text,text,text,integer,text,boolean,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crawler_due_targets() TO nordic_crawler_ops;
NOTIFY pgrst, 'reload schema';
COMMIT;
