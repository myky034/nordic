import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { setTestLocale } from "@/test/i18n";
const { rows } = vi.hoisted(() => ({ rows: {} as Record<string, unknown> }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
// Forms are Client Components with server actions; render them as labelled stubs
// so the test can check which language each one is given.
vi.mock("./forms", () => {
  const stub = (name: string) => {
    const Stub = ({ locale }: { locale: string }) => <span data-form={name} data-locale={locale} />;
    Stub.displayName = `Stub(${name})`;
    return Stub;
  };
  return { ProjectForm: stub("project"), DeleteWorkspaceForm: stub("delete"), FileSavedSelect: stub("file"), RemoveSavedButton: stub("remove"),
    NoteForm: stub("note"), DeleteNoteButton: stub("delete-note"), PlanForm: stub("plan") };
});
// One chainable query stand-in: every table resolves to rows[table].
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (table: string) => {
  const result = { data: rows[table] ?? [], count: Array.isArray(rows[table]) ? (rows[table] as unknown[]).length : 0, error: null };
  const q: Record<string, unknown> = { then: (r: (v: unknown) => unknown) => r(result), maybeSingle: async () => ({ ...result, data: (rows[table] as unknown[] | undefined)?.[0] ?? null }) };
  for (const m of ["select", "eq", "not", "order", "limit", "range"]) q[m] = () => q;
  return q;
} }) }));
import WorkspacePage from "./page";
import PlanPage from "./plan/page";

afterEach(() => setTestLocale("vi"));
const render = async (locale: "vi" | "en") => {
  setTestLocale(locale);
  return renderToStaticMarkup(await WorkspacePage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }));
};

it("renders the workspace in Vietnamese by default and in English on request, passing the language to its forms", async () => {
  rows.saved_items = [{ id: "s1", project_id: null, created_at: "2026-10-01T00:00:00Z", programmes: { id: "p1", name: "Synthetic Programme" } }];
  const vi = await render("vi");
  for (const v of ["Không gian của tôi", "Dự án nghiên cứu", "Chương trình", 'data-locale="vi"']) expect(vi).toContain(v);
  const en = await render("en");
  for (const v of ["My workspace", "Research projects", "Saved 2026-10-01", "Programme", "Delete all workspace data", 'data-locale="en"', "Synthetic Programme"]) expect(en).toContain(v);
  expect(en).not.toContain("Không gian của tôi");
});

it("builds plan shortcuts in the viewer's language, as filters rather than recommendations", async () => {
  rows.user_plans = [{ target_degree: "master", target_role: "Data Analyst" }];
  rows.user_plan_countries = [{ country_id: "c1", countries: { slug: "sweden", name: "Sweden" } }, { country_id: "c2", countries: { slug: "denmark", name: "Denmark" } }];
  setTestLocale("en");
  const html = renderToStaticMarkup(await PlanPage());
  for (const v of ["My Europe plan", "not recommendations", "Compare the countries you are interested in", "Master&#x27;s programmes in Sweden", "Immigration rules in Denmark", "Occupation: Data Analyst"]) expect(html).toContain(v);
});
