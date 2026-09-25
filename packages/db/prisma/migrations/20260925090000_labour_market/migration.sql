BEGIN;

-- Slice 6b — labour market (recommendations accepted by the project owner,
-- 2026-09-25; PROJECT_SPEC.md Section 21):
--
-- 1. occupations hold IDENTITY only (name, optional classification code,
--    optional country) and must be proven by a document + excerpt. No seed
--    rows: the spec's focus occupations are entered from real sources.
-- 2. No separate labour_market_items table. Each labour-market figure
--    (salary, vacancies, unemployment, ...) is a fact linked by
--    facts.occupation_id, reusing evidence/review/conflict/history. A new
--    facts.reference_period records WHICH period a statistic measures
--    (e.g. 2024, 2025-Q2) — distinct from valid_from/valid_until, which
--    describe when a rule applies.
-- 3. An occupation-linked figure is public only while the occupation is
--    reviewed AND the figure's own evidence source is registry-verified.
--    Non-T1/T2 evidence is allowed but labelled in the UI as not official
--    statistics. A figure must name its country: a salary without a country
--    is meaningless.
-- 4. Job postings, employers and skills are out of scope for this slice.

INSERT INTO public.permissions(key,description) VALUES
 ('labour.manage','Propose occupations backed by a document');
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,'labour.manage' FROM public.roles r
WHERE EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

