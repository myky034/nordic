BEGIN;

-- L7a — versions of one page are one page for facts
-- (docs/architecture/page-versions-plan.md; Decision Log 2026-10-15; Linear KHLOE-159).
--
-- D1 page_documents(): every stored version of the page a document belongs to
--    (same source + same registered URL).
-- D2 fact_duplicate_of(): the L5 rule, now across all versions of the page.
-- D3 resolve_source_change('revalidated'): the fact MOVES to the new version
--    when its excerpt is verbatim there; the previous evidence goes to an
--    append-only evidence_history. Revises Slice 9 ("never re-sourced").
-- D4 resolve_source_change('superseded', related): withdrawn because a named
--    fact on the same page now says it.

-- ---------------------------------------------------------------- D1 versions of a page

CREATE FUNCTION public.page_documents(p_document uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT v.id FROM public.documents d JOIN public.documents v ON v.source_id = d.source_id AND v.canonical_url = d.canonical_url
 WHERE d.id = p_document
$$;

-- ---------------------------------------------------------------- D2 duplicates across versions

CREATE OR REPLACE FUNCTION public.fact_duplicate_of(p_document uuid, p_subject text, p_predicate text, p_value text, p_fact_type uuid, p_excerpt text)
RETURNS uuid LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT f.id FROM public.facts f
 WHERE f.document_id IN (SELECT public.page_documents(p_document)) AND f.status <> 'rejected' AND (
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

-- ---------------------------------------------------------------- D3 evidence history

-- What a fact's evidence pointed to before it moved to a newer page version.
-- Append-only: written only by resolve_source_change(), never updated.
CREATE TABLE public.evidence_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE RESTRICT,
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 source_url text NOT NULL,
 excerpt text NOT NULL,
 retrieved_at timestamptz NOT NULL,
 replaced_by_document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_history_fact_idx ON public.evidence_history(fact_id, created_at);
ALTER TABLE public.evidence_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.evidence_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evidence_history TO authenticated;
CREATE POLICY evidence_history_editors ON public.evidence_history FOR SELECT TO authenticated
 USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));

-- ---------------------------------------------------------------- D4 new decision

ALTER TABLE public.fact_reviews DROP CONSTRAINT fact_reviews_decision_check;
ALTER TABLE public.fact_reviews ADD CONSTRAINT fact_reviews_decision_check
 CHECK(decision IN ('reviewed','rejected','conflicted','revalidated','superseded'));

-- ---------------------------------------------------------------- D3 + D4 reviewer decision

DROP FUNCTION public.resolve_source_change(uuid,text,text);
CREATE FUNCTION public.resolve_source_change(p_fact uuid, p_decision text, p_note text, p_related uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.facts; e public.evidence; v_new public.documents; v_text text; r public.facts;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 SELECT * INTO f FROM public.facts WHERE id=p_fact FOR UPDATE;
 IF NOT FOUND OR f.source_changed_at IS NULL THEN RAISE EXCEPTION 'facts_not_flagged'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('revalidated','rejected','superseded') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'facts_invalid';
 END IF;

 IF p_decision = 'revalidated' THEN
   -- The claim still holds on the new version: move it there, but only if the
   -- excerpt is verbatim in the new version's text (the same check as for
   -- every proposal). The old evidence is kept in evidence_history.
   SELECT * INTO v_new FROM public.documents WHERE id=f.source_changed_document_id;
   SELECT text INTO v_text FROM public.document_texts WHERE document_id=f.source_changed_document_id;
   SELECT * INTO e FROM public.evidence WHERE fact_id=f.id;
   IF v_new.id IS NULL OR v_text IS NULL
      OR position(public.extraction_norm(e.excerpt) IN public.extraction_norm(v_text)) = 0 THEN
     RAISE EXCEPTION 'facts_excerpt_not_in_new_version';
   END IF;
   INSERT INTO public.evidence_history(fact_id,document_id,source_url,excerpt,retrieved_at,replaced_by_document_id,actor_id)
   VALUES(f.id,e.document_id,e.source_url,e.excerpt,e.retrieved_at,v_new.id,auth.uid());
   UPDATE public.evidence SET document_id=v_new.id, source_url=v_new.canonical_url, retrieved_at=v_new.retrieved_at WHERE id=e.id;
   UPDATE public.facts SET document_id=v_new.id, source_changed_at=NULL, source_changed_document_id=NULL WHERE id=f.id;
   INSERT INTO public.fact_reviews(fact_id,actor_id,decision,note) VALUES(f.id,auth.uid(),'revalidated',btrim(p_note));

 ELSIF p_decision = 'superseded' THEN
   -- Another fact from the same page now states this; the link is recorded.
   SELECT * INTO r FROM public.facts WHERE id=p_related;
   IF p_related IS NULL OR p_related = f.id OR r.id IS NULL OR r.status = 'rejected'
      OR r.document_id NOT IN (SELECT public.page_documents(f.document_id)) THEN
     RAISE EXCEPTION 'facts_invalid';
   END IF;
   UPDATE public.facts SET status='rejected', source_changed_at=NULL, source_changed_document_id=NULL WHERE id=f.id;
   INSERT INTO public.fact_reviews(fact_id,actor_id,decision,note,related_fact_id) VALUES(f.id,auth.uid(),'superseded',btrim(p_note),p_related);

 ELSE
   UPDATE public.facts SET status='rejected', source_changed_at=NULL, source_changed_document_id=NULL WHERE id=f.id;
   INSERT INTO public.fact_reviews(fact_id,actor_id,decision,note) VALUES(f.id,auth.uid(),'rejected',btrim(p_note));
 END IF;
END $$;

REVOKE ALL ON FUNCTION public.page_documents(uuid), public.resolve_source_change(uuid,text,text,uuid)
 FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resolve_source_change(uuid,text,text,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
