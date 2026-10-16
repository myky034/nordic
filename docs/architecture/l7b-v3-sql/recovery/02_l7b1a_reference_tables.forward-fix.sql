-- FORWARD-FIX for 02 (NOT APPLIED). Removes only what 02 added, in reverse order.
-- Refuses to run if 03 is still present (facts reference programme_intakes / applicant_groups).
BEGIN;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='facts' AND column_name='intake_id') THEN
   RAISE EXCEPTION 'remove 03 (fact scope) first';
 END IF;
END $$;
DROP FUNCTION IF EXISTS public.review_l7b(text, uuid, text, text), public.set_programme_code(uuid, text, uuid, text, text),
  public.propose_applicant_group_alias(uuid, text, uuid, uuid, text), public.propose_applicant_group(uuid, text, text, text, text, text, text),
  public.propose_official_page_link(uuid, uuid, uuid), public.propose_official_page(uuid, text, uuid, uuid, text),
  public.propose_programme_intake(uuid, int, text, int, text, text, text, uuid, text);
DROP TABLE IF EXISTS public.l7b_reviews, public.applicant_group_aliases, public.applicant_groups,
  public.official_page_links, public.official_pages, public.programme_intakes;
DROP FUNCTION IF EXISTS public.l7b_editor(), public.l7b_excerpt_in_document(uuid, text);
DROP INDEX IF EXISTS public.programmes_code_key;
ALTER TABLE public.programmes DROP CONSTRAINT IF EXISTS programmes_code_evidence,
  DROP COLUMN IF EXISTS programme_code_excerpt, DROP COLUMN IF EXISTS programme_code_document_id, DROP COLUMN IF EXISTS programme_code;
NOTIFY pgrst, 'reload schema';
COMMIT;