CREATE TABLE public.occupations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 200),
 -- A code is recorded only when the source states it; system and code come together.
 classification_system text CHECK(classification_system IN ('ISCO-08','ESCO','national','other')),
 classification_code text CHECK(classification_code IS NULL OR length(btrim(classification_code)) BETWEEN 1 AND 50),
 -- NULL = the occupation definition is not country-specific (e.g. ISCO/ESCO).
 country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 evidence_excerpt text NOT NULL CHECK(length(btrim(evidence_excerpt)) BETWEEN 1 AND 500),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((classification_system IS NULL) = (classification_code IS NULL))
);
-- One live entry per name per scope (a country, or "international").
CREATE UNIQUE INDEX occupations_active_name_key ON public.occupations(lower(name), coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status <> 'rejected';
CREATE INDEX occupations_status_idx ON public.occupations(status, created_at);

CREATE TABLE public.occupation_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 occupation_id uuid NOT NULL REFERENCES public.occupations(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('reviewed','rejected')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX occupation_reviews_occupation_idx ON public.occupation_reviews(occupation_id);

-- reference_period: YYYY, YYYY-Qn, YYYY-Hn or YYYY-MM. Nothing fuzzier, so the
-- UI never shows "recent" or "latest" as if it were a period.
ALTER TABLE public.facts
 ADD COLUMN occupation_id uuid REFERENCES public.occupations(id) ON DELETE RESTRICT,
 ADD COLUMN reference_period text CHECK(reference_period ~ '^[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?$'),
 DROP CONSTRAINT facts_single_entity,
 ADD CONSTRAINT facts_single_entity CHECK(num_nonnulls(university_id, programme_id, immigration_rule_id, occupation_id) <= 1),
 ADD CONSTRAINT facts_occupation_country CHECK(occupation_id IS NULL OR country_id IS NOT NULL);
CREATE INDEX facts_occupation_id_idx ON public.facts(occupation_id);

ALTER TABLE public.occupations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.occupation_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.occupations,public.occupation_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.occupations TO anon,authenticated;
GRANT SELECT ON public.occupation_reviews TO authenticated;
CREATE POLICY occupations_public ON public.occupations FOR SELECT TO anon,authenticated USING(status='reviewed');
CREATE POLICY occupations_editors ON public.occupations FOR SELECT TO authenticated
 USING(public.has_permission('labour.manage') OR public.has_permission('facts.review') OR public.has_permission('facts.propose'));
CREATE POLICY occupation_reviews_editors ON public.occupation_reviews FOR SELECT TO authenticated
 USING(public.has_permission('labour.manage') OR public.has_permission('facts.review'));

-- facts_public: previous rules unchanged (plain facts; immigration-linked
-- facts); adds the occupation rule. Conditions are written out with joins,
-- not nested RLS, for the reason given in 20260923120000_immigration.
DROP POLICY facts_public ON public.facts;
CREATE POLICY facts_public ON public.facts FOR SELECT TO anon,authenticated
 USING(status IN ('reviewed','conflicted')
   AND (immigration_rule_id IS NULL OR (
     EXISTS(SELECT 1 FROM public.immigration_rules r JOIN public.documents d ON d.id=r.document_id JOIN public.sources s ON s.id=d.source_id
       WHERE r.id=immigration_rule_id AND r.status='reviewed' AND s.status='verified' AND s.source_tier='T1')
     AND EXISTS(SELECT 1 FROM public.documents d JOIN public.sources s ON s.id=d.source_id
       WHERE d.id=document_id AND s.status='verified')))
   AND (occupation_id IS NULL OR (
     EXISTS(SELECT 1 FROM public.occupations o WHERE o.id=occupation_id AND o.status='reviewed')
     AND EXISTS(SELECT 1 FROM public.documents d JOIN public.sources s ON s.id=d.source_id
       WHERE d.id=document_id AND s.status='verified'))));

CREATE FUNCTION public.propose_occupation(p_name text,p_system text,p_code text,p_country uuid,p_document uuid,p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('labour.manage') THEN RAISE EXCEPTION 'labour_forbidden'; END IF;
 IF p_name IS NULL OR p_excerpt IS NULL THEN RAISE EXCEPTION 'labour_invalid'; END IF;
 IF p_country IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.countries WHERE id=p_country) THEN RAISE EXCEPTION 'labour_invalid'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.documents WHERE id=p_document) THEN RAISE EXCEPTION 'labour_document_missing'; END IF;
 BEGIN
   INSERT INTO public.occupations(name,classification_system,classification_code,country_id,document_id,evidence_excerpt,created_by)
   VALUES(btrim(p_name),nullif(btrim(p_system),''),nullif(btrim(p_code),''),p_country,p_document,btrim(p_excerpt),auth.uid()) RETURNING id INTO result;
 EXCEPTION
   WHEN unique_violation THEN RAISE EXCEPTION 'labour_duplicate';
   WHEN check_violation THEN RAISE EXCEPTION 'labour_invalid';
 END;
 RETURN result;
END $$;

CREATE FUNCTION public.review_occupation(p_id uuid,p_decision text,p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_status text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'labour_forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_decision IS NULL OR p_decision NOT IN ('reviewed','rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
   RAISE EXCEPTION 'labour_invalid';
 END IF;
 SELECT status INTO v_status FROM public.occupations WHERE id=p_id FOR UPDATE;
 IF v_status IS NULL THEN RAISE EXCEPTION 'labour_missing'; END IF;
 IF v_status<>'proposed' THEN RAISE EXCEPTION 'labour_already_decided'; END IF;
 UPDATE public.occupations SET status=p_decision,reviewed_at=CASE WHEN p_decision='reviewed' THEN now() END WHERE id=p_id;
 INSERT INTO public.occupation_reviews(occupation_id,actor_id,decision,note) VALUES(p_id,auth.uid(),p_decision,btrim(p_note));
END $$;

-- propose_fact gains p_occupation and p_reference_period (trailing, DEFAULT
-- NULL); all earlier callers keep working. Dropped and recreated so only one
-- version exists.
DROP FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid);
CREATE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,
 p_country uuid,p_from date,p_until date,p_excerpt text,
 p_university uuid DEFAULT NULL,p_programme uuid DEFAULT NULL,p_deadline_type text DEFAULT NULL,p_immigration_rule uuid DEFAULT NULL,
 p_occupation uuid DEFAULT NULL,p_reference_period text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents; v_entity_country uuid; v_country uuid := p_country;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_document_missing'; END IF;
 IF num_nonnulls(p_university,p_programme,p_immigration_rule,p_occupation) > 1 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_deadline_type IS NOT NULL AND p_deadline_type NOT IN ('fixed','rolling','year_round') THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_reference_period IS NOT NULL AND p_reference_period !~ '^[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?$' THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_programme IS NOT NULL THEN
   SELECT u.country_id INTO v_entity_country FROM public.programmes p JOIN public.universities u ON u.id=p.university_id
   WHERE p.id=p_programme AND p.status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_university IS NOT NULL THEN
   SELECT country_id INTO v_entity_country FROM public.universities WHERE id=p_university AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_immigration_rule IS NOT NULL THEN
   SELECT country_id INTO v_entity_country FROM public.immigration_rules WHERE id=p_immigration_rule AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 ELSIF p_occupation IS NOT NULL THEN
   -- country_id may legitimately be NULL for an international occupation.
   SELECT country_id INTO v_entity_country FROM public.occupations WHERE id=p_occupation AND status<>'rejected';
   IF NOT FOUND THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 END IF;
 IF v_entity_country IS NOT NULL THEN
   IF v_country IS NULL THEN v_country := v_entity_country;
   ELSIF v_country<>v_entity_country THEN RAISE EXCEPTION 'facts_country_mismatch'; END IF;
 END IF;
 IF p_occupation IS NOT NULL AND v_country IS NULL THEN RAISE EXCEPTION 'facts_country_required'; END IF;
 INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by,
   university_id,programme_id,deadline_type,immigration_rule_id,occupation_id,reference_period)
 VALUES(p_document,btrim(p_topic),btrim(p_subject),btrim(p_predicate),btrim(p_value),nullif(btrim(p_unit),''),v_country,p_from,p_until,auth.uid(),
   p_university,p_programme,p_deadline_type,p_immigration_rule,p_occupation,p_reference_period) RETURNING id INTO result;
 -- Evidence URL/date come from the immutable document, never from a submitted URL.
 INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at)
 VALUES(result,d.id,d.canonical_url,btrim(p_excerpt),d.retrieved_at);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.propose_occupation(text,text,text,uuid,uuid,text),
 public.review_occupation(uuid,text,text),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.propose_occupation(text,text,text,uuid,uuid,text),
 public.review_occupation(uuid,text,text),
 public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text,uuid,uuid,text,uuid,uuid,text)
 TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
