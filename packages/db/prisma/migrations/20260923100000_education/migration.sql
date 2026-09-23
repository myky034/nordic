BEGIN;

-- Slice 5 — universities and programmes (decision: "Option A", 2026-09-23).
--
-- universities/programmes hold IDENTITY only: who/what the entity is, its
-- official URL, and the immutable document + excerpt that shows it exists
-- (SRS FR-ED-02: no university/programme without evidence). Changeable,
-- policy-sensitive values — tuition, application deadline, duration,
-- scholarships — are NOT columns here. They are ordinary facts linked to the
-- entity (facts.programme_id / facts.university_id), so they reuse the Slice 4
-- evidence, review, conflict and history rules instead of a second, weaker
-- mechanism (AGENTS.md Sections 1.4, 4.3).
--
-- Same shape as facts: rows are immutable proposals; a reviewer holding
-- facts.review publishes or rejects them; corrections are new proposals.
-- No seed data: universities/programmes are entered by operators from real
-- documents, never generated (AGENTS.md Section 1.1).

INSERT INTO public.permissions(key,description) VALUES
 ('education.manage','Propose universities and programmes backed by a document');
-- Same rule as facts.* and sources.manage: only roles that already hold both
-- RBAC management capabilities receive the new one automatically.
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,'education.manage' FROM public.roles r
WHERE EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

CREATE TABLE public.universities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 300),
 official_url text NOT NULL CHECK(length(official_url)<=2048 AND official_url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$'),
 -- Evidence of existence. URL and retrieval date are read from the document,
 -- never submitted separately, exactly like public.evidence.
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL CHECK(length(btrim(evidence_excerpt)) BETWEEN 1 AND 500),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Deduplicate live entries; a rejected row does not block a corrected proposal.
CREATE UNIQUE INDEX universities_active_name_key ON public.universities(country_id, lower(name)) WHERE status <> 'rejected';
CREATE INDEX universities_status_country_id_idx ON public.universities(status, country_id);

CREATE TABLE public.programmes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 300),
 -- 'unknown' instead of a guess when the document does not state the level.
 degree_type text NOT NULL CHECK(degree_type IN ('bachelor','master','phd','other','unknown')),
 field text CHECK(field IS NULL OR length(btrim(field)) BETWEEN 1 AND 200),
 language text CHECK(language IS NULL OR length(btrim(language)) BETWEEN 1 AND 100),
 official_url text NOT NULL CHECK(length(official_url)<=2048 AND official_url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$'),
 application_url text CHECK(application_url IS NULL OR (length(application_url)<=2048 AND application_url ~ '^https?://[^/[:space:]@#]+([/?][^[:space:]#]*)?$')),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL CHECK(length(btrim(evidence_excerpt)) BETWEEN 1 AND 500),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX programmes_active_name_key ON public.programmes(university_id, lower(name), degree_type) WHERE status <> 'rejected';
CREATE INDEX programmes_university_id_idx ON public.programmes(university_id);
CREATE INDEX programmes_status_degree_type_idx ON public.programmes(status, degree_type);

-- Append-only decision log. Two real FKs + "exactly one" check instead of an
-- untyped entity_type/entity_id pair (AGENTS.md Section 4.5).
CREATE TABLE public.education_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 university_id uuid REFERENCES public.universities(id) ON DELETE RESTRICT,
 programme_id uuid REFERENCES public.programmes(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('reviewed','rejected')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(university_id, programme_id) = 1)
);
CREATE INDEX education_reviews_created_at_idx ON public.education_reviews(created_at);

-- Facts can now describe a programme (tuition, deadline, duration...) or a
-- university (e.g. a scholarship). deadline_type carries the SRS FR-ED-01
-- fixed/rolling/year-round distinction without inventing a date for rolling
-- or year-round admission.
ALTER TABLE public.facts
 ADD COLUMN university_id uuid REFERENCES public.universities(id) ON DELETE RESTRICT,
 ADD COLUMN programme_id uuid REFERENCES public.programmes(id) ON DELETE RESTRICT,
 ADD COLUMN deadline_type text CHECK(deadline_type IN ('fixed','rolling','year_round')),
 ADD CONSTRAINT facts_single_education_entity CHECK(university_id IS NULL OR programme_id IS NULL);
