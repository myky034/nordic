BEGIN;

-- Slice 8 — research workspace, bookmarks, notes, My Europe Plan.
-- Decisions confirmed by the project owner on 2026-09-27 (PROJECT_SPEC.md
-- Section 21):
--   1. Bookmarks reference items through real foreign keys (one column per
--      kind, exactly one set) — AGENTS.md 4.5.
--   2. One goals profile per user (user_plans = "My Europe Plan"); the spec's
--      personal_plans is merged into research_projects (each project has its
--      own target year / role / countries).
--   3. Optional budget (amount + ISO currency + period), owner-only, never
--      used in any calculation.
--   4. Personal data is deleted with the account (ON DELETE CASCADE) and can be
--      wiped by the owner at any time (delete_my_workspace()).
--
-- This is the first USER-PRIVATE data in the system (AGENTS.md 5.2). Every
-- table is owner-only through RLS: no anonymous access, no admin read path in
-- the app, and no SECURITY DEFINER bypass. Unlike research data, owners may
-- edit and delete their rows freely: this is personal data, not evidence.

CREATE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE TABLE public.research_projects (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 description text CHECK(description IS NULL OR length(description) <= 2000),
 target_year integer CHECK(target_year IS NULL OR target_year BETWEEN 2000 AND 2100),
 target_role text CHECK(target_role IS NULL OR length(btrim(target_role)) BETWEEN 1 AND 120),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_projects_user_idx ON public.research_projects(user_id, status, updated_at DESC);
CREATE TRIGGER research_projects_touch BEFORE UPDATE ON public.research_projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.research_project_countries (
 project_id uuid NOT NULL REFERENCES public.research_projects(id) ON DELETE CASCADE,
 country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
 PRIMARY KEY(project_id, country_id)
);

-- Bookmarks: exactly one referenced item, one bookmark per item per user; a
-- bookmark may be filed in one of the owner's projects.
CREATE TABLE public.saved_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid REFERENCES public.research_projects(id) ON DELETE SET NULL,
 country_id uuid REFERENCES public.countries(id) ON DELETE CASCADE,
 university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
 programme_id uuid REFERENCES public.programmes(id) ON DELETE CASCADE,
 immigration_rule_id uuid REFERENCES public.immigration_rules(id) ON DELETE CASCADE,
 occupation_id uuid REFERENCES public.occupations(id) ON DELETE CASCADE,
 source_id uuid REFERENCES public.sources(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(country_id, university_id, programme_id, immigration_rule_id, occupation_id, source_id) = 1)
);
CREATE UNIQUE INDEX saved_items_country_key ON public.saved_items(user_id, country_id) WHERE country_id IS NOT NULL;
CREATE UNIQUE INDEX saved_items_university_key ON public.saved_items(user_id, university_id) WHERE university_id IS NOT NULL;
CREATE UNIQUE INDEX saved_items_programme_key ON public.saved_items(user_id, programme_id) WHERE programme_id IS NOT NULL;
CREATE UNIQUE INDEX saved_items_rule_key ON public.saved_items(user_id, immigration_rule_id) WHERE immigration_rule_id IS NOT NULL;
CREATE UNIQUE INDEX saved_items_occupation_key ON public.saved_items(user_id, occupation_id) WHERE occupation_id IS NOT NULL;
CREATE UNIQUE INDEX saved_items_source_key ON public.saved_items(user_id, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX saved_items_user_idx ON public.saved_items(user_id, created_at DESC);
CREATE INDEX saved_items_project_idx ON public.saved_items(project_id);

CREATE TABLE public.notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 project_id uuid REFERENCES public.research_projects(id) ON DELETE CASCADE,
 country_id uuid REFERENCES public.countries(id) ON DELETE CASCADE,
 university_id uuid REFERENCES public.universities(id) ON DELETE CASCADE,
 programme_id uuid REFERENCES public.programmes(id) ON DELETE CASCADE,
 immigration_rule_id uuid REFERENCES public.immigration_rules(id) ON DELETE CASCADE,
 occupation_id uuid REFERENCES public.occupations(id) ON DELETE CASCADE,
 source_id uuid REFERENCES public.sources(id) ON DELETE CASCADE,
 content text NOT NULL CHECK(length(btrim(content)) BETWEEN 1 AND 10000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(country_id, university_id, programme_id, immigration_rule_id, occupation_id, source_id) <= 1)
);
CREATE INDEX notes_user_idx ON public.notes(user_id, updated_at DESC);
CREATE INDEX notes_project_idx ON public.notes(project_id);
CREATE TRIGGER notes_touch BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- My Europe Plan: one goals profile per user.
CREATE TABLE public.user_plans (
 user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 current_position text CHECK(current_position IS NULL OR length(btrim(current_position)) BETWEEN 1 AND 120),
 education text CHECK(education IS NULL OR length(education) <= 500),
 target_role text CHECK(target_role IS NULL OR length(btrim(target_role)) BETWEEN 1 AND 120),
 target_degree text CHECK(target_degree IS NULL OR target_degree IN ('bachelor','master','phd','other')),
 target_year integer CHECK(target_year IS NULL OR target_year BETWEEN 2000 AND 2100),
 language_goals text CHECK(language_goals IS NULL OR length(language_goals) <= 500),
 application_status text CHECK(application_status IS NULL OR application_status IN
   ('exploring','preparing','applying','awaiting_decision','admitted','paused')),
 -- Budget is all-or-nothing and is never used by the system for any calculation.
 budget_amount numeric(12,2) CHECK(budget_amount IS NULL OR budget_amount >= 0),
 budget_currency text CHECK(budget_currency IS NULL OR budget_currency ~ '^[A-Z]{3}$'),
 budget_period text CHECK(budget_period IS NULL OR budget_period IN ('total','per_year','per_month')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nulls(budget_amount, budget_currency, budget_period) IN (0,3))
);
CREATE TRIGGER user_plans_touch BEFORE UPDATE ON public.user_plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.user_plan_countries (
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.user_plans(user_id) ON DELETE CASCADE,
 country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
 PRIMARY KEY(user_id, country_id)
);

