-- PROPOSED MIGRATION (NOT APPLIED) · L7b-1a' · KHLOE-167 (scope per V3)
-- Review copy only; outside prisma/migrations so `prisma migrate deploy` never sees it.
--
-- Reference tables for intake identity, official pages (shared pages, several
-- programmes per page) and applicant groups with HUMAN-REVIEWED label mappings.
-- Does NOT touch public.facts: the 58 existing facts are unchanged (gate condition 10).
-- Writes only through SECURITY DEFINER functions; every decision is logged in
-- l7b_reviews and access_audit (gate conditions 2, 11). Uniqueness on nullable
-- columns uses NULLS NOT DISTINCT (gate condition 8; PostgreSQL ≥ 15, production 17.6).
BEGIN;

-- ------------------------------------------------------------ helpers
-- The excerpt must be in the stored text of the document (same rule as propose_fact, L5 Q4),
-- and this text must exist: reference records are never accepted without readable evidence.
CREATE FUNCTION public.l7b_excerpt_in_document(p_document uuid, p_excerpt text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_excerpt IS NOT NULL AND length(btrim(p_excerpt)) BETWEEN 3 AND 500
   AND EXISTS (SELECT 1 FROM public.document_texts t WHERE t.document_id = p_document
               AND position(public.extraction_norm(p_excerpt) IN public.extraction_norm(t.text)) > 0)
$$;

-- ------------------------------------------------------------ programme identity
ALTER TABLE public.programmes
 ADD COLUMN programme_code text CHECK (programme_code IS NULL OR programme_code ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$'),
 ADD COLUMN programme_code_document_id uuid REFERENCES public.documents(id) ON DELETE RESTRICT,
 ADD COLUMN programme_code_excerpt text,
 ADD CONSTRAINT programmes_code_evidence CHECK (num_nonnulls(programme_code, programme_code_document_id, programme_code_excerpt) IN (0, 3));
-- D4: a code helps matching but never merges programmes; one code per university among non-rejected programmes.
CREATE UNIQUE INDEX programmes_code_key ON public.programmes (university_id, upper(programme_code))
 WHERE programme_code IS NOT NULL AND status <> 'rejected';

-- ------------------------------------------------------------ intakes (D1)
CREATE TABLE public.programme_intakes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE RESTRICT,
 start_year int NOT NULL CHECK (start_year BETWEEN 2000 AND 2100),
 start_term text CHECK (start_term IN ('spring','summer','autumn','winter')),
 start_month int CHECK (start_month BETWEEN 1 AND 12),
 variant text CHECK (variant IS NULL OR length(btrim(variant)) BETWEEN 1 AND 80),
 source_code text CHECK (source_code IS NULL OR length(btrim(source_code)) BETWEEN 1 AND 40),
 label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL,
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 -- A year alone is not an intake (D1); a variant is a separate offering only with its own code.
 CONSTRAINT programme_intakes_when CHECK (start_term IS NOT NULL OR start_month IS NOT NULL),
 CONSTRAINT programme_intakes_variant_needs_code CHECK (variant IS NULL OR source_code IS NOT NULL),
 CONSTRAINT programme_intakes_id_programme UNIQUE (id, programme_id)
);
CREATE UNIQUE INDEX programme_intakes_identity ON public.programme_intakes
 (programme_id, start_year, start_term, start_month, variant) NULLS NOT DISTINCT WHERE status <> 'rejected';
CREATE UNIQUE INDEX programme_intakes_code ON public.programme_intakes (programme_id, source_code)
 WHERE source_code IS NOT NULL AND status <> 'rejected';

-- ------------------------------------------------------------ official pages (X3)
CREATE TABLE public.official_pages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE RESTRICT,
 url text NOT NULL CHECK (url ~ '^https?://' AND length(url) <= 2000),
 university_id uuid REFERENCES public.universities(id) ON DELETE RESTRICT,
 country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
 role text NOT NULL CHECK (role IN ('programme','intake','fees','admissions','curriculum','portal')),
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 -- Exactly one owner: a university, or a country (national portal; X6: supported, not yet authorized).
 CONSTRAINT official_pages_one_owner CHECK (num_nonnulls(university_id, country_id) = 1),
 CONSTRAINT official_pages_portal_owner CHECK (role <> 'portal' OR country_id IS NOT NULL)
);
CREATE UNIQUE INDEX official_pages_key ON public.official_pages (source_id, public.page_key(url)) WHERE status <> 'rejected';

