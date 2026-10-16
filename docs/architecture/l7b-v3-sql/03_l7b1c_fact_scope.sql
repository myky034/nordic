-- PROPOSED MIGRATION (NOT APPLIED) · L7b-1c · replaces D13 (KHLOE-172)
-- Review copy only; outside prisma/migrations so `prisma migrate deploy` never sees it.
-- Depends on 02 (programme_intakes, applicant_groups, applicant_group_aliases).
--
-- Fact scope (X1): intake, applicant group, admission round, academic year. Each
-- dimension is UNSTATED (NULL) unless a source says otherwise: unstated never
-- means "applies to everyone" (gate condition 1). Additive only; the 58 existing
-- facts keep every new column NULL (condition 10). CHECKs are written NULL-safe:
-- a CHECK that evaluates to NULL passes in PostgreSQL, so every comparison with a
-- nullable column goes through coalesce / CASE (condition 8).
-- Institution / country inheritance (X2) is NOT here: it needs per-fact reviewed
-- applicability (condition 3) and comes with L7b-4.
BEGIN;

-- ------------------------------------------------------------ fact types: levels (X2)
ALTER TABLE public.fact_types ADD COLUMN scope_levels text[] NOT NULL DEFAULT '{}';
UPDATE public.fact_types SET scope_levels = ARRAY[applies_to];
ALTER TABLE public.fact_types
 ADD CONSTRAINT fact_types_scope_levels_known CHECK (scope_levels <@ ARRAY['programme','university','immigration_rule','occupation','country']::text[]),
 ADD CONSTRAINT fact_types_scope_levels_primary CHECK (applies_to = ANY (scope_levels));
-- save_fact_type() does not know scope_levels: a new type gets its primary level, and a
-- changed primary level is added, so the existing admin flow keeps working unchanged.
CREATE FUNCTION public.fact_types_scope_levels_default() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.scope_levels IS NULL OR cardinality(NEW.scope_levels) = 0 THEN NEW.scope_levels := ARRAY[NEW.applies_to];
 ELSIF NOT (NEW.applies_to = ANY (NEW.scope_levels)) THEN NEW.scope_levels := NEW.scope_levels || NEW.applies_to;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER fact_types_scope_levels_default BEFORE INSERT OR UPDATE OF applies_to, scope_levels ON public.fact_types
 FOR EACH ROW EXECUTE FUNCTION public.fact_types_scope_levels_default();

-- ------------------------------------------------------------ fact scope columns
ALTER TABLE public.facts
 ADD COLUMN intake_scope text CHECK (intake_scope IN ('all','specific')),
 ADD COLUMN intake_id uuid,
 ADD COLUMN applicant_scope text CHECK (applicant_scope IN ('all','specific')),
 ADD COLUMN applicant_group_label text CHECK (applicant_group_label IS NULL OR length(btrim(applicant_group_label)) BETWEEN 1 AND 200),
 ADD COLUMN applicant_group_id uuid REFERENCES public.applicant_groups(id) ON DELETE RESTRICT,
 ADD COLUMN admission_round_label text CHECK (admission_round_label IS NULL OR length(btrim(admission_round_label)) BETWEEN 1 AND 120),
 ADD COLUMN academic_year text CHECK (academic_year IS NULL OR (academic_year ~ '^[0-9]{4}-[0-9]{4}$'
   AND split_part(academic_year, '-', 2)::int = split_part(academic_year, '-', 1)::int + 1)),
 -- MATCH SIMPLE: not checked while intake_id is NULL; the CHECKs below forbid an intake without a programme.
 ADD CONSTRAINT facts_intake_fk FOREIGN KEY (intake_id, programme_id) REFERENCES public.programme_intakes(id, programme_id) ON DELETE RESTRICT,
 ADD CONSTRAINT facts_intake_scope CHECK (CASE coalesce(intake_scope, 'unstated')
   WHEN 'unstated' THEN intake_id IS NULL
   WHEN 'all'      THEN intake_id IS NULL AND programme_id IS NOT NULL
   WHEN 'specific' THEN intake_id IS NOT NULL AND programme_id IS NOT NULL
   ELSE false END),
 ADD CONSTRAINT facts_applicant_scope CHECK (CASE coalesce(applicant_scope, 'unstated')
   WHEN 'unstated' THEN applicant_group_label IS NULL AND applicant_group_id IS NULL
   WHEN 'all'      THEN applicant_group_label IS NULL AND applicant_group_id IS NULL
   WHEN 'specific' THEN applicant_group_label IS NOT NULL
   ELSE false END);
