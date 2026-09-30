import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
// The patterns page must never touch the database: fail loudly if it tries.
vi.mock("@/lib/supabase/server", () => ({ createClient: () => { throw new Error("DB_ACCESS"); } }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => { throw new Error("DB_ACCESS"); } }));
// Client-only pieces (router hook, Server Action form) are covered elsewhere.
vi.mock("./keys", () => ({ KeyNav: () => null }));
vi.mock("@/app/(app)/admin/sources/forms", () => ({ SourceForm: () => null }));
import PatternsPage from "./page";
afterEach(() => { vi.unstubAllEnvs(); });
const render = async (query: Record<string, string> = {}) => renderToStaticMarkup(await PatternsPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }));

it("returns 404 in production builds", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(render()).rejects.toThrow("NOT_FOUND");
});

it("renders all six patterns with DEMO data only", async () => {
  const expected: Record<string, string> = {
    inspector: "DEMO Source 01", table: "Tài liệu", focus: "Thoát chế độ tập trung",
    three: "Phân quyền", cards: "DEMO University A", accordion: "demo-log",
  };
  for (const [p, text] of Object.entries(expected)) {
    const html = await render({ p });
    expect(html).toContain("DEMO — dữ liệu giả");
    expect(html).toContain(text);
    const hosts = [...html.matchAll(/href="https?:\/\/([^/"]+)/g)].map((m) => m[1]);
    expect(hosts.every((h) => h.endsWith("example.test"))).toBe(true);
  }
});

it("opens the inspector from the URL and sorts and filters the table", async () => {
  expect(await render({ p: "inspector", open: "ps3" })).toContain('role="dialog"');
  const table = await render({ p: "table", sort: "documents", dir: "desc", status: "verified" });
  expect(table).not.toContain("Chưa xác minh</span></td>");
  expect(table).toMatch(/\d+ \/ 14 nguồn/);
});

it("shows the end of the queue after the last item in focus mode", async () => {
  expect(await render({ p: "focus", i: "99" })).toContain("Đã xem hết");
});