CREATE TABLE public.official_page_links (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 page_id uuid NOT NULL REFERENCES public.official_pages(id) ON DELETE RESTRICT,
 programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE RESTRICT,
 intake_id uuid,
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 -- MATCH SIMPLE: skipped when intake_id is NULL (a page for the whole programme), enforced otherwise.
 CONSTRAINT official_page_links_intake_fk FOREIGN KEY (intake_id, programme_id)
   REFERENCES public.programme_intakes(id, programme_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX official_page_links_key ON public.official_page_links (page_id, programme_id, intake_id)
 NULLS NOT DISTINCT WHERE status <> 'rejected';

-- ------------------------------------------------------------ applicant groups (X1, V1)
CREATE TABLE public.applicant_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,   -- NULL = not country-specific
 code text NOT NULL CHECK (code ~ '^[a-z][a-z0-9_]{2,40}$'),
 basis text NOT NULL CHECK (basis IN ('citizenship','residence','prior_education','other')),
 label_vi text NOT NULL CHECK (length(btrim(label_vi)) BETWEEN 1 AND 200),
 label_en text NOT NULL CHECK (length(btrim(label_en)) BETWEEN 1 AND 200),
 definition_vi text NOT NULL CHECK (length(btrim(definition_vi)) BETWEEN 1 AND 1000),
 definition_en text NOT NULL CHECK (length(btrim(definition_en)) BETWEEN 1 AND 1000),
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz
);
CREATE UNIQUE INDEX applicant_groups_code ON public.applicant_groups (country_id, code) NULLS NOT DISTINCT WHERE status <> 'rejected';

-- Raw label → group, per source. Only REVIEWED aliases are used; a new label stays unmapped.
CREATE TABLE public.applicant_group_aliases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES public.sources(id) ON DELETE RESTRICT,
 label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 200),
 label_norm text GENERATED ALWAYS AS (lower(regexp_replace(btrim(label), '\s+', ' ', 'g'))) STORED,
 applicant_group_id uuid NOT NULL REFERENCES public.applicant_groups(id) ON DELETE RESTRICT,
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL,
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz
);
CREATE UNIQUE INDEX applicant_group_aliases_key ON public.applicant_group_aliases (source_id, label_norm) WHERE status <> 'rejected';

-- ------------------------------------------------------------ review log (append-only)
CREATE TABLE public.l7b_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 intake_id uuid REFERENCES public.programme_intakes(id) ON DELETE RESTRICT,
 page_id uuid REFERENCES public.official_pages(id) ON DELETE RESTRICT,
 page_link_id uuid REFERENCES public.official_page_links(id) ON DELETE RESTRICT,
 applicant_group_id uuid REFERENCES public.applicant_groups(id) ON DELETE RESTRICT,
 alias_id uuid REFERENCES public.applicant_group_aliases(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK (decision IN ('reviewed','rejected')),
 note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT l7b_reviews_one_target CHECK (num_nonnulls(intake_id, page_id, page_link_id, applicant_group_id, alias_id) = 1)
);

-- ------------------------------------------------------------ RLS (read only; writes via functions)
ALTER TABLE public.programme_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.official_page_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applicant_group_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.l7b_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programme_intakes, public.official_pages, public.official_page_links, public.applicant_groups,
  public.applicant_group_aliases, public.l7b_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.programme_intakes, public.official_pages, public.official_page_links, public.applicant_groups TO anon, authenticated;
GRANT SELECT ON public.applicant_group_aliases, public.l7b_reviews TO authenticated;

