BEGIN;

-- PR 1 — structured snapshots of crawled pages, stored next to the readable
-- text (docs/architecture/pr1-structured-content-plan.md, design v2 approved
-- 2026-10-15; Linear KHLOE-161). Additive only: documents, document_texts,
-- crawler_record() and every existing policy are unchanged.
--
-- A document version is created only when the normalised TEXT changes
-- (sha256-text-v1). Links, tables or attributes can change without that, so a
-- structure is not keyed by document alone: each capture whose content differs
-- from the capture just before it in time is a new row (history kept).
-- "Latest" has ONE definition, the view document_structures_latest:
-- captured_at, then created_at, then id, all descending. Captures recorded out
-- of order (an older capture arriving late) therefore never become the latest.

CREATE TABLE public.document_structures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
 format_version text NOT NULL CHECK (format_version IN ('html-structure-v1')),
 structure jsonb NOT NULL CHECK (jsonb_typeof(structure) = 'object' AND pg_column_size(structure) <= 1048576),
 -- Computed by the database from the jsonb value (keys in jsonb's own order),
 -- never taken from the crawler.
 structure_hash varchar(64) NOT NULL CHECK (structure_hash ~ '^[0-9a-f]{64}$'),
 captured_at timestamptz NOT NULL,
 crawler_run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 -- A retried or concurrent call with the same capture is a no-op.
 UNIQUE (document_id, format_version, structure_hash, captured_at)
);
CREATE INDEX document_structures_latest_idx ON public.document_structures(document_id, format_version, captured_at DESC);

-- Same visibility as document_texts: editors read, nobody writes directly.
ALTER TABLE public.document_structures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_structures FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_structures TO authenticated;
CREATE POLICY document_structures_editors ON public.document_structures FOR SELECT TO authenticated
 USING (public.has_permission('facts.propose') OR public.has_permission('facts.review') OR public.has_permission('documents.ingest'));

-- The crawler's only way in. Returns 'created' or 'unchanged'.
CREATE FUNCTION public.crawler_record_structure(p_run uuid, p_document uuid, p_format_version text, p_structure jsonb, p_captured_at timestamptz)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_source uuid; v_hash text; v_previous text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.crawler_runs WHERE id=p_run AND status='running') THEN RAISE EXCEPTION 'crawler_run_closed'; END IF;
 -- Only a document this very run has just recorded (created or unchanged),
 -- of a source that may still be crawled.
 IF NOT EXISTS(SELECT 1 FROM public.crawler_run_items WHERE run_id=p_run AND document_id=p_document) THEN RAISE EXCEPTION 'crawler_structure_not_recorded'; END IF;
 SELECT source_id INTO v_source FROM public.documents WHERE id=p_document;
 IF v_source IS NULL OR NOT public.crawler_source_ok(v_source) THEN RAISE EXCEPTION 'crawler_target_not_allowed'; END IF;
 IF p_format_version IS NULL OR p_format_version NOT IN ('html-structure-v1') OR p_structure IS NULL OR jsonb_typeof(p_structure) <> 'object'
    OR pg_column_size(p_structure) > 1048576 OR p_structure->>'formatVersion' IS DISTINCT FROM p_format_version
    OR p_captured_at IS NULL OR p_captured_at > now() + interval '5 minutes' THEN
   RAISE EXCEPTION 'crawler_invalid';
 END IF;
 -- Serialise per document: two runs processing the same document cannot both
 -- decide "changed" and write the same snapshot twice.
 PERFORM pg_advisory_xact_lock(hashtextextended('document_structures:' || p_document::text, 0));
 v_hash := encode(sha256(convert_to(p_structure::text, 'UTF8')), 'hex');
 -- Compare with the capture just before this one IN TIME (same order as the
 -- reader view), not with the latest: a late, older capture that repeats its
 -- predecessor adds no row, and in-order captures behave as "compare with latest".
 SELECT structure_hash INTO v_previous FROM public.document_structures
  WHERE document_id=p_document AND format_version=p_format_version AND captured_at <= p_captured_at
  ORDER BY captured_at DESC, created_at DESC, id DESC LIMIT 1;
 IF v_previous = v_hash THEN RETURN 'unchanged'; END IF;
 INSERT INTO public.document_structures(document_id,format_version,structure,structure_hash,captured_at,crawler_run_id)
 VALUES(p_document,p_format_version,p_structure,v_hash,p_captured_at,p_run)
 ON CONFLICT (document_id, format_version, structure_hash, captured_at) DO NOTHING;
 RETURN CASE WHEN FOUND THEN 'created' ELSE 'unchanged' END;
END $$;

-- The one definition of "latest snapshot per document and format version",
-- for every reader (PR 2+). security_invoker: the caller's RLS on
-- document_structures applies (editors only), exactly as for the table.
CREATE VIEW public.document_structures_latest WITH (security_invoker = true) AS
 SELECT DISTINCT ON (document_id, format_version) id, document_id, format_version, structure, structure_hash, captured_at, crawler_run_id, created_at
 FROM public.document_structures
 ORDER BY document_id, format_version, captured_at DESC, created_at DESC, id DESC;
REVOKE ALL ON public.document_structures_latest FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.document_structures_latest TO authenticated;

REVOKE ALL ON FUNCTION public.crawler_record_structure(uuid,uuid,text,jsonb,timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crawler_record_structure(uuid,uuid,text,jsonb,timestamptz) TO nordic_crawler_ops;
NOTIFY pgrst, 'reload schema';
COMMIT;
