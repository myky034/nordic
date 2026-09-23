BEGIN;

-- Completes Slice 2: sources.propose is intentionally not created. Registry
-- write access has always been meant to be gated the same way RBAC and Facts
-- write access are (see 20260918100000_rbac and 20260919090000_facts): a
-- catalogue permission plus a SECURITY DEFINER RPC, never a direct RLS write
-- policy on the table.
INSERT INTO public.permissions(key,description) VALUES
 ('sources.manage','Add, edit, and enable/disable crawling for registry sources');

-- Give existing complete administrators the new capability, the same rule
-- used when facts.propose/facts.review were added: no user identity or
-- mutable role name is referenced, only roles that already hold both RBAC
-- management permissions. Other role grants remain operator-configured.
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE p.key='sources.manage'
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

-- Single entry point for both create and edit. p_id NULL creates a row.
-- last_verified_at is never a client-supplied value — only this function may
-- set it, and only to now(), so "verified" always means "an operator with
-- sources.manage confirmed this row just now", never a client-chosen date.
CREATE FUNCTION public.save_source(
 p_id uuid, p_name text, p_canonical_url text, p_country_id uuid,
 p_source_tier text, p_source_type text, p_topics text[], p_language text,
 p_authority_notes text, p_status text, p_crawl_policy text, p_crawl_enabled boolean,
 p_crawl_frequency text, p_notes text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_before jsonb; v_verified_at timestamptz; v_topics text[];
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
 -- Mirrors sources_review_check: give a clear error instead of a raw constraint violation.
 IF p_status = 'verified' AND (p_authority_notes IS NULL OR length(trim(p_authority_notes)) = 0) THEN
   RAISE EXCEPTION 'sources_verification_requires_notes';
 END IF;
 -- Mirrors sources_crawl_check.
 IF p_crawl_enabled AND (p_crawl_policy <> 'approved' OR p_status <> 'verified') THEN
   RAISE EXCEPTION 'sources_crawl_requires_approval';
 END IF;
 v_verified_at := CASE WHEN p_status = 'verified' THEN now() ELSE NULL END;
 v_topics := coalesce(p_topics, '{}');
 IF p_id IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.sources WHERE id = p_id) THEN RAISE EXCEPTION 'sources_not_found'; END IF;
   SELECT to_jsonb(s) INTO v_before FROM public.sources s WHERE id = p_id;
   UPDATE public.sources SET
     name = trim(p_name), canonical_url = p_canonical_url, country_id = p_country_id,
     source_tier = p_source_tier, source_type = p_source_type, topics = v_topics, language = p_language,
     authority_notes = p_authority_notes, status = p_status, crawl_policy = p_crawl_policy,
     crawl_enabled = p_crawl_enabled, crawl_frequency = p_crawl_frequency, notes = p_notes,
     last_verified_at = v_verified_at, updated_at = now()
   WHERE id = p_id RETURNING id INTO v_id;
 ELSE
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
     'crawl_policy', p_crawl_policy, 'crawl_enabled', p_crawl_enabled
   ))
 );
 RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.save_source(uuid,text,text,uuid,text,text,text[],text,text,text,text,boolean,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_source(uuid,text,text,uuid,text,text,text[],text,text,text,text,boolean,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
