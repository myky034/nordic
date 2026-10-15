-- FORWARD-FIX for migration 20261016090000_document_structures (PR 1).
--
-- NOT a migration and NOT applied automatically: this directory is outside
-- prisma/migrations, so `prisma migrate deploy` never reads it. Use it only if
-- PR 1's objects must be removed AFTER the migration was applied successfully,
-- by copying it into a NEW migration directory (e.g.
-- prisma/migrations/<timestamp>_remove_document_structures/migration.sql) and
-- deploying that through Prisma, so the migration history stays truthful.
-- Never delete rows from _prisma_migrations by hand.
--
-- Effect: removes only what PR 1 added (view, function, table and its policy
-- and index). Documents, document_texts, crawler tables, facts and every
-- existing policy are untouched; structure snapshots are lost (they can be
-- recreated by crawling again after a fixed re-introduction).
-- Revert the crawler code (PR 1 merge) FIRST, otherwise each crawl logs
-- structure_failed (text is still stored).
-- Verified by apps/web/lib/crawler/structure-recovery.database.test.ts.

BEGIN;
DROP VIEW IF EXISTS public.document_structures_latest;
DROP FUNCTION IF EXISTS public.crawler_record_structure(uuid, uuid, text, jsonb, timestamptz);
DROP TABLE IF EXISTS public.document_structures;
NOTIFY pgrst, 'reload schema';
COMMIT;
