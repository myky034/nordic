BEGIN;

-- Integrity fix (review of Slices 1-4, 2026-09-23).
--
-- Before: review_fact allowed a *proposed* fact to be marked 'conflicted'.
-- facts_public exposes 'conflicted' rows to anonymous users, so two claims
-- nobody had ever checked against their evidence could become public just by
-- being flagged as contradicting each other (AGENTS.md Section 1.3: a proposal
-- must not be promoted without validation).
--
-- After: both sides of a conflict must already have passed evidence review
-- ('reviewed') or already be part of a conflict ('conflicted'). A proposal that
-- contradicts a published claim must first be reviewed or rejected on its own.
-- Everything else in the function is unchanged (same signature, locks, audit).
CREATE OR REPLACE FUNCTION public.review_fact(p_fact uuid,p_decision text,p_note text,p_related uuid DEFAULT NULL)
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
   IF p_related IS NULL OR p_related=p_fact THEN RAISE EXCEPTION 'facts_invalid'; END IF;
   -- Only evidence-reviewed claims may be published as a conflict pair.
   IF f.status NOT IN ('reviewed','conflicted')
     OR NOT EXISTS(SELECT 1 FROM public.facts WHERE id=p_related AND status IN ('reviewed','conflicted')) THEN
     RAISE EXCEPTION 'facts_conflict_requires_review';
   END IF;
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
-- CREATE OR REPLACE keeps existing grants; restate them so the file is self-evident.
REVOKE ALL ON FUNCTION public.review_fact(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.review_fact(uuid,text,text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
