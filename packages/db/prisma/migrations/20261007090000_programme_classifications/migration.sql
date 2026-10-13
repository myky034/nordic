BEGIN;

-- Slice 11b — classifying programmes by field of study and career path
-- (plan: docs/architecture/field-taxonomy-phase1-plan.md; Decision Log
-- 2026-10-07). Same shape as Slice 5: a classification is an immutable
-- proposal with a document and a verbatim excerpt; a reviewer (facts.review)
-- publishes or rejects it; corrections are a rejection plus a new proposal.
--
-- * One row links ONE programme to ONE ISCED-F field OR ONE career path
--   (two real foreign keys + "exactly one", AGENTS.md §4.5).
-- * Only reviewed Master's and PhD programmes are classified (owner decision
--   2026-10-03: Master's and above).
-- * The excerpt must come from the programme's own site: the document's host
--   must match the programme's official URL host (spec Section 7: the
--   university's page is the evidence, not an aggregator).
-- * A career-path classification records the criteria version it was judged
--   against. When the career path's criteria change, older classifications
--   are listed for re-review; a reviewer revalidates them against the new
--   version or rejects them. Nothing is changed silently (AGENTS.md §4.3).
-- * origin is 'manual' for now; 'crosswalk' and 'ai' are reserved for
--   phase 2 so the table does not have to change.

CREATE TABLE public.programme_classifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 programme_id uuid NOT NULL REFERENCES public.programmes(id) ON DELETE RESTRICT,
 study_field_id uuid REFERENCES public.study_fields(id) ON DELETE RESTRICT,
 career_path_id uuid REFERENCES public.career_paths(id) ON DELETE RESTRICT,
 career_path_version int CHECK(career_path_version IS NULL OR career_path_version >= 1),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL CHECK(length(btrim(evidence_excerpt)) BETWEEN 1 AND 500),
 origin text NOT NULL DEFAULT 'manual' CHECK(origin IN ('manual','crosswalk','ai')),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 CHECK(num_nonnulls(study_field_id,career_path_id) = 1),
 CHECK((career_path_id IS NULL) = (career_path_version IS NULL))
);
-- One live classification per programme and target; a rejected one does not
-- block a corrected proposal.
CREATE UNIQUE INDEX programme_classifications_field_key ON public.programme_classifications(programme_id,study_field_id)
 WHERE study_field_id IS NOT NULL AND status <> 'rejected';
CREATE UNIQUE INDEX programme_classifications_path_key ON public.programme_classifications(programme_id,career_path_id)
 WHERE career_path_id IS NOT NULL AND status <> 'rejected';
CREATE INDEX programme_classifications_status_idx ON public.programme_classifications(status,created_at);
CREATE INDEX programme_classifications_field_idx ON public.programme_classifications(study_field_id) WHERE status='reviewed';
CREATE INDEX programme_classifications_path_idx ON public.programme_classifications(career_path_id) WHERE status='reviewed';

-- Append-only decision log, like education_reviews.
CREATE TABLE public.classification_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 classification_id uuid NOT NULL REFERENCES public.programme_classifications(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('reviewed','rejected','revalidated')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 1000),
 -- The career-path version the decision applies to (NULL for fields).
 career_path_version int,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classification_reviews_created_at_idx ON public.classification_reviews(created_at);

ALTER TABLE public.programme_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programme_classifications,public.classification_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.programme_classifications TO anon,authenticated;
GRANT SELECT ON public.classification_reviews TO authenticated;
-- Public: reviewed, and only while the programme itself is public and the
-- career path (if any) is active. The subqueries run under the reader's own
-- RLS on programmes and career_paths, so the rules cannot drift apart.
CREATE POLICY programme_classifications_public ON public.programme_classifications FOR SELECT TO anon,authenticated
 USING(status='reviewed'
   AND EXISTS(SELECT 1 FROM public.programmes p WHERE p.id=programme_id)
   AND (career_path_id IS NULL OR EXISTS(SELECT 1 FROM public.career_paths c WHERE c.id=career_path_id AND c.active)));
CREATE POLICY programme_classifications_editors ON public.programme_classifications FOR SELECT TO authenticated
 USING(public.has_permission('education.manage') OR public.has_permission('facts.review'));
CREATE POLICY classification_reviews_editors ON public.classification_reviews FOR SELECT TO authenticated
 USING(public.has_permission('education.manage') OR public.has_permission('facts.review'));

