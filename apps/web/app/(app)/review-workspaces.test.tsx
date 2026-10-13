import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { ctx, calls } = vi.hoisted(() => ({ ctx: vi.fn(), calls: [] as [string, string, unknown][] }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: async () => ({}) }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
vi.mock("@/lib/review/public-check", () => ({ publicIds: async () => new Set<string>() }));
vi.mock("@/components/review/review-steps", () => ({ ReviewSteps: () => null }));
vi.mock("./education/workspace/forms", () => ({ EducationReviewForm: () => null, ProgrammeForm: () => null, UniversityForm: () => null, ClassificationForm: () => null, ClassificationReviewForm: () => null }));
vi.mock("./immigration/workspace/forms", () => ({ RuleForm: () => null, RuleReviewForm: () => null }));
vi.mock("./labour/workspace/forms", () => ({ OccupationForm: () => null, OccupationReviewForm: () => null }));
import Education from "./education/workspace/page";
import Immigration from "./immigration/workspace/page";
import Labour from "./labour/workspace/page";

// Records every .eq(column, value) per table; every query resolves empty.
const client = {
  from: (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "order", "range", "limit", "ilike", "neq", "in", "or", "not", "is"]) q[m] = () => q;
    q.eq = (column: string, value: unknown) => { calls.push([table, column, value]); return q; };
    q.then = (r: (v: unknown) => unknown) => r({ data: [], count: 0, error: null });
    return q;
  },
};
const pages = [["universities", Education], ["immigration_rules", Immigration], ["occupations", Labour]] as const;

// Regression (2026-10-07): tab lists became plain strings in the i18n work
// while two call sites still destructured them as [value, label] pairs, so
// only the first letter ("r") was used and the "reviewed" tab never opened.
it.each(pages)("filters %s by the full status of the chosen tab and counts every tab", async (table, Page) => {
  ctx.mockResolvedValue({ client, permissions: ["facts.review", "education.manage", "immigration.manage", "labour.manage"] });
  calls.length = 0;
  renderToStaticMarkup(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve({ status: "reviewed" }) }));
  const statuses = calls.filter(([t, c]) => t === table && c === "status").map(([, , v]) => v);
  expect(statuses).toContain("reviewed");
  expect(new Set(statuses)).toEqual(new Set(["reviewed", "proposed", "rejected"]));
});