CREATE INDEX facts_intake_idx ON public.facts(intake_id) WHERE intake_id IS NOT NULL;

-- ------------------------------------------------------------ evidence per scope dimension
CREATE TABLE public.fact_scope_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE RESTRICT,
 dimension text NOT NULL CHECK (dimension IN ('intake','applicant_group','admission_round','academic_year')),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 excerpt text NOT NULL CHECK (length(btrim(excerpt)) BETWEEN 3 AND 500),
 structure_id uuid REFERENCES public.document_structures(id) ON DELETE RESTRICT,
 structure_ref text CHECK (structure_ref IS NULL OR length(structure_ref) BETWEEN 1 AND 40),
 structure_field text CHECK (structure_field IN ('text','label','value','canonical','cell','json_ld')),
 structure_cell int[] CHECK (structure_cell IS NULL OR (cardinality(structure_cell) = 2 AND structure_cell[1] >= 0 AND structure_cell[2] >= 0)),
 structure_path jsonb CHECK (structure_path IS NULL OR (jsonb_typeof(structure_path) = 'array' AND jsonb_array_length(structure_path) > 0)),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (fact_id, dimension),
 -- Snapshot locator: all of (structure, ref, field) or none; cell only for "cell", path only for "json_ld".
 CONSTRAINT fact_scope_evidence_locator CHECK (CASE WHEN structure_id IS NULL
   THEN structure_ref IS NULL AND structure_field IS NULL AND structure_cell IS NULL AND structure_path IS NULL
   ELSE structure_ref IS NOT NULL AND structure_field IS NOT NULL
     AND (structure_cell IS NOT NULL) = (structure_field = 'cell')
     AND (structure_path IS NOT NULL) = (structure_field = 'json_ld') END)
);

CREATE TABLE public.fact_scope_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 before jsonb NOT NULL,
 after jsonb NOT NULL,
 note text NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fact_scope_changes_fact_idx ON public.fact_scope_changes(fact_id, created_at);

ALTER TABLE public.fact_scope_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_scope_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fact_scope_evidence, public.fact_scope_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.fact_scope_evidence TO anon, authenticated;
GRANT SELECT ON public.fact_scope_changes TO authenticated;
-- Visible exactly when the fact is (the inner query is itself subject to the facts policies), as evidence_visible.
CREATE POLICY fact_scope_evidence_visible ON public.fact_scope_evidence FOR SELECT TO anon, authenticated
 USING (EXISTS (SELECT 1 FROM public.facts f WHERE f.id = fact_id));
CREATE POLICY fact_scope_changes_editors ON public.fact_scope_changes FOR SELECT TO authenticated
 USING (public.has_permission('facts.propose') OR public.has_permission('facts.review'));

