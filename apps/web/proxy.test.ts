import { afterEach, expect, it, vi } from "vitest";
const { updateSession } = vi.hoisted(() => ({ updateSession: vi.fn(async () => new Response("page", { status: 200 })) }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession }));
import { NextRequest } from "next/server";
import { isDevOnlyPath, proxy } from "./proxy";
afterEach(() => { vi.unstubAllEnvs(); updateSession.mockClear(); });

const request = (path: string) => new NextRequest(new URL(path, "https://nordic.example.test"));

it("recognises developer-only paths, not look-alikes", () => {
  expect(isDevOnlyPath("/dev")).toBe(true);
  expect(isDevOnlyPath("/dev/preview/patterns")).toBe(true);
  expect(isDevOnlyPath("/developers")).toBe(false);
  expect(isDevOnlyPath("/documents/dev")).toBe(false);
});
it("answers a real 404 for /dev pages in production, before any rendering (KHLOE-108)", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const res = await proxy(request("/dev/preview"));
  expect(res.status).toBe(404);
  expect(updateSession).not.toHaveBeenCalled();
  expect((await proxy(request("/countries"))).status).toBe(200);
});
it("leaves /dev pages alone in development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  expect((await proxy(request("/dev/preview"))).status).toBe(200);
  expect(updateSession).toHaveBeenCalledTimes(1);
});
