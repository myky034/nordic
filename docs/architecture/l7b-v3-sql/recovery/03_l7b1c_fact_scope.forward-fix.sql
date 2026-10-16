-- FORWARD-FIX for 03 (NOT APPLIED). Removes only what 03 added. Scope values and their evidence
-- are LOST (export fact_scope_changes / fact_scope_evidence first if any were set).
BEGIN;
DROP FUNCTION IF EXISTS public.set_fact_scope(uuid, jsonb, jsonb, text), public.scope_excerpt_ok(uuid, text, uuid, text, text, int[], jsonb);
DROP TABLE IF EXISTS public.fact_scope_changes, public.fact_scope_evidence;
DROP INDEX IF EXISTS public.facts_intake_idx;
ALTER TABLE public.facts DROP CONSTRAINT IF EXISTS facts_applicant_scope, DROP CONSTRAINT IF EXISTS facts_intake_scope,
  DROP CONSTRAINT IF EXISTS facts_intake_fk,
  DROP COLUMN IF EXISTS academic_year, DROP COLUMN IF EXISTS admission_round_label, DROP COLUMN IF EXISTS applicant_group_id,
  DROP COLUMN IF EXISTS applicant_group_label, DROP COLUMN IF EXISTS applicant_scope, DROP COLUMN IF EXISTS intake_id, DROP COLUMN IF EXISTS intake_scope;
DROP TRIGGER IF EXISTS fact_types_scope_levels_default ON public.fact_types;
DROP FUNCTION IF EXISTS public.fact_types_scope_levels_default();
ALTER TABLE public.fact_types DROP CONSTRAINT IF EXISTS fact_types_scope_levels_primary, DROP CONSTRAINT IF EXISTS fact_types_scope_levels_known,
  DROP COLUMN IF EXISTS scope_levels;
NOTIFY pgrst, 'reload schema';
COMMIT;
