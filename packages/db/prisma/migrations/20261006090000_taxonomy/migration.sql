BEGIN;

-- Slice 11a — field-of-study and career-path taxonomy (PROJECT_SPEC.md,
-- Decision Log "2026-10-03 — Open taxonomy" and "2026-10-06 — Taxonomy
-- phase 1"). Plan: docs/architecture/field-taxonomy-phase1-plan.md.
--
-- Two separate dimensions:
-- * study_fields: ISCED-F 2013, an official UNESCO classification. NOTHING is
--   seeded here. Rows arrive only through import_study_fields(), run by the
--   database operator with a CSV whose every line a person checked against
--   the official document (docs/data/isced-f-2013.md). Each row points to the
--   stored document it came from (source traceability, AGENTS.md §23).
-- * career_paths: Nordic's own groupings (PO/PM, Business Analyst…), always
--   labelled as Nordic's, never as an official field (AGENTS.md §15). Created
--   and edited in the app by holders of taxonomy.manage. Changing the
--   criteria creates a new version; old versions are kept (AGENTS.md §4.3).
--
-- Classifying programmes (Slice 11b) and the public filters (Slice 11c) build
-- on these tables.

INSERT INTO public.permissions(key,description) VALUES
 ('taxonomy.manage','Create and edit career paths (Nordic-defined groupings)');
-- Same rule as earlier permissions: complete administrator roles get it.
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,'taxonomy.manage' FROM public.roles r
WHERE EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

-- ---------------------------------------------------------------- study fields

CREATE TABLE public.study_fields (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 classification text NOT NULL CHECK(classification='ISCED-F 2013'),
 code text NOT NULL UNIQUE CHECK(code ~ '^[0-9]{2,4}$'),
 -- 1 broad (2 digits), 2 narrow (3 digits), 3 detailed (4 digits).
 level smallint NOT NULL CHECK(level BETWEEN 1 AND 3 AND level = length(code)-1),
 parent_id uuid REFERENCES public.study_fields(id) ON DELETE RESTRICT,
 name_en text NOT NULL CHECK(length(btrim(name_en)) BETWEEN 1 AND 200),
 -- Nordic's translation, not UNESCO's wording; the UI says so.
 name_vi text NOT NULL CHECK(length(btrim(name_vi)) BETWEEN 1 AND 200),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 source_page smallint CHECK(source_page IS NULL OR source_page > 0),
 verified_by text NOT NULL CHECK(length(btrim(verified_by)) BETWEEN 1 AND 100),
 verified_on date NOT NULL,
 imported_at timestamptz NOT NULL DEFAULT now(),
 CHECK((level=1) = (parent_id IS NULL))
);
CREATE INDEX study_fields_parent_idx ON public.study_fields(parent_id);

-- Official vocabulary, no claims about any institution: readable by everyone.
-- No write grants at all; only the operator function below writes.
ALTER TABLE public.study_fields ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_fields FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.study_fields TO anon,authenticated;
CREATE POLICY study_fields_read ON public.study_fields FOR SELECT TO anon,authenticated USING(true);

-- Operator-only import (like bootstrap_administrator: not executable by any
-- API role). All rows or none. Every row must carry who checked it and when.
-- An existing code is never overwritten: identical rows are skipped, a
-- different name for an existing code stops the import (AGENTS.md §1.4, §4.3).
CREATE FUNCTION public.import_study_fields(p_document uuid,p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; v_code text; v_parent text; v_level int; v_existing public.study_fields;
 v_inserted int := 0; v_unchanged int := 0; v_codes text[];
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(918202603);
 IF NOT EXISTS(SELECT 1 FROM public.documents WHERE id=p_document) THEN RAISE EXCEPTION 'taxonomy_document_missing'; END IF;
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows)=0 THEN RAISE EXCEPTION 'taxonomy_invalid'; END IF;
 SELECT array_agg(x->>'code') INTO v_codes FROM jsonb_array_elements(p_rows) x;
 IF (SELECT count(DISTINCT c) FROM unnest(v_codes) c) <> array_length(v_codes,1) THEN RAISE EXCEPTION 'taxonomy_duplicate_code'; END IF;
 -- Check every row before writing any, so a bad line leaves nothing behind.
 FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
   v_code := r->>'code';
   IF v_code IS NULL OR v_code !~ '^[0-9]{2,4}$' THEN RAISE EXCEPTION 'taxonomy_invalid'; END IF;
   IF coalesce(btrim(r->>'verified_by'),'')='' OR coalesce(r->>'verified_on','') !~ '^\d{4}-\d{2}-\d{2}$'
      OR (r->>'verified_on')::date > current_date THEN
     RAISE EXCEPTION 'taxonomy_unverified' USING DETAIL=v_code;
   END IF;
   v_level := length(v_code)-1;
   v_parent := nullif(r->>'parent_code','');
   IF (r->>'level')::int IS DISTINCT FROM v_level THEN RAISE EXCEPTION 'taxonomy_invalid' USING DETAIL=v_code; END IF;
   -- The parent is the code minus its last digit (ISCED-F builds codes that way).
   IF v_level=1 AND v_parent IS NOT NULL OR v_level>1 AND v_parent IS DISTINCT FROM left(v_code,v_level) THEN
     RAISE EXCEPTION 'taxonomy_invalid' USING DETAIL=v_code;
   END IF;
   IF v_parent IS NOT NULL AND NOT (v_parent = ANY(v_codes)) AND NOT EXISTS(SELECT 1 FROM public.study_fields WHERE code=v_parent) THEN
     RAISE EXCEPTION 'taxonomy_parent_missing' USING DETAIL=v_code;
   END IF;
 END LOOP;
 -- Parents first (shorter codes), so parent_id can be looked up.
 FOR r IN SELECT x FROM jsonb_array_elements(p_rows) x ORDER BY length(x->>'code'), x->>'code' LOOP
   v_code := r->>'code';
   SELECT * INTO v_existing FROM public.study_fields WHERE code=v_code;
   IF FOUND THEN
     IF v_existing.name_en IS DISTINCT FROM btrim(r->>'name_en') OR v_existing.name_vi IS DISTINCT FROM btrim(r->>'name_vi') THEN
       RAISE EXCEPTION 'taxonomy_conflict' USING DETAIL=v_code;
     END IF;
     v_unchanged := v_unchanged+1;
   ELSE
     BEGIN
       INSERT INTO public.study_fields(classification,code,level,parent_id,name_en,name_vi,document_id,source_page,verified_by,verified_on)
       VALUES('ISCED-F 2013',v_code,length(v_code)-1,
         (SELECT id FROM public.study_fields WHERE code=nullif(r->>'parent_code','')),
         btrim(r->>'name_en'),btrim(r->>'name_vi'),p_document,nullif(r->>'source_page','')::smallint,
         btrim(r->>'verified_by'),(r->>'verified_on')::date);
     EXCEPTION WHEN check_violation OR not_null_violation OR invalid_text_representation THEN
       RAISE EXCEPTION 'taxonomy_invalid' USING DETAIL=v_code;
     END;
     v_inserted := v_inserted+1;
   END IF;
 END LOOP;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(NULL,'study_fields.imported',p_document,
   jsonb_build_object('classification','ISCED-F 2013','inserted',v_inserted,'unchanged',v_unchanged,'method','database_operator'));
 RETURN jsonb_build_object('inserted',v_inserted,'unchanged',v_unchanged);
END $$;

-- ---------------------------------------------------------------- career paths

CREATE TABLE public.career_paths (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 -- Stable identifier; classifications will refer to it, so it never changes.
 key text NOT NULL UNIQUE CHECK(key ~ '^[a-z][a-z0-9_]{1,59}$'),
 name_vi text NOT NULL CHECK(length(btrim(name_vi)) BETWEEN 1 AND 200),
 name_en text NOT NULL CHECK(length(btrim(name_en)) BETWEEN 1 AND 200),
 definition_vi text NOT NULL CHECK(length(btrim(definition_vi)) BETWEEN 1 AND 2000),
 definition_en text NOT NULL CHECK(length(btrim(definition_en)) BETWEEN 1 AND 2000),
 -- Reviewer criteria: what counts and what does not (draft format,
 -- docs/data/field-taxonomy-draft.md).
 include_rule text NOT NULL CHECK(length(btrim(include_rule)) BETWEEN 1 AND 4000),
 exclude_rule text CHECK(exclude_rule IS NULL OR length(btrim(exclude_rule)) BETWEEN 1 AND 4000),
 -- English only (owner decision 2026-10-03): used to find candidate programmes.
 keywords text[] NOT NULL DEFAULT '{}' CHECK(cardinality(keywords) <= 40),
 version int NOT NULL DEFAULT 1 CHECK(version >= 1),
 active boolean NOT NULL DEFAULT true,
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per criteria version, never updated: a classification made under
-- version N can always be read against the rules of version N.
CREATE TABLE public.career_path_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 career_path_id uuid NOT NULL REFERENCES public.career_paths(id) ON DELETE RESTRICT,
 version int NOT NULL,
 definition_vi text NOT NULL, definition_en text NOT NULL,
 include_rule text NOT NULL, exclude_rule text,
 keywords text[] NOT NULL,
 changed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 changed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(career_path_id,version)
);

-- Active career paths are public vocabulary (Nordic's definitions, no claim
-- about any programme). Retired ones and the version history are for the
-- people who manage or apply them.
ALTER TABLE public.career_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_path_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.career_paths,public.career_path_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.career_paths TO anon,authenticated;
GRANT SELECT ON public.career_path_versions TO authenticated;
-- Two policies, as for universities: anon cannot call has_permission().
CREATE POLICY career_paths_public ON public.career_paths FOR SELECT TO anon,authenticated USING(active);
CREATE POLICY career_paths_editors ON public.career_paths FOR SELECT TO authenticated
 USING(public.has_permission('taxonomy.manage') OR public.has_permission('education.manage') OR public.has_permission('facts.review'));
CREATE POLICY career_path_versions_read ON public.career_path_versions FOR SELECT TO authenticated
 USING(public.has_permission('taxonomy.manage') OR public.has_permission('education.manage') OR public.has_permission('facts.review'));

CREATE FUNCTION public.save_career_path(p_id uuid,p_key text,p_name_vi text,p_name_en text,p_definition_vi text,p_definition_en text,
 p_include text,p_exclude text,p_keywords text[],p_active boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_prev public.career_paths; v_keywords text[]; v_version int; v_criteria_changed boolean;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('taxonomy.manage') THEN RAISE EXCEPTION 'taxonomy_forbidden'; END IF;
 IF p_active IS NULL THEN RAISE EXCEPTION 'taxonomy_invalid'; END IF;
 -- Trimmed, de-duplicated (case-insensitive), empty entries dropped.
 SELECT coalesce(array_agg(k ORDER BY first_pos),'{}') INTO v_keywords FROM (
   SELECT min(btrim(k)) AS k, min(pos) AS first_pos FROM unnest(coalesce(p_keywords,'{}')) WITH ORDINALITY AS t(k,pos)
   WHERE btrim(k)<>'' GROUP BY lower(btrim(k))) d;
 IF EXISTS(SELECT 1 FROM unnest(v_keywords) k WHERE length(k)>80) THEN RAISE EXCEPTION 'taxonomy_invalid'; END IF;
 BEGIN
   IF p_id IS NULL THEN
     INSERT INTO public.career_paths(key,name_vi,name_en,definition_vi,definition_en,include_rule,exclude_rule,keywords,active,created_by,updated_by)
     VALUES(p_key,btrim(p_name_vi),btrim(p_name_en),btrim(p_definition_vi),btrim(p_definition_en),btrim(p_include),nullif(btrim(p_exclude),''),
       v_keywords,p_active,auth.uid(),auth.uid()) RETURNING id,version INTO v_id,v_version;
     v_criteria_changed := true;
   ELSE
     SELECT * INTO v_prev FROM public.career_paths WHERE id=p_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'taxonomy_not_found'; END IF;
     IF p_key IS DISTINCT FROM v_prev.key THEN RAISE EXCEPTION 'taxonomy_immutable'; END IF;
     -- Names and the active flag can change freely; criteria changes make a new version.
     v_criteria_changed := btrim(p_definition_vi) IS DISTINCT FROM v_prev.definition_vi
       OR btrim(p_definition_en) IS DISTINCT FROM v_prev.definition_en
       OR btrim(p_include) IS DISTINCT FROM v_prev.include_rule
       OR nullif(btrim(p_exclude),'') IS DISTINCT FROM v_prev.exclude_rule
       OR v_keywords IS DISTINCT FROM v_prev.keywords;
     UPDATE public.career_paths SET name_vi=btrim(p_name_vi),name_en=btrim(p_name_en),definition_vi=btrim(p_definition_vi),
       definition_en=btrim(p_definition_en),include_rule=btrim(p_include),exclude_rule=nullif(btrim(p_exclude),''),keywords=v_keywords,
       version=CASE WHEN v_criteria_changed THEN version+1 ELSE version END,active=p_active,updated_by=auth.uid(),updated_at=now()
     WHERE id=p_id RETURNING id,version INTO v_id,v_version;
   END IF;
   IF v_criteria_changed THEN
     INSERT INTO public.career_path_versions(career_path_id,version,definition_vi,definition_en,include_rule,exclude_rule,keywords,changed_by)
     SELECT id,version,definition_vi,definition_en,include_rule,exclude_rule,keywords,auth.uid() FROM public.career_paths WHERE id=v_id;
   END IF;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'taxonomy_duplicate';
   WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'taxonomy_invalid';
 END;
 INSERT INTO public.access_audit(actor_id,action,target_id,details) VALUES(auth.uid(),'career_path.saved',v_id,
   jsonb_build_object('key',p_key,'version',v_version,'criteria_changed',v_criteria_changed,'active',p_active,
     'before',CASE WHEN v_prev.id IS NULL THEN NULL ELSE jsonb_build_object('name_vi',v_prev.name_vi,'name_en',v_prev.name_en,'version',v_prev.version,'active',v_prev.active) END));
 RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.import_study_fields(uuid,jsonb),
 public.save_career_path(uuid,text,text,text,text,text,text,text,text[],boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.save_career_path(uuid,text,text,text,text,text,text,text,text[],boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