CREATE FUNCTION public.l7b_editor() RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT public.has_permission('education.manage') OR public.has_permission('facts.propose') OR public.has_permission('facts.review')
$$;

CREATE POLICY programme_intakes_public ON public.programme_intakes FOR SELECT TO anon, authenticated USING (
 status = 'reviewed' AND EXISTS (SELECT 1 FROM public.programmes p JOIN public.universities u ON u.id = p.university_id
   WHERE p.id = programme_id AND p.status = 'reviewed' AND u.status = 'reviewed'));
CREATE POLICY programme_intakes_editors ON public.programme_intakes FOR SELECT TO authenticated USING (public.l7b_editor());

CREATE POLICY official_pages_public ON public.official_pages FOR SELECT TO anon, authenticated USING (
 status = 'reviewed' AND (country_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.universities u WHERE u.id = university_id AND u.status = 'reviewed')));
CREATE POLICY official_pages_editors ON public.official_pages FOR SELECT TO authenticated USING (public.l7b_editor());

CREATE POLICY official_page_links_public ON public.official_page_links FOR SELECT TO anon, authenticated USING (
 status = 'reviewed'
 AND EXISTS (SELECT 1 FROM public.official_pages g WHERE g.id = page_id AND g.status = 'reviewed')
 AND EXISTS (SELECT 1 FROM public.programmes p JOIN public.universities u ON u.id = p.university_id
   WHERE p.id = programme_id AND p.status = 'reviewed' AND u.status = 'reviewed'));
CREATE POLICY official_page_links_editors ON public.official_page_links FOR SELECT TO authenticated USING (public.l7b_editor());

CREATE POLICY applicant_groups_public ON public.applicant_groups FOR SELECT TO anon, authenticated USING (status = 'reviewed');
CREATE POLICY applicant_groups_editors ON public.applicant_groups FOR SELECT TO authenticated USING (public.l7b_editor());
CREATE POLICY applicant_group_aliases_editors ON public.applicant_group_aliases FOR SELECT TO authenticated USING (public.l7b_editor());
CREATE POLICY l7b_reviews_editors ON public.l7b_reviews FOR SELECT TO authenticated
 USING (public.has_permission('education.manage') OR public.has_permission('facts.review'));

-- ------------------------------------------------------------ write functions
CREATE FUNCTION public.propose_programme_intake(p_programme uuid, p_year int, p_term text, p_month int, p_variant text,
  p_source_code text, p_label text, p_document uuid, p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.programmes WHERE id = p_programme AND status <> 'rejected') THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 IF NOT public.l7b_excerpt_in_document(p_document, p_excerpt) THEN RAISE EXCEPTION 'l7b_excerpt_not_in_document'; END IF;
 -- The label is what the source states ("Autumn 2027"); it must be inside the excerpt.
 IF p_label IS NULL OR position(public.extraction_norm(p_label) IN public.extraction_norm(p_excerpt)) = 0 THEN RAISE EXCEPTION 'l7b_label_not_in_excerpt'; END IF;
 BEGIN
   INSERT INTO public.programme_intakes(programme_id, start_year, start_term, start_month, variant, source_code, label, document_id, evidence_excerpt, created_by)
   VALUES (p_programme, p_year, p_term, p_month, nullif(btrim(p_variant), ''), nullif(btrim(p_source_code), ''), btrim(p_label), p_document, btrim(p_excerpt), auth.uid())
   RETURNING id INTO v_id;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'l7b_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'l7b_invalid';
 END;
 INSERT INTO public.access_audit(actor_id, action, target_id, details) VALUES (auth.uid(), 'intake.proposed', v_id,
   jsonb_build_object('programme_id', p_programme, 'year', p_year, 'term', p_term, 'month', p_month, 'variant', p_variant, 'source_code', p_source_code));
 RETURN v_id;
END $$;