-- Host of an http(s) URL, lower-case, without a leading "www.".
CREATE FUNCTION public.url_host(p_url text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT regexp_replace(lower(substring(p_url FROM '^https?://([^/:?#]+)')),'^www\.','')
$$;

CREATE FUNCTION public.propose_classification(p_programme uuid,p_study_field uuid,p_career_path uuid,p_document uuid,p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; v_programme public.programmes; v_doc_host text; v_prog_host text; v_version int;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'classification_forbidden'; END IF;
 IF num_nonnulls(p_study_field,p_career_path) <> 1 OR p_excerpt IS NULL THEN RAISE EXCEPTION 'classification_invalid'; END IF;
 SELECT * INTO v_programme FROM public.programmes WHERE id=p_programme;
 IF NOT FOUND OR v_programme.status<>'reviewed' OR v_programme.degree_type NOT IN ('master','phd') THEN
   RAISE EXCEPTION 'classification_programme_ineligible';
 END IF;
 -- "99 Field unknown" says nothing about a programme; it is never a classification.
 IF p_study_field IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.study_fields WHERE id=p_study_field AND code NOT LIKE '99%') THEN
   RAISE EXCEPTION 'classification_invalid';
 END IF;
 IF p_career_path IS NOT NULL THEN
   SELECT version INTO v_version FROM public.career_paths WHERE id=p_career_path AND active;
   IF NOT FOUND THEN RAISE EXCEPTION 'classification_career_path_retired'; END IF;
 END IF;
 SELECT public.url_host(canonical_url) INTO v_doc_host FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'classification_document_missing'; END IF;
 v_prog_host := public.url_host(v_programme.official_url);
 IF v_doc_host IS NULL OR v_prog_host IS NULL OR NOT (v_doc_host=v_prog_host OR v_doc_host LIKE '%.'||v_prog_host OR v_prog_host LIKE '%.'||v_doc_host) THEN
   RAISE EXCEPTION 'classification_document_mismatch';
 END IF;
 BEGIN
   INSERT INTO public.programme_classifications(programme_id,study_field_id,career_path_id,career_path_version,document_id,evidence_excerpt,created_by)
   VALUES(p_programme,p_study_field,p_career_path,v_version,p_document,btrim(p_excerpt),auth.uid()) RETURNING id INTO result;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'classification_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'classification_invalid';
 END;
 RETURN result;
END $$;

-- Decisions:
-- * proposed  -> reviewed | rejected (a career path is judged against its
--   current criteria, so the stored version becomes the current one);
-- * reviewed  -> revalidated (career path whose criteria changed since; the
--   stored version becomes the current one) | rejected (withdrawn);
-- * rejected  -> nothing (propose again instead).
CREATE FUNCTION public.review_classification(p_id uuid,p_decision text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.programme_classifications; v_current int; v_active boolean;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'classification_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_decision IS NULL OR p_decision NOT IN ('reviewed','rejected','revalidated') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'classification_invalid';
 END IF;
 SELECT * INTO c FROM public.programme_classifications WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'classification_missing'; END IF;
 IF c.career_path_id IS NOT NULL THEN
   SELECT version,active INTO v_current,v_active FROM public.career_paths WHERE id=c.career_path_id;
 END IF;
 IF c.status='proposed' AND p_decision IN ('reviewed','rejected') THEN
   IF p_decision='reviewed' THEN
     IF c.career_path_id IS NOT NULL AND NOT v_active THEN RAISE EXCEPTION 'classification_career_path_retired'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.programmes WHERE id=c.programme_id AND status='reviewed' AND degree_type IN ('master','phd')) THEN
       RAISE EXCEPTION 'classification_programme_ineligible';
     END IF;
   END IF;
   UPDATE public.programme_classifications SET status=p_decision,reviewed_at=CASE WHEN p_decision='reviewed' THEN now() END,
     career_path_version=CASE WHEN career_path_id IS NOT NULL THEN v_current END WHERE id=p_id;
 ELSIF c.status='reviewed' AND p_decision='revalidated' THEN
   IF c.career_path_id IS NULL OR c.career_path_version >= v_current THEN RAISE EXCEPTION 'classification_not_stale'; END IF;
   IF NOT v_active THEN RAISE EXCEPTION 'classification_career_path_retired'; END IF;
   UPDATE public.programme_classifications SET career_path_version=v_current,reviewed_at=now() WHERE id=p_id;
 ELSIF c.status='reviewed' AND p_decision='rejected' THEN
   UPDATE public.programme_classifications SET status='rejected' WHERE id=p_id;
 ELSE
   RAISE EXCEPTION 'classification_already_decided';
 END IF;
 INSERT INTO public.classification_reviews(classification_id,actor_id,decision,note,career_path_version)
 VALUES(p_id,auth.uid(),p_decision,btrim(p_note),CASE WHEN c.career_path_id IS NOT NULL THEN v_current END);
END $$;

REVOKE ALL ON FUNCTION public.url_host(text),
 public.propose_classification(uuid,uuid,uuid,uuid,text),
 public.review_classification(uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.propose_classification(uuid,uuid,uuid,uuid,text),
 public.review_classification(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