CREATE INDEX facts_programme_id_idx ON public.facts(programme_id);
CREATE INDEX facts_university_id_idx ON public.facts(university_id);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.universities,public.programmes,public.education_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.universities,public.programmes TO anon,authenticated;
GRANT SELECT ON public.education_reviews TO authenticated;
CREATE POLICY universities_public ON public.universities FOR SELECT TO anon,authenticated USING(status='reviewed');
-- A programme is public only while its university is public too, so a
-- rejected/unreviewed university cannot leak through its programmes.
CREATE POLICY programmes_public ON public.programmes FOR SELECT TO anon,authenticated
 USING(status='reviewed' AND EXISTS(SELECT 1 FROM public.universities u WHERE u.id=university_id AND u.status='reviewed'));
-- Fact proposers need to see draft entities to attach tuition/deadline facts.
CREATE POLICY universities_editors ON public.universities FOR SELECT TO authenticated
 USING(public.has_permission('education.manage') OR public.has_permission('facts.review') OR public.has_permission('facts.propose'));
CREATE POLICY programmes_editors ON public.programmes FOR SELECT TO authenticated
 USING(public.has_permission('education.manage') OR public.has_permission('facts.review') OR public.has_permission('facts.propose'));
CREATE POLICY education_reviews_editors ON public.education_reviews FOR SELECT TO authenticated
 USING(public.has_permission('education.manage') OR public.has_permission('facts.review'));

CREATE FUNCTION public.propose_university(p_country uuid,p_name text,p_official_url text,p_document uuid,p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'education_forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.countries WHERE id=p_country) THEN RAISE EXCEPTION 'education_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.documents WHERE id=p_document) THEN RAISE EXCEPTION 'education_document_missing'; END IF;
 IF p_name IS NULL OR p_excerpt IS NULL OR p_official_url IS NULL THEN RAISE EXCEPTION 'education_invalid'; END IF;
 BEGIN
   INSERT INTO public.universities(country_id,name,official_url,document_id,evidence_excerpt,created_by)
   VALUES(p_country,btrim(p_name),p_official_url,p_document,btrim(p_excerpt),auth.uid()) RETURNING id INTO result;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'education_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'education_invalid';
 END;
 RETURN result;
END $$;

CREATE FUNCTION public.propose_programme(p_university uuid,p_name text,p_degree_type text,p_field text,p_language text,
 p_official_url text,p_application_url text,p_document uuid,p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('education.manage') THEN RAISE EXCEPTION 'education_forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.universities WHERE id=p_university AND status<>'rejected') THEN RAISE EXCEPTION 'education_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.documents WHERE id=p_document) THEN RAISE EXCEPTION 'education_document_missing'; END IF;
 IF p_name IS NULL OR p_excerpt IS NULL OR p_official_url IS NULL OR p_degree_type IS NULL THEN RAISE EXCEPTION 'education_invalid'; END IF;
 BEGIN
   INSERT INTO public.programmes(university_id,name,degree_type,field,language,official_url,application_url,document_id,evidence_excerpt,created_by)
   VALUES(p_university,btrim(p_name),p_degree_type,nullif(btrim(p_field),''),nullif(btrim(p_language),''),
     p_official_url,nullif(btrim(p_application_url),''),p_document,btrim(p_excerpt),auth.uid()) RETURNING id INTO result;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'education_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'education_invalid';
 END;
 RETURN result;
END $$;

