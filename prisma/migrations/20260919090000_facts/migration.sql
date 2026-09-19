BEGIN;
CREATE TABLE public.facts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 topic text NOT NULL CHECK(length(btrim(topic)) BETWEEN 1 AND 100),
 subject text NOT NULL CHECK(length(btrim(subject)) BETWEEN 1 AND 200),
 predicate text NOT NULL CHECK(length(btrim(predicate)) BETWEEN 1 AND 200),
 value text NOT NULL CHECK(length(btrim(value)) BETWEEN 1 AND 2000),
 unit text CHECK(length(unit)<=100),
 country_id uuid REFERENCES public.countries(id) ON DELETE RESTRICT,
 valid_from date, valid_until date,
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','reviewed','rejected','conflicted')),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(valid_until IS NULL OR valid_from IS NULL OR valid_until>=valid_from)
);
CREATE TABLE public.evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL UNIQUE REFERENCES public.facts(id) ON DELETE RESTRICT,
 document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE RESTRICT,
 source_url text NOT NULL,
 excerpt text NOT NULL CHECK(length(btrim(excerpt)) BETWEEN 1 AND 500),
 retrieved_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fact_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fact_id uuid NOT NULL REFERENCES public.facts(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('reviewed','rejected','conflicted')),
 note text NOT NULL CHECK(length(btrim(note)) BETWEEN 1 AND 1000),
 related_fact_id uuid REFERENCES public.facts(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(related_fact_id IS NULL OR related_fact_id<>fact_id)
);
CREATE INDEX ON public.facts(status,created_at);
CREATE INDEX ON public.facts(document_id);
CREATE INDEX ON public.fact_reviews(fact_id);
INSERT INTO public.permissions(key,description) VALUES
 ('facts.propose','Create evidence-backed proposals'),('facts.review','Review proposals and flag conflicts');
-- Give existing complete administrators the new capabilities; no user identity or
-- mutable role name is used. Other role grants remain operator-configured.
INSERT INTO public.role_permissions(role_id,permission_key)
SELECT r.id,p.key FROM public.roles r CROSS JOIN public.permissions p
WHERE p.key IN ('facts.propose','facts.review')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='roles.manage')
AND EXISTS(SELECT 1 FROM public.role_permissions rp WHERE rp.role_id=r.id AND rp.permission_key='users.assign_roles');

ALTER TABLE public.facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fact_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.facts,public.evidence,public.fact_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.facts,public.evidence TO anon,authenticated;
GRANT SELECT ON public.fact_reviews TO authenticated;
CREATE POLICY facts_public ON public.facts FOR SELECT TO anon,authenticated USING(status IN ('reviewed','conflicted'));
CREATE POLICY facts_editors ON public.facts FOR SELECT TO authenticated USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));
CREATE POLICY evidence_visible ON public.evidence FOR SELECT TO anon,authenticated USING(EXISTS(SELECT 1 FROM public.facts f WHERE f.id=fact_id));
CREATE POLICY reviews_editors ON public.fact_reviews FOR SELECT TO authenticated USING(public.has_permission('facts.propose') OR public.has_permission('facts.review'));

CREATE FUNCTION public.propose_fact(p_document uuid,p_topic text,p_subject text,p_predicate text,p_value text,p_unit text,p_country uuid,p_from date,p_until date,p_excerpt text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid; d public.documents;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.propose') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_document_missing'; END IF;
 INSERT INTO public.facts(document_id,topic,subject,predicate,value,unit,country_id,valid_from,valid_until,created_by)
 VALUES(p_document,btrim(p_topic),btrim(p_subject),btrim(p_predicate),btrim(p_value),nullif(btrim(p_unit),''),p_country,p_from,p_until,auth.uid()) RETURNING id INTO result;
 -- Evidence URL/date come from the immutable document, never from a submitted URL.
 INSERT INTO public.evidence(fact_id,document_id,source_url,excerpt,retrieved_at)
 VALUES(result,d.id,d.canonical_url,btrim(p_excerpt),d.retrieved_at);
 RETURN result;
END $$;

CREATE FUNCTION public.review_fact(p_fact uuid,p_decision text,p_note text,p_related uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.facts;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 -- Serialize reviews so two operators cannot silently replace each other's decisions.
 PERFORM pg_advisory_xact_lock(919202604);
 SELECT * INTO f FROM public.facts WHERE id=p_fact FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_missing'; END IF;
 IF p_decision NOT IN ('reviewed','rejected','conflicted') OR p_decision IS NULL THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 IF p_decision='conflicted' THEN
   IF p_related IS NULL OR p_related=p_fact OR NOT EXISTS(SELECT 1 FROM public.facts WHERE id=p_related AND status IN ('proposed','reviewed','conflicted')) OR f.status='rejected' THEN RAISE EXCEPTION 'facts_invalid'; END IF;
   UPDATE public.facts SET status='conflicted' WHERE id IN (p_fact,p_related);
   INSERT INTO public.fact_reviews(fact_id,actor_id,decision,note,related_fact_id)
   VALUES(p_related,auth.uid(),p_decision,btrim(p_note),p_fact);
 ELSE
   IF f.status<>'proposed' THEN RAISE EXCEPTION 'facts_already_decided'; END IF;
   UPDATE public.facts SET status=p_decision,reviewed_at=CASE WHEN p_decision='reviewed' THEN now() ELSE NULL END WHERE id=p_fact;
 END IF;
 INSERT INTO public.fact_reviews(fact_id,actor_id,decision,note,related_fact_id)
 VALUES(p_fact,auth.uid(),p_decision,btrim(p_note),CASE WHEN p_decision='conflicted' THEN p_related ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text),public.review_fact(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.propose_fact(uuid,text,text,text,text,text,uuid,date,date,text),public.review_fact(uuid,text,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
