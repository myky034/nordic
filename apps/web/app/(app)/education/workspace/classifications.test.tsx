import { prerender } from "react-dom/static";
import { afterEach, expect, it, vi } from "vitest";
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: async () => ({}) }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
vi.mock("@/lib/review/public-check", () => ({ publicIds: async () => new Set<string>() }));
vi.mock("@/components/review/review-steps", () => ({ ReviewSteps: () => null }));
vi.mock("./forms", () => ({
  EducationReviewForm: () => null, ProgrammeForm: () => null, UniversityForm: () => null,
  ClassificationForm: ({ programmes, fields, paths }: { programmes: unknown[]; fields: { code: string }[]; paths: unknown[] }) =>
    <p>CLASSIFY_FORM {programmes.length}/{fields.map((f) => f.code).join(",")}/{paths.length}</p>,
  ClassificationReviewForm: ({ id, revalidate }: { id: string; revalidate?: boolean }) => <p>REVIEW_FORM {id} {revalidate ? "revalidate" : "decide"}</p>,
}));
import { setTestLocale } from "@/test/i18n";
import Page from "./page";

// Synthetic rows only. Every query on a table resolves to rows[table].
const client = (rows: Record<string, unknown[]>) => ({
  from: (table: string) => {
    const result = { data: rows[table] ?? [], count: (rows[table] ?? []).length, error: null };
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "not", "in", "ilike", "order", "range", "limit", "neq"]) q[m] = () => q;
    q.then = (r: (v: typeof result) => unknown) => r(result);
    return q;
  },
});
const path = (version: number) => ({ name_vi: "Hướng nghề giả", name_en: "Synthetic career path", version, include_rule: "Must state X", exclude_rule: "Not Y", active: true });
const row = (id: string, status: string, stored: number | null, current: number | null) => ({
  id, status, evidence_excerpt: "Synthetic excerpt", document_id: "d1", career_path_version: stored,
  programmes: { id: "p1", name: "MSc Synthetic", degree_type: "master", universities: { name: "Synthetic University" } },
  study_fields: current === null ? { code: "0613", name_en: "Software and applications development and analysis", name_vi: "Phát triển phần mềm" } : null,
  career_paths: current === null ? null : path(current),
});
// prerender (not renderToStaticMarkup) waits for nested async server
// components such as ClassificationSection.
const page = async (q: Record<string, string>) => {
  const { prelude } = await prerender(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({ kind: "classification", ...q }) }));
  return (await new Response(prelude).text()).replaceAll("<!-- -->", "");
};
afterEach(() => setTestLocale("vi"));

it("offers the propose form with classifiable fields only, and shows proposals with their criteria and a decision", async () => {
  ctx.mockResolvedValue({ permissions: ["education.manage", "facts.review"], client: client({
    programme_classifications: [row("c1", "proposed", 1, 1), row("c2", "proposed", null, null)],
    programmes: [{ id: "p1", name: "MSc Synthetic", degree_type: "master", official_url: "https://uni.example.test/p", universities: { name: "U" } }],
    study_fields: [{ id: "f1", code: "0613", level: 3, name_en: "Software", name_vi: "Phần mềm" }, { id: "f2", code: "9999", level: 3, name_en: "Field unknown", name_vi: "Không rõ" }],
    career_paths: [{ id: "cp", ...path(1) }],
  }) });
  const html = await page({});
  expect(html).toContain("CLASSIFY_FORM 1/0613/1");
  expect(html).toContain("Hướng nghề giả (hướng nghề của Nordic)");
  expect(html).toContain("0613 · Phát triển phần mềm");
  expect(html).toContain("Must state X");
  expect(html).toContain("REVIEW_FORM c1 decide");
  expect(html).toContain("REVIEW_FORM c2 decide");
});
it("lists only classifications judged against older criteria under 'needs re-review', in English too", async () => {
  setTestLocale("en");
  ctx.mockResolvedValue({ permissions: ["facts.review"], client: client({ programme_classifications: [row("old", "reviewed", 1, 2), row("current", "reviewed", 2, 2)] }) });
  const html = await page({ status: "stale" });
  expect(html).toContain("REVIEW_FORM old revalidate");
  expect(html).not.toContain("REVIEW_FORM current");
  expect(html).toContain("Reviewed against criteria version 1; the criteria are now version 2.");
  expect(html).not.toContain("CLASSIFY_FORM"); // no education.manage
});
it("does not offer decisions to editors who cannot review", async () => {
  ctx.mockResolvedValue({ permissions: ["education.manage"], client: client({ programme_classifications: [row("c1", "proposed", 1, 1)] }) });
  expect(await page({})).not.toContain("REVIEW_FORM");
});
