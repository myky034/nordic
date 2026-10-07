import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
vi.mock("./actions", () => ({ saveCareerPath: async () => ({}) }));
// Esc-to-close needs a mounted router; the page is what is tested here.
vi.mock("@/components/key-nav", () => ({ KeyNav: () => null }));
import { setTestLocale } from "@/test/i18n";
import Page from "./page";

// Synthetic rows only. Each query on `table` resolves to rows[table].
const client = (rows: Record<string, unknown[]>) => ({
  from: (table: string) => {
    const result = { data: rows[table] ?? [], error: null };
    const q = { select: () => q, eq: () => q, order: () => q, then: (r: (v: typeof result) => unknown) => r(result) };
    return q;
  },
});
const page = async (q: Record<string, string> = {}) => renderToStaticMarkup(await Page({ params: Promise.resolve({}), searchParams: Promise.resolve(q) }));
const path = { id: "11111111-1111-4111-8111-111111111111", key: "it_product_management", name_vi: "Quản lý sản phẩm CNTT", name_en: "IT product management",
  definition_vi: "Định nghĩa", definition_en: "Definition", include_rule: "Must state product management", exclude_rule: null, keywords: ["agile"], version: 2, active: false, updated_at: "2026-10-06T00:00:00Z" };
const field = (id: string, code: string, parent: string | null, en: string, vi: string) =>
  ({ id, code, level: code.length - 1, parent_id: parent, name_en: en, name_vi: vi, document_id: "d1", source_page: 56, verified_by: "Synthetic reviewer", verified_on: "2026-10-06" });
afterEach(() => setTestLocale("vi"));

it("is only for holders of taxonomy.manage", async () => {
  ctx.mockResolvedValue({ client: client({}), permissions: ["roles.manage", "education.manage"] });
  expect(await page()).toContain("Không có quyền quản lý ngành &amp; hướng nghề");
});
it("lists career paths and opens one with its version history", async () => {
  ctx.mockResolvedValue({ client: client({ career_paths: [path], career_path_versions: [{ id: "v2", version: 2, changed_at: "2026-10-06T10:00:00Z", include_rule: "Rule v2" }] }), permissions: ["taxonomy.manage"] });
  const list = await page();
  expect(list).toContain("Quản lý sản phẩm CNTT");
  expect(list).toContain("Ngừng dùng");
  const open = await page({ path: path.id });
  expect(open).toContain("Lịch sử phiên bản");
  expect(open).toContain("Rule v2");
  expect(open).toContain("không phải ngành học chính thức");
});
it("explains that the field list is not imported yet, and shows the tree once it is", async () => {
  ctx.mockResolvedValue({ client: client({ study_fields: [] }), permissions: ["taxonomy.manage"] });
  expect(await page({ tab: "fields" })).toContain("Chưa nhập danh mục ngành");
  setTestLocale("en");
  ctx.mockResolvedValue({ client: client({ study_fields: [field("a", "06", null, "Synthetic broad field", "Ngành rộng giả"), field("b", "061", "a", "Synthetic narrow field", "Ngành hẹp giả"), field("c", "0613", "b", "Synthetic software field", "Ngành phần mềm giả")] }), permissions: ["taxonomy.manage"] });
  const html = await page({ tab: "fields", q: "software" });
  expect(html).toContain("Synthetic software field");
  expect(html).toContain("page 56");
  expect(html).toContain("Checked by Synthetic reviewer on 2026-10-06");
  expect(await page({ tab: "fields", q: "zzz" })).toContain("No field matches");
});
it("asks for both languages in the career path form, with no Vietnamese left in English", async () => {
  const { CareerPathForm } = await import("./forms");
  const html = renderToStaticMarkup(<CareerPathForm locale="en" path={path} />);
  expect(html).toContain("Vietnamese name");
  expect(html).toContain("English name");
  expect(html).toMatch(/disabled=""[^>]*value="it_product_management"|value="it_product_management"[^>]*disabled=""/);
  expect(html.replace(/Quản lý sản phẩm CNTT|Định nghĩa/g, "")).not.toMatch(/[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựđ]/);
});
