-- FORWARD-FIX for 20261016100000_withdraw_fact. NOT a migration and never run by hand on the
-- shared database: if L7b-0 must be removed after it was applied, this file becomes the body of a
-- NEW migration (packages/db/prisma/migrations/<timestamp>_remove_withdraw_fact/migration.sql),
-- reviewed and approved like any other. Runbook: docs/architecture/l7b-0-migration-runbook.md
--
-- What it does: removes withdraw_fact(). What it keeps, on purpose:
-- - every fact it withdrew stays "rejected" (a withdrawal is a reviewed decision, not undone here);
-- - every fact_reviews row with decision 'withdrawn' (audit history), so the CHECK keeps accepting
--   'withdrawn'. The CHECK is NOT narrowed back: that would fail on, or require deleting, history.
BEGIN;
DROP FUNCTION IF EXISTS public.withdraw_fact(uuid, text, uuid);
NOTIFY pgrst, 'reload schema';
COMMIT;