-- "May this user attach this item?" Only items the PUBLIC can see: the same
-- status rules as the public pages. SECURITY INVOKER, so the caller's RLS also
-- applies (a hidden immigration rule or occupation is simply not found).
CREATE FUNCTION public.workspace_item_visible(p_country uuid, p_university uuid, p_programme uuid, p_rule uuid, p_occupation uuid, p_source uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT CASE
  WHEN p_country IS NOT NULL THEN EXISTS(SELECT 1 FROM public.countries WHERE id=p_country)
  WHEN p_university IS NOT NULL THEN EXISTS(SELECT 1 FROM public.universities WHERE id=p_university AND status='reviewed')
  WHEN p_programme IS NOT NULL THEN EXISTS(SELECT 1 FROM public.programmes p JOIN public.universities u ON u.id=p.university_id
    WHERE p.id=p_programme AND p.status='reviewed' AND u.status='reviewed')
  WHEN p_rule IS NOT NULL THEN EXISTS(SELECT 1 FROM public.immigration_rules r JOIN public.documents d ON d.id=r.document_id JOIN public.sources s ON s.id=d.source_id
    WHERE r.id=p_rule AND r.status='reviewed' AND s.status='verified' AND s.source_tier='T1')
  WHEN p_occupation IS NOT NULL THEN EXISTS(SELECT 1 FROM public.occupations WHERE id=p_occupation AND status='reviewed')
  WHEN p_source IS NOT NULL THEN EXISTS(SELECT 1 FROM public.sources WHERE id=p_source)
  ELSE true END
$$;
CREATE FUNCTION public.owns_project(p_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p_project IS NULL OR EXISTS(SELECT 1 FROM public.research_projects WHERE id=p_project AND user_id=auth.uid())
$$;

ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research_project_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plan_countries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.research_projects, public.research_project_countries, public.saved_items, public.notes,
 public.user_plans, public.user_plan_countries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_projects, public.research_project_countries, public.saved_items,
 public.notes, public.user_plans, public.user_plan_countries TO authenticated;

CREATE POLICY research_projects_owner ON public.research_projects FOR ALL TO authenticated
 USING(user_id = auth.uid()) WITH CHECK(user_id = auth.uid());
CREATE POLICY research_project_countries_owner ON public.research_project_countries FOR ALL TO authenticated
 USING(public.owns_project(project_id)) WITH CHECK(public.owns_project(project_id));
CREATE POLICY saved_items_owner ON public.saved_items FOR ALL TO authenticated
 USING(user_id = auth.uid())
 WITH CHECK(user_id = auth.uid() AND public.owns_project(project_id)
   AND public.workspace_item_visible(country_id, university_id, programme_id, immigration_rule_id, occupation_id, source_id));
CREATE POLICY notes_owner ON public.notes FOR ALL TO authenticated
 USING(user_id = auth.uid())
 WITH CHECK(user_id = auth.uid() AND public.owns_project(project_id)
   AND public.workspace_item_visible(country_id, university_id, programme_id, immigration_rule_id, occupation_id, source_id));
CREATE POLICY user_plans_owner ON public.user_plans FOR ALL TO authenticated
 USING(user_id = auth.uid()) WITH CHECK(user_id = auth.uid());
CREATE POLICY user_plan_countries_owner ON public.user_plan_countries FOR ALL TO authenticated
 USING(user_id = auth.uid()) WITH CHECK(user_id = auth.uid());

-- Owner-initiated wipe of all personal workspace data. SECURITY INVOKER: it can
-- only ever delete the caller's own rows, because RLS scopes every DELETE.
CREATE FUNCTION public.delete_my_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_notes int; v_saved int; v_projects int; v_plan int;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'workspace_unauthenticated'; END IF;
 DELETE FROM public.notes WHERE user_id = auth.uid(); GET DIAGNOSTICS v_notes = ROW_COUNT;
 DELETE FROM public.saved_items WHERE user_id = auth.uid(); GET DIAGNOSTICS v_saved = ROW_COUNT;
 DELETE FROM public.research_projects WHERE user_id = auth.uid(); GET DIAGNOSTICS v_projects = ROW_COUNT;
 DELETE FROM public.user_plans WHERE user_id = auth.uid(); GET DIAGNOSTICS v_plan = ROW_COUNT;
 RETURN jsonb_build_object('notes', v_notes, 'saved', v_saved, 'projects', v_projects, 'plan', v_plan);
END $$;

REVOKE ALL ON FUNCTION public.workspace_item_visible(uuid,uuid,uuid,uuid,uuid,uuid), public.owns_project(uuid),
 public.delete_my_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_item_visible(uuid,uuid,uuid,uuid,uuid,uuid), public.owns_project(uuid),
 public.delete_my_workspace() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
