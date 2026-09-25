import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
// The preview must never touch the database: fail loudly if it tries.
vi.mock("@/lib/supabase/server", () => ({ createClient: () => { throw new Error("DB_ACCESS"); } }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => { throw new Error("DB_ACCESS"); } }));
import PreviewPage from "./page";
afterEach(() => { vi.unstubAllEnvs(); });
const render = async (query: Record<string, string> = {}) => renderToStaticMarkup(await PreviewPage({ params: Promise.resolve({}), searchParams: Promise.resolve(query) }));

it("returns 404 in production builds", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(render()).rejects.toThrow("NOT_FOUND");
});
it("renders only clearly labelled DEMO data, without database access, and paginates", async () => {
  const html = await render({ page: "3" });
  expect(html).toContain("DEMO — dữ liệu giả");
  expect(html).toContain("51–60 of 60");
  expect(html).toContain("DEMO Programme 60");
  expect(html).not.toContain("DEMO Programme 01<");
  // Every external link in the fixtures points to the reserved test domain.
  const hosts = [...html.matchAll(/href="https?:\/\/([^/"]+)/g)].map((m) => m[1]);
  expect(hosts.length).toBeGreaterThan(0);
  expect(hosts.every((h) => h.endsWith("example.test"))).toBe(true);
});
