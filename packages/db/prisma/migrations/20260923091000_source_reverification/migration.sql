BEGIN;

-- Integrity fix (review of Slices 1-4, 2026-09-23).
--
-- Before: save_source set last_verified_at = now() on EVERY save of a row whose
-- status was 'verified' — fixing a typo in the notes silently refreshed the
-- "Last registry verification" date shown publicly (AGENTS.md Section 12: do not
-- describe stale information as current). Saving a non-verified status also
-- set it to NULL, erasing when the source was last checked.
--
-- After:
--   - last_verified_at is stamped (always now(), never client-supplied) only
--     when the row becomes 'verified' or the operator explicitly re-verifies
--     (p_reverify = true).
--   - Other edits keep the previous date. Moving away from 'verified' keeps the
--     historical date too; the status column (not the date) says the row is
--     no longer considered verified.
--   - Changing canonical_url or source_tier of a verified row requires an
--     explicit re-verification, because what was verified is no longer the
--     same claim about the same URL.
-- The old 14-argument function is dropped so PostgREST cannot resolve a call to
-- the previous behaviour through overloading.
DROP FUNCTION public.save_source(uuid,text,text,uuid,text,text,text[],text,text,text,text,boolean,text,text);

CREATE FUNCTION public.save_source(
 p_id uuid, p_name text, p_canonical_url text, p_country_id uuid,
 p_source_tier text, p_source_type text, p_topics text[], p_language text,
 p_authority_notes text, p_status text, p_crawl_policy text, p_crawl_enabled boolean,
 p_crawl_frequency text, p_notes text, p_reverify boolean DEFAULT false
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_before jsonb; v_prev public.sources; v_verified_at timestamptz; v_topics text[];
BEGIN
 IF NOT public.has_permission('sources.manage') THEN RAISE EXCEPTION 'sources_forbidden'; END IF;
 IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_canonical_url IS NULL OR length(p_canonical_url) > 2048
   OR p_canonical_url !~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$' THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_source_tier IS NOT NULL AND p_source_tier NOT IN ('T1','T2','T3','T4') THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_status NOT IN ('needs_verification','verified','review_required') THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_crawl_policy NOT IN ('not_reviewed','approved','blocked') THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_authority_notes IS NOT NULL AND length(p_authority_notes) > 2000 THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_reverify IS NULL THEN RAISE EXCEPTION 'sources_invalid'; END IF;
 IF p_status = 'verified' AND (p_authority_notes IS NULL OR length(trim(p_authority_notes)) = 0) THEN
   RAISE EXCEPTION 'sources_verification_requires_notes';
 END IF;
 IF p_crawl_enabled AND (p_crawl_policy <> 'approved' OR p_status <> 'verified') THEN
   RAISE EXCEPTION 'sources_crawl_requires_approval';
 END IF;
 v_topics := coalesce(p_topics, '{}');
 IF p_id IS NOT NULL THEN
   -- Row lock: two operators saving the same source cannot interleave the
   -- "was it verified before?" decision below.
   SELECT * INTO v_prev FROM public.sources WHERE id = p_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'sources_not_found'; END IF;
   v_before := to_jsonb(v_prev);
   IF p_status = 'verified' AND v_prev.status = 'verified' AND NOT p_reverify
     AND (p_canonical_url IS DISTINCT FROM v_prev.canonical_url OR p_source_tier IS DISTINCT FROM v_prev.source_tier) THEN
     RAISE EXCEPTION 'sources_reverify_required';
   END IF;
   v_verified_at := CASE
     WHEN p_status = 'verified' AND (v_prev.status <> 'verified' OR p_reverify) THEN now()
     ELSE v_prev.last_verified_at END;
   UPDATE public.sources SET
     name = trim(p_name), canonical_url = p_canonical_url, country_id = p_country_id,
     source_tier = p_source_tier, source_type = p_source_type, topics = v_topics, language = p_language,
     authority_notes = p_authority_notes, status = p_status, crawl_policy = p_crawl_policy,
     crawl_enabled = p_crawl_enabled, crawl_frequency = p_crawl_frequency, notes = p_notes,
     last_verified_at = v_verified_at, updated_at = now()
   WHERE id = p_id RETURNING id INTO v_id;
 ELSE
   v_verified_at := CASE WHEN p_status = 'verified' THEN now() ELSE NULL END;
   INSERT INTO public.sources(
     name, canonical_url, country_id, source_tier, source_type, topics, language,
     authority_notes, status, crawl_policy, crawl_enabled, crawl_frequency, notes, last_verified_at
   ) VALUES(
     trim(p_name), p_canonical_url, p_country_id, p_source_tier, p_source_type, v_topics, p_language,
     p_authority_notes, p_status, p_crawl_policy, p_crawl_enabled, p_crawl_frequency, p_notes, v_verified_at
   ) RETURNING id INTO v_id;
 END IF;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(
   auth.uid(), 'source.saved', v_id,
   jsonb_build_object('before', v_before, 'after', jsonb_build_object(
     'name', trim(p_name), 'canonical_url', p_canonical_url, 'status', p_status,
     'crawl_policy', p_crawl_policy, 'crawl_enabled', p_crawl_enabled,
     'reverified', p_reverify, 'last_verified_at', v_verified_at
   ))
 );
 RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.save_source(uuid,text,text,uuid,text,text,text[],text,text,text,text,boolean,text,text,boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_source(uuid,text,text,uuid,text,text,text[],text,text,text,text,boolean,text,text,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
