-- FORWARD-FIX for 01 (NOT APPLIED). Used as the body of a NEW migration if 01 must be removed.
-- Withdrawn decisions already recorded stay as history; the CHECK keeps accepting them.
BEGIN;
DROP FUNCTION IF EXISTS public.withdraw_fact(uuid, text, uuid);
NOTIFY pgrst, 'reload schema';
COMMIT;
