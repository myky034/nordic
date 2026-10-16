-- SUPERSEDED (2026-10-16): applied as packages/db/prisma/migrations/20261016100000_withdraw_fact/migration.sql
-- (PR #7), which differs: tab/newline note trimming, reviewed_at kept. Do not use this copy.
-- PROPOSED MIGRATION (NOT APPLIED) · L7b-0 · KHLOE-166
-- Review copy only. Lives outside prisma/migrations on purpose: `prisma migrate deploy`
-- never sees it. On approval it is copied to
-- packages/db/prisma/migrations/<timestamp>_withdraw_fact/migration.sql in its own PR.
--
-- D9 / D9a (approved): the existing workflow cannot take back a reviewed fact
-- (review_fact and set_fact_type refuse anything not "proposed";
-- resolve_source_change needs a source change). withdraw_fact() does it, with a
-- note and an append-only fact_reviews row. Additive only.
BEGIN;

ALTER TABLE public.fact_reviews DROP CONSTRAINT fact_reviews_decision_check;
ALTER TABLE public.fact_reviews ADD CONSTRAINT fact_reviews_decision_check
 CHECK (decision IN ('reviewed','rejected','conflicted','revalidated','superseded','withdrawn'));

CREATE FUNCTION public.withdraw_fact(p_fact uuid, p_note text, p_related uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.facts;
BEGIN
 PERFORM pg_advisory_xact_lock_shared(918202603);
 IF NOT public.has_permission('facts.review') THEN RAISE EXCEPTION 'facts_forbidden'; END IF;
 -- Same review lock as review_fact: decisions cannot silently overwrite each other.
 PERFORM pg_advisory_xact_lock(919202604);
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'facts_invalid'; END IF;
 SELECT * INTO f FROM public.facts WHERE id = p_fact FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'facts_missing'; END IF;
 IF f.status NOT IN ('reviewed','conflicted') THEN RAISE EXCEPTION 'facts_not_withdrawable'; END IF;
 -- A pending source change has its own decision (resolve_source_change).
 IF f.source_changed_at IS NOT NULL THEN RAISE EXCEPTION 'facts_source_change_pending'; END IF;
 -- "Withdrawn as a duplicate of": the kept fact must exist, be another fact and be published.
 IF p_related IS NOT NULL AND (p_related = p_fact
     OR NOT EXISTS (SELECT 1 FROM public.facts WHERE id = p_related AND status IN ('reviewed','conflicted'))) THEN
   RAISE EXCEPTION 'facts_invalid';
 END IF;
 UPDATE public.facts SET status = 'rejected', reviewed_at = NULL WHERE id = p_fact;
 INSERT INTO public.fact_reviews(fact_id, actor_id, decision, note, related_fact_id)
 VALUES (p_fact, auth.uid(), 'withdrawn', btrim(p_note), p_related);
END $$;

REVOKE ALL ON FUNCTION public.withdraw_fact(uuid, text, uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_fact(uuid, text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