CREATE FUNCTION public.propose_official_page(p_source uuid, p_url text, p_university uuid, p_country uuid, p_role text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; s public.sources;
BEGIN
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 SELECT * INTO s FROM public.sources WHERE id = p_source;
 -- V3: only verified sources; the page must be on the source's own origin.
 IF NOT FOUND OR s.status <> 'verified' THEN RAISE EXCEPTION 'l7b_source_not_verified'; END IF;
 IF public.url_origin(p_url) IS DISTINCT FROM public.url_origin(s.canonical_url) THEN RAISE EXCEPTION 'l7b_url_not_source'; END IF;
 IF p_university IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.universities WHERE id = p_university AND status <> 'rejected') THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 BEGIN
   INSERT INTO public.official_pages(source_id, url, university_id, country_id, role, created_by)
   VALUES (p_source, btrim(p_url), p_university, p_country, p_role, auth.uid()) RETURNING id INTO v_id;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'l7b_duplicate';
   WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'l7b_invalid';
 END;
 INSERT INTO public.access_audit(actor_id, action, target_id, details) VALUES (auth.uid(), 'official_page.proposed', v_id,
   jsonb_build_object('source_id', p_source, 'url', p_url, 'university_id', p_university, 'country_id', p_country, 'role', p_role));
 RETURN v_id;
END $$;

