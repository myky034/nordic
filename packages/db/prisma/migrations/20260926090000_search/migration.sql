BEGIN;

-- Slice 7a — full-text search (PROJECT_SPEC.md Section 2.11: PostgreSQL FTS,
-- no Elasticsearch). Decisions confirmed 2026-09-26 (Section 21).
--
-- * 'simple' text-search configuration: content mixes English, Swedish,
--   Danish, Finnish, Norwegian and Dutch; an English stemmer would mangle
--   names, and no single-language dictionary fits.
-- * Accent folding without a new extension: unaccent is not installed on the
--   project and not available in the test database, so search_fold() uses
--   lower() + translate() for Latin/Nordic letters ("malmo" finds "Malmö").
--   translate() maps one character to one character, so æ→a and ß→s are
--   approximations. Changing search_fold later requires re-creating the
--   generated columns below.
-- * Each searchable table gets a STORED generated tsvector + GIN index, so
--   vectors can never drift from the row they describe.
-- * search_public() is SECURITY INVOKER: it runs with the caller's
--   privileges, so RLS decides visibility. The web app calls it with an
--   anonymous client, which yields exactly the public view. Explicit status
--   filters repeat the public rules as defence in depth.

CREATE FUNCTION public.search_fold(p text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
 SELECT translate(lower(coalesce(p, '')),
   'áàâäãåāăąçćčďđðéèêëēėęěğíìîïīįıłľĺñńňóòôöõøōőœŕřśšşßťþúùûüūůűųýÿžźżæ',
   'aaaaaaaaacccdddeeeeeeeegiiiiiiilllnnnooooooooorrssssttuuuuuuuuyyzzza')
$$;

ALTER TABLE public.countries ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(name || ' ' || slug))) STORED;
ALTER TABLE public.sources ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(name || ' ' || coalesce(source_type, '')))) STORED;
ALTER TABLE public.documents ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(coalesce(title, '') || ' ' || coalesce(excerpt, '')))) STORED;
ALTER TABLE public.universities ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(name))) STORED;
ALTER TABLE public.programmes ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(name || ' ' || coalesce(field, '') || ' ' || coalesce(language, '')))) STORED;
ALTER TABLE public.immigration_rules ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(title))) STORED;
ALTER TABLE public.occupations ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(name || ' ' || coalesce(classification_code, '')))) STORED;
ALTER TABLE public.facts ADD COLUMN search_vector tsvector
 GENERATED ALWAYS AS (to_tsvector('simple', public.search_fold(topic || ' ' || subject || ' ' || predicate || ' ' || value))) STORED;

CREATE INDEX countries_search_idx ON public.countries USING gin(search_vector);
CREATE INDEX sources_search_idx ON public.sources USING gin(search_vector);
CREATE INDEX documents_search_idx ON public.documents USING gin(search_vector);
CREATE INDEX universities_search_idx ON public.universities USING gin(search_vector);
CREATE INDEX programmes_search_idx ON public.programmes USING gin(search_vector);
CREATE INDEX immigration_rules_search_idx ON public.immigration_rules USING gin(search_vector);
CREATE INDEX occupations_search_idx ON public.occupations USING gin(search_vector);
CREATE INDEX facts_search_idx ON public.facts USING gin(search_vector);

-- Top p_per_type hits per entity type, plus the total per type for "see all".
-- websearch_to_tsquery never raises on user input (quotes, OR, -negation).
CREATE FUNCTION public.search_public(p_query text, p_per_type integer DEFAULT 5)
RETURNS TABLE(entity_type text, id uuid, title text, subtitle text, link_key text, rank real, total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 WITH q AS (SELECT websearch_to_tsquery('simple', public.search_fold(left(p_query, 200))) AS tsq),
 hits AS (
  SELECT 'country'::text AS t, c.id, c.name AS title, NULL::text AS sub, c.slug AS k, ts_rank(c.search_vector, q.tsq) AS r
   FROM public.countries c, q WHERE c.search_vector @@ q.tsq
  UNION ALL
  SELECT 'source', s.id, s.name, s.canonical_url, s.id::text, ts_rank(s.search_vector, q.tsq)
   FROM public.sources s, q WHERE s.search_vector @@ q.tsq
  UNION ALL
  SELECT 'document', d.id, coalesce(d.title, 'Untitled document'), d.canonical_url, d.id::text, ts_rank(d.search_vector, q.tsq)
   FROM public.documents d, q WHERE d.search_vector @@ q.tsq
  UNION ALL
  SELECT 'university', u.id, u.name, co.name, u.id::text, ts_rank(u.search_vector, q.tsq)
   FROM public.universities u JOIN public.countries co ON co.id = u.country_id, q
   WHERE u.status = 'reviewed' AND u.search_vector @@ q.tsq
  UNION ALL
  SELECT 'programme', p.id, p.name, u.name, p.id::text, ts_rank(p.search_vector, q.tsq)
   FROM public.programmes p JOIN public.universities u ON u.id = p.university_id, q
   WHERE p.status = 'reviewed' AND u.status = 'reviewed' AND p.search_vector @@ q.tsq
  UNION ALL
  SELECT 'immigration_rule', i.id, i.title, co.name, i.id::text, ts_rank(i.search_vector, q.tsq)
   FROM public.immigration_rules i JOIN public.countries co ON co.id = i.country_id, q
   WHERE i.status = 'reviewed' AND i.search_vector @@ q.tsq
  UNION ALL
  SELECT 'occupation', o.id, o.name, o.classification_code, o.id::text, ts_rank(o.search_vector, q.tsq)
   FROM public.occupations o, q WHERE o.status = 'reviewed' AND o.search_vector @@ q.tsq
  UNION ALL
  SELECT 'fact', f.id, f.subject || ' — ' || f.predicate, left(f.value, 200), f.document_id::text, ts_rank(f.search_vector, q.tsq)
   FROM public.facts f, q WHERE f.status IN ('reviewed', 'conflicted') AND f.search_vector @@ q.tsq
 )
 SELECT t, id, title, sub, k, r, count(*) OVER (PARTITION BY t)
 FROM (SELECT hits.*, row_number() OVER (PARTITION BY t ORDER BY r DESC, title) AS rn FROM hits) ranked
 WHERE rn <= least(greatest(coalesce(p_per_type, 5), 1), 20)
 ORDER BY t, r DESC, title
$$;

REVOKE ALL ON FUNCTION public.search_public(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public(text, integer), public.search_fold(text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
