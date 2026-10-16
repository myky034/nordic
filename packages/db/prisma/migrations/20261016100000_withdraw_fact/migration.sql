-- L7b-0 · audited withdrawal of a reviewed fact (Linear KHLOE-166).
-- Design: L7b V3 final gate (owner-approved design, 2026-10-16), decisions D9 / D9a.
--
-- The existing workflow cannot take back a reviewed fact: review_fact() and
-- set_fact_type() refuse anything that is not "proposed", and
-- resolve_source_change() needs a flagged source change. withdraw_fact() does
-- it, with a mandatory note and an append-only fact_reviews row
-- (decision "withdrawn"). Additive only: no existing row is changed by this
-- migration; the CHECK on fact_reviews.decision becomes a superset.
-- Recovery: packages/db/prisma/recovery/20261016100000_withdraw_fact.forward-fix.sql
BEGIN;

ALTER TABLE public.fact_reviews DROP CONSTRAINT fact_reviews_decision_check;
ALTER TABLE public.fact_reviews ADD CONSTRAINT fact_reviews_decision_check
 CHECK (decision IN ('reviewed','rejected','conflicted','revalidated','superseded','withdrawn'));

CREATE FUNCTION public.withdraw_fact(p_fact uuid, p_note text, p_related uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.facts; v_note text;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 -- Same review lock as review_fact: decisions cannot silently overwrite each other.
 PERFORM pg_advisory_xact_lock(919202604);
 -- Trims tabs and line breaks too (btrim alone trims only spaces), so a note of only whitespace
 -- is refused. Stricter than the gate copy; review_fact keeps its existing behaviour.
 v_note := btrim(p_note, E' \t\n\r\f');
 IF v_note IS NULL OR length(v_note) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 SELECT * INTO f FROM public.facts WHERE id = p_fact FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_missing'; END IF;
 IF f.status NOT IN ('reviewed','conflicted') THEN RAISE EXCEPTION 'facts_not_withdrawable'; END IF;
 -- A pending source change has its own decision (resolve_source_change).
 IF f.source_changed_at IS NOT NULL THEN RAISE EXCEPTION 'facts_source_change_pending'; END IF;
 -- "Withdrawn as a duplicate of": the kept fact must exist, be another fact and be published.
 -- Deliberately reviewer-controlled (PR #7 review M2): a duplicate can sit on another page or
 -- source, at another entity level, or be untyped, so no equivalence rule is enforced here. The
 -- link is audit context only; nothing reads related_fact_id to decide visibility or status.
 IF p_related IS NOT NULL AND (p_related = p_fact
     OR NOT EXISTS (SELECT 1 FROM public.facts WHERE id = p_related AND status IN ('reviewed','conflicted'))) THEN
   RAISE EXCEPTION 'facts_invalid';
 END IF;
 -- reviewed_at is kept, as resolve_source_change() keeps it for 'superseded' / 'rejected':
 -- the fact WAS reviewed at that time. status and fact_reviews say it is withdrawn now.
 UPDATE public.facts SET status = 'rejected' WHERE id = p_fact;
 INSERT INTO public.fact_reviews(fact_id, actor_id, decision, note, related_fact_id)
 VALUES (p_fact, auth.uid(), 'withdrawn', v_note, p_related);
END $$;

REVOKE ALL ON FUNCTION public.withdraw_fact(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_fact(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