CREATE FUNCTION public.review_education(p_kind text,p_id uuid,p_decision text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text; v_university uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'education_forbidden'; END IF;
 -- Same review lock as review_fact: decisions cannot silently overwrite each other.
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_decision IS NULL OR p_decision NOT IN ('reviewed','rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'education_invalid';
 END IF;
 IF p_kind='university' THEN
   SELECT status INTO v_status FROM public.universities WHERE id=p_id FOR UPDATE;
 ELSIF p_kind='programme' THEN
   SELECT p.status,p.university_id INTO v_status,v_university FROM public.programmes p WHERE p.id=p_id FOR UPDATE;
 ELSE
   RAISE EXCEPTION 'education_invalid';
 END IF;
 IF v_status IS NULL THEN RAISE EXCEPTION 'education_missing'; END IF;
 IF v_status<>'proposed' THEN RAISE EXCEPTION 'education_already_decided'; END IF;
 IF p_kind='programme' AND p_decision='reviewed'
   AND NOT EXISTS(SELECT 1 FROM public.universities WHERE id=v_university AND status='reviewed') THEN
   RAISE EXCEPTION 'education_university_unreviewed';
 END IF;
 IF p_kind='university' THEN
   UPDATE public.universities SET status=p_decision,reviewed_at=CASE WHEN p_decision='reviewed' THEN now() END WHERE id=p_id;
   INSERT INTO public.education_reviews(university_id,actor_id,decision,note) VALUES(p_id,auth.uid(),p_decision,btrim(p_note));
 ELSE
   UPDATE public.programmes SET status=p_decision,reviewed_at=CASE WHEN p_decision='reviewed' THEN now() END WHERE id=p_id;
   INSERT INTO public.education_reviews(programme_id,actor_id,decision,note) VALUES(p_id,auth.uid(),p_decision,btrim(p_note));
 END IF;
END $$;

-- propose_fact gains optional education links. Dropped and recreated (not
-- overloaded) so exactly one version is callable; the three new parameters
-- default to NULL, so existing 10-argument callers keep working unchanged.
DROP FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text);
CREATE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,
 p_country uuid,p_from date,p_until date,p_excerpt text,
 p_university uuid DEFAULT NULL,p_programme uuid DEFAULT NULL,p_deadline_type text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents; v_entity_country uuid; v_country uuid := p_country;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_document_missing'; END IF;
 IF p_university IS NOT NULL AND p_programme IS NOT NULL THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_deadline_type IS NOT NULL AND p_deadline_type NOT IN ('fixed','rolling','year_round') THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_programme IS NOT NULL THEN
   SELECT u.country_id INTO v_entity_country FROM public.programmes p JOIN public.universities u ON u.id=p.university_id
   WHERE p.id=p_programme AND p.status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_university IS NOT NULL THEN
   SELECT country_id INTO v_entity_country FROM public.universities WHERE id=p_university AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 END IF;
 -- A programme fact belongs to the university's country; a different
 -- submitted country is a contradiction, not something to pick silently.
 IF v_entity_country IS NOT NULL THEN
   IF v_country IS NULL THEN v_country := v_entity_country;
   ELSIF v_country<>v_entity_country THEN RAISE EXCEPTION 'facts_country_mismatch'; END IF;
 END IF;
 INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,university_id,programme_id,deadline_type)
 VALUES(p_document,btrim(p_topic),btrim(p_subject),btrim(p_predicate),btrim(p_value),nullif(btrim(p_unit),''),v_country,p_from,p_until,auth.uid(),
   p_university,p_programme,p_deadline_type) RETURNING id INTO result;
 -- Evidence URL/date come from the immutable document, never from a submitted URL.
 INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at)
 VALUES(result,d.id,d.canonical_url,btrim(p_excerpt),d.retrieved_at);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.propose_university(uuid,text,text,uuid,text),
 public.propose_programme(uuid,text,text,text,text,text,text,uuid,text),
 public.review_education(text,uuid,text,text),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.propose_university(uuid,text,text,uuid,text),
 public.propose_programme(uuid,text,text,text,text,text,text,uuid,text),
 public.review_education(text,uuid,text,text),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