CREATE FUNCTION public.propose_official_page_link(p_page uuid, p_programme uuid, p_intake uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; g public.official_pages; v_university uuid; v_country uuid;
BEGIN
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 SELECT * INTO g FROM public.official_pages WHERE id = p_page AND status <> 'rejected';
 IF NOT FOUND THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 SELECT p.university_id, u.country_id INTO v_university, v_country FROM public.programmes p JOIN public.universities u ON u.id = p.university_id
  WHERE p.id = p_programme AND p.status <> 'rejected';
 IF v_university IS NULL THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 -- A university's page can only describe its own programmes; a portal only programmes of its country.
 IF (g.university_id IS NOT NULL AND g.university_id <> v_university) OR (g.country_id IS NOT NULL AND g.country_id <> v_country) THEN
   RAISE EXCEPTION 'l7b_page_owner_mismatch';
 END IF;
 IF g.role = 'intake' AND p_intake IS NULL THEN RAISE EXCEPTION 'l7b_intake_required'; END IF;
 BEGIN
   INSERT INTO public.official_page_links(page_id, programme_id, intake_id, created_by) VALUES (p_page, p_programme, p_intake, auth.uid()) RETURNING id INTO v_id;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'l7b_duplicate';
   WHEN foreign_key_violation THEN RAISE EXCEPTION 'l7b_intake_not_of_programme';
 END;
 INSERT INTO public.access_audit(actor_id, action, target_id, details) VALUES (auth.uid(), 'official_page_link.proposed', v_id,
   jsonb_build_object('page_id', p_page, 'programme_id', p_programme, 'intake_id', p_intake));
 RETURN v_id;
END $$;

CREATE FUNCTION public.propose_applicant_group(p_country uuid, p_code text, p_basis text, p_label_vi text, p_label_en text,
  p_definition_vi text, p_definition_en text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 BEGIN
   INSERT INTO public.applicant_groups(country_id, code, basis, label_vi, label_en, definition_vi, definition_en, created_by)
   VALUES (p_country, p_code, p_basis, btrim(p_label_vi), btrim(p_label_en), btrim(p_definition_vi), btrim(p_definition_en), auth.uid())
   RETURNING id INTO v_id;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'l7b_duplicate';
   WHEN check_violation OR foreign_key_violation OR not_null_violation THEN RAISE EXCEPTION 'l7b_invalid';
 END;
 INSERT INTO public.access_audit(actor_id, action, target_id, details) VALUES (auth.uid(), 'applicant_group.proposed', v_id,
   jsonb_build_object('country_id', p_country, 'code', p_code, 'basis', p_basis));
 RETURN v_id;
END $$;

CREATE FUNCTION public.propose_applicant_group_alias(p_source uuid, p_label text, p_group uuid, p_document uuid, p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT (public.has_permission('education.manage') OR public.has_permission('facts.propose')) THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 -- The label is quoted from a document of THAT source, inside the excerpt.
 IF NOT EXISTS (SELECT 1 FROM public.documents WHERE id = p_document AND source_id = p_source) THEN RAISE EXCEPTION 'l7b_document_not_of_source'; END IF;
 IF NOT public.l7b_excerpt_in_document(p_document, p_excerpt) THEN RAISE EXCEPTION 'l7b_excerpt_not_in_document'; END IF;
 IF p_label IS NULL OR position(public.extraction_norm(p_label) IN public.extraction_norm(p_excerpt)) = 0 THEN RAISE EXCEPTION 'l7b_label_not_in_excerpt'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.applicant_groups WHERE id = p_group AND status <> 'rejected') THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 BEGIN
   INSERT INTO public.applicant_group_aliases(source_id, label, applicant_group_id, document_id, evidence_excerpt, created_by)
   VALUES (p_source, btrim(p_label), p_group, p_document, btrim(p_excerpt), auth.uid()) RETURNING id INTO v_id;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'l7b_duplicate';
 END;
 INSERT INTO public.access_audit(actor_id, action, target_id, details) VALUES (auth.uid(), 'applicant_group_alias.proposed', v_id,
   jsonb_build_object('source_id', p_source, 'label', p_label, 'applicant_group_id', p_group));
 RETURN v_id;
END $$;

CREATE FUNCTION public.set_programme_code(p_programme uuid, p_code text, p_document uuid, p_excerpt text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_before text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 SELECT programme_code INTO v_before FROM public.programmes WHERE id = p_programme AND status <> 'rejected' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'l7b_invalid'; END IF;
 IF p_code IS NOT NULL THEN
   IF NOT public.l7b_excerpt_in_document(p_document, p_excerpt) THEN RAISE EXCEPTION 'l7b_excerpt_not_in_document'; END IF;
   IF position(public.extraction_norm(p_code) IN public.extraction_norm(p_excerpt)) = 0 THEN RAISE EXCEPTION 'l7b_label_not_in_excerpt'; END IF;
 END IF;
 BEGIN
   UPDATE public.programmes SET programme_code = btrim(p_code),
     programme_code_document_id = CASE WHEN p_code IS NULL THEN NULL ELSE p_document END,
     programme_code_excerpt = CASE WHEN p_code IS NULL THEN NULL ELSE btrim(p_excerpt) END
   WHERE id = p_programme;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'l7b_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'l7b_invalid';
 END;
 INSERT INTO public.access_audit(actor_id, action, target_id, details) VALUES (auth.uid(), 'programme_code.set', p_programme,
   jsonb_build_object('before', v_before, 'after', p_code, 'document_id', p_document, 'note', btrim(p_note)));
END $$;

-- One review function for every L7b record; parents must be reviewed first.
CREATE FUNCTION public.review_l7b(p_kind text, p_id uuid, p_decision text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_ok boolean := true;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'l7b_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_decision IS NULL OR p_decision NOT IN ('reviewed','rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'l7b_invalid';
 END IF;
 IF p_kind = 'intake' THEN
   SELECT i.status, (p.status = 'reviewed') INTO v_status, v_ok FROM public.programme_intakes i JOIN public.programmes p ON p.id = i.programme_id WHERE i.id = p_id FOR UPDATE OF i;
 ELSIF p_kind = 'page' THEN
   SELECT g.status, (s.status = 'verified' AND (g.country_id IS NOT NULL OR u.status = 'reviewed')) INTO v_status, v_ok
   FROM public.official_pages g JOIN public.sources s ON s.id = g.source_id LEFT JOIN public.universities u ON u.id = g.university_id WHERE g.id = p_id FOR UPDATE OF g;
 ELSIF p_kind = 'page_link' THEN
   SELECT l.status, (g.status = 'reviewed' AND p.status = 'reviewed' AND (l.intake_id IS NULL OR i.status = 'reviewed')) INTO v_status, v_ok
   FROM public.official_page_links l JOIN public.official_pages g ON g.id = l.page_id JOIN public.programmes p ON p.id = l.programme_id
   LEFT JOIN public.programme_intakes i ON i.id = l.intake_id WHERE l.id = p_id FOR UPDATE OF l;
 ELSIF p_kind = 'applicant_group' THEN
   SELECT status INTO v_status FROM public.applicant_groups WHERE id = p_id FOR UPDATE;
 ELSIF p_kind = 'applicant_group_alias' THEN
   SELECT a.status, (g.status = 'reviewed') INTO v_status, v_ok FROM public.applicant_group_aliases a JOIN public.applicant_groups g ON g.id = a.applicant_group_id WHERE a.id = p_id FOR UPDATE OF a;
 ELSE
   RAISE EXCEPTION 'l7b_invalid';
 END IF;
 IF v_status IS NULL THEN RAISE EXCEPTION 'l7b_missing'; END IF;
 IF v_status <> 'proposed' THEN RAISE EXCEPTION 'l7b_already_decided'; END IF;
 IF p_decision = 'reviewed' AND NOT coalesce(v_ok, false) THEN RAISE EXCEPTION 'l7b_parent_unreviewed'; END IF;
 IF p_kind = 'intake' THEN
   UPDATE public.programme_intakes SET status = p_decision, reviewed_at = CASE WHEN p_decision = 'reviewed' THEN now() END WHERE id = p_id;
   INSERT INTO public.l7b_reviews(intake_id, actor_id, decision, note) VALUES (p_id, auth.uid(), p_decision, btrim(p_note));
 ELSIF p_kind = 'page' THEN
   UPDATE public.official_pages SET status = p_decision, reviewed_at = CASE WHEN p_decision = 'reviewed' THEN now() END WHERE id = p_id;
   INSERT INTO public.l7b_reviews(page_id, actor_id, decision, note) VALUES (p_id, auth.uid(), p_decision, btrim(p_note));
 ELSIF p_kind = 'page_link' THEN
   UPDATE public.official_page_links SET status = p_decision, reviewed_at = CASE WHEN p_decision = 'reviewed' THEN now() END WHERE id = p_id;
   INSERT INTO public.l7b_reviews(page_link_id, actor_id, decision, note) VALUES (p_id, auth.uid(), p_decision, btrim(p_note));
 ELSIF p_kind = 'applicant_group' THEN
   UPDATE public.applicant_groups SET status = p_decision, reviewed_at = CASE WHEN p_decision = 'reviewed' THEN now() END WHERE id = p_id;
   INSERT INTO public.l7b_reviews(applicant_group_id, actor_id, decision, note) VALUES (p_id, auth.uid(), p_decision, btrim(p_note));
 ELSE
   UPDATE public.applicant_group_aliases SET status = p_decision, reviewed_at = CASE WHEN p_decision = 'reviewed' THEN now() END WHERE id = p_id;
   INSERT INTO public.l7b_reviews(alias_id, actor_id, decision, note) VALUES (p_id, auth.uid(), p_decision, btrim(p_note));
 END IF;
END $$;

REVOKE ALL ON FUNCTION public.l7b_excerpt_in_document(uuid, text), public.l7b_editor(),
  public.propose_programme_intake(uuid, int, text, int, text, text, text, uuid, text),
  public.propose_official_page(uuid, text, uuid, uuid, text), public.propose_official_page_link(uuid, uuid, uuid),
  public.propose_applicant_group(uuid, text, text, text, text, text, text),
  public.propose_applicant_group_alias(uuid, text, uuid, uuid, text),
  public.set_programme_code(uuid, text, uuid, text, text), public.review_l7b(text, uuid, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.l7b_editor(),
  public.propose_programme_intake(uuid, int, text, int, text, text, text, uuid, text),
  public.propose_official_page(uuid, text, uuid, uuid, text), public.propose_official_page_link(uuid, uuid, uuid),
  public.propose_applicant_group(uuid, text, text, text, text, text, text),
  public.propose_applicant_group_alias(uuid, text, uuid, uuid, text),
  public.set_programme_code(uuid, text, uuid, text, text), public.review_l7b(text, uuid, text, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