-- ------------------------------------------------------------ evidence check (D5 contract)
-- The excerpt must be in the document's text, or in ONE string of ONE element of a
-- snapshot of THAT document (heading/block/link text; pair label/value/canonical;
-- table cell; JSON-LD value at a path). Never a concatenation of elements.
CREATE FUNCTION public.scope_excerpt_ok(p_document uuid, p_excerpt text, p_structure uuid, p_ref text, p_field text,
  p_cell int[], p_path jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb; v text; sd text[];
BEGIN
 IF p_excerpt IS NULL OR length(btrim(p_excerpt)) NOT BETWEEN 3 AND 500 THEN RETURN false; END IF;
 IF p_structure IS NULL THEN
   RETURN public.l7b_excerpt_in_document(p_document, p_excerpt);
 END IF;
 SELECT structure INTO s FROM public.document_structures WHERE id = p_structure AND document_id = p_document;
 IF s IS NULL THEN RETURN false; END IF;
 IF p_field = 'text' THEN
   SELECT e->>'text' INTO v FROM jsonb_array_elements(coalesce(s->'headings','[]') || coalesce(s->'blocks','[]') || coalesce(s->'links','[]')) e
    WHERE e->>'ref' = p_ref LIMIT 1;
 ELSIF p_field IN ('label','value','canonical') THEN
   SELECT CASE p_field WHEN 'label' THEN e->>'label' WHEN 'value' THEN e->>'value' ELSE (e->>'label') || ': ' || (e->>'value') END INTO v
    FROM jsonb_array_elements(coalesce(s->'pairs','[]')) e WHERE e->>'ref' = p_ref LIMIT 1;
 ELSIF p_field = 'cell' THEN
   SELECT e->'rows'->(p_cell[1])->'cells'->>(p_cell[2]) INTO v FROM jsonb_array_elements(coalesce(s->'tables','[]')) e WHERE e->>'ref' = p_ref LIMIT 1;
 ELSIF p_field = 'json_ld' THEN
   sd := regexp_match(p_ref, '^sd([0-9]+)\.([0-9]+)$');
   IF sd IS NULL THEN RETURN false; END IF;
   SELECT CASE WHEN jsonb_typeof(x) IN ('string','number') THEN x #>> '{}' END INTO v
    FROM (SELECT (s->'structuredData'->(sd[1]::int)->'items'->(sd[2]::int)) #> ARRAY(SELECT jsonb_array_elements_text(p_path)) AS x) q;
 ELSE
   RETURN false;
 END IF;
 RETURN v IS NOT NULL AND position(public.extraction_norm(p_excerpt) IN public.extraction_norm(v)) > 0;
END $$;

-- ------------------------------------------------------------ set_fact_scope
-- p_scope: {"intake_scope","intake_id","applicant_scope","applicant_group_label","admission_round_label","academic_year"}
--   (absent key = unstated). p_evidence: {"<dimension>": {"document_id","excerpt","structure_id","ref","field","cell","path"}}.
-- Every stated dimension needs evidence from a version of the fact's own page, and the stated words
-- (intake label, group label, round label, academic year) must be inside that excerpt.
-- The applicant group is resolved ONLY through a reviewed alias of the fact's source; never chosen here.
CREATE FUNCTION public.set_fact_scope(p_fact uuid, p_scope jsonb, p_evidence jsonb, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 f public.facts; v_source uuid; v_before jsonb; v_after jsonb; v_group uuid; v_intake public.programme_intakes;
 v_intake_scope text := nullif(p_scope->>'intake_scope', '');
 v_intake_id uuid := nullif(p_scope->>'intake_id', '')::uuid;
 v_app_scope text := nullif(p_scope->>'applicant_scope', '');
 v_app_label text := nullif(btrim(p_scope->>'applicant_group_label'), '');
 v_round text := nullif(btrim(p_scope->>'admission_round_label'), '');
 v_year text := nullif(btrim(p_scope->>'academic_year'), '');
 d text; e jsonb;
 -- array_append, not "||": "v_needed || 'intake'" parses 'intake' as an array literal and fails
 -- (found by the PGlite validation of this file, 2026-10-16).
 v_needed text[] := '{}';
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 OR p_scope IS NULL OR jsonb_typeof(p_scope) <> 'object'
    OR (p_evidence IS NOT NULL AND jsonb_typeof(p_evidence) <> 'object') THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 SELECT * INTO f FROM public.facts WHERE id = p_fact FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_missing'; END IF;
 IF f.status = 'rejected' THEN RAISE EXCEPTION 'facts_already_decided'; END IF;
 SELECT source_id INTO v_source FROM public.documents WHERE id = f.document_id;

 IF v_intake_scope IS NOT NULL THEN v_needed := array_append(v_needed, 'intake'); END IF;
 IF v_app_scope IS NOT NULL THEN v_needed := array_append(v_needed, 'applicant_group'); END IF;
 IF v_round IS NOT NULL THEN v_needed := array_append(v_needed, 'admission_round'); END IF;
 IF v_year IS NOT NULL THEN v_needed := array_append(v_needed, 'academic_year'); END IF;

 FOREACH d IN ARRAY v_needed LOOP
   e := p_evidence->d;
   IF e IS NULL THEN RAISE EXCEPTION 'facts_scope_evidence_missing'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.page_documents(f.document_id) x WHERE x = (e->>'document_id')::uuid) THEN
     RAISE EXCEPTION 'facts_scope_evidence_other_page';
   END IF;
   IF NOT public.scope_excerpt_ok((e->>'document_id')::uuid, e->>'excerpt', nullif(e->>'structure_id', '')::uuid, e->>'ref', e->>'field',
        CASE WHEN e ? 'cell' THEN ARRAY[(e->'cell'->>0)::int, (e->'cell'->>1)::int] END, e->'path') THEN
     RAISE EXCEPTION 'facts_scope_excerpt_not_found';
   END IF;
 END LOOP;

 IF v_intake_scope = 'specific' THEN
   SELECT * INTO v_intake FROM public.programme_intakes WHERE id = v_intake_id AND programme_id = f.programme_id AND status = 'reviewed';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_intake_invalid'; END IF;
   IF position(public.extraction_norm(v_intake.label) IN public.extraction_norm(p_evidence->'intake'->>'excerpt')) = 0 THEN RAISE EXCEPTION 'facts_scope_words_not_in_excerpt'; END IF;
 ELSIF v_intake_id IS NOT NULL THEN RAISE EXCEPTION 'facts_invalid';
 END IF;
 IF v_app_scope = 'specific' THEN
   IF v_app_label IS NULL OR position(public.extraction_norm(v_app_label) IN public.extraction_norm(p_evidence->'applicant_group'->>'excerpt')) = 0 THEN
     RAISE EXCEPTION 'facts_scope_words_not_in_excerpt';
   END IF;
   SELECT applicant_group_id INTO v_group FROM public.applicant_group_aliases
    WHERE source_id = v_source AND label_norm = lower(regexp_replace(btrim(v_app_label), '\s+', ' ', 'g')) AND status = 'reviewed';
 ELSIF v_app_label IS NOT NULL THEN RAISE EXCEPTION 'facts_invalid';
 END IF;
 IF v_round IS NOT NULL AND position(public.extraction_norm(v_round) IN public.extraction_norm(p_evidence->'admission_round'->>'excerpt')) = 0 THEN
   RAISE EXCEPTION 'facts_scope_words_not_in_excerpt';
 END IF;
 -- "2026-2027" may be written "2026/27" or "2026–2027": the start year must at least be stated.
 IF v_year IS NOT NULL AND position(split_part(v_year, '-', 1) IN coalesce(p_evidence->'academic_year'->>'excerpt', '')) = 0 THEN
   RAISE EXCEPTION 'facts_scope_words_not_in_excerpt';
 END IF;

 v_before := jsonb_build_object('intake_scope', f.intake_scope, 'intake_id', f.intake_id, 'applicant_scope', f.applicant_scope,
   'applicant_group_label', f.applicant_group_label, 'applicant_group_id', f.applicant_group_id,
   'admission_round_label', f.admission_round_label, 'academic_year', f.academic_year);
 BEGIN
   UPDATE public.facts SET intake_scope = v_intake_scope, intake_id = v_intake_id, applicant_scope = v_app_scope,
     applicant_group_label = CASE WHEN v_app_scope = 'specific' THEN v_app_label END,
     applicant_group_id = CASE WHEN v_app_scope = 'specific' THEN v_group END,
     admission_round_label = v_round, academic_year = v_year
   WHERE id = p_fact;
 EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation THEN RAISE EXCEPTION 'facts_invalid';
 END;
 DELETE FROM public.fact_scope_evidence WHERE fact_id = p_fact AND NOT (dimension = ANY (v_needed));
 FOREACH d IN ARRAY v_needed LOOP
   e := p_evidence->d;
   INSERT INTO public.fact_scope_evidence(fact_id, dimension, document_id, excerpt, structure_id, structure_ref, structure_field, structure_cell, structure_path)
   VALUES (p_fact, d, (e->>'document_id')::uuid, btrim(e->>'excerpt'), nullif(e->>'structure_id', '')::uuid, e->>'ref', e->>'field',
     CASE WHEN e ? 'cell' THEN ARRAY[(e->'cell'->>0)::int, (e->'cell'->>1)::int] END, e->'path')
   ON CONFLICT (fact_id, dimension) DO UPDATE SET document_id = EXCLUDED.document_id, excerpt = EXCLUDED.excerpt,
     structure_id = EXCLUDED.structure_id, structure_ref = EXCLUDED.structure_ref, structure_field = EXCLUDED.structure_field,
     structure_cell = EXCLUDED.structure_cell, structure_path = EXCLUDED.structure_path, created_at = now();
 END LOOP;
 SELECT jsonb_build_object('intake_scope', intake_scope, 'intake_id', intake_id, 'applicant_scope', applicant_scope,
   'applicant_group_label', applicant_group_label, 'applicant_group_id', applicant_group_id,
   'admission_round_label', admission_round_label, 'academic_year', academic_year) INTO v_after FROM public.facts WHERE id = p_fact;
 IF v_before = v_after AND NOT EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(p_evidence, '{}'))) THEN RAISE EXCEPTION 'facts_scope_unchanged'; END IF;
 INSERT INTO public.fact_scope_changes(fact_id, actor_id, before, after, note) VALUES (p_fact, auth.uid(), v_before, v_after, btrim(p_note));
END $$;

REVOKE ALL ON FUNCTION public.fact_types_scope_levels_default(), public.scope_excerpt_ok(uuid, text, uuid, text, text, int[], jsonb),
  public.set_fact_scope(uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_fact_scope(uuid, jsonb, jsonb, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
