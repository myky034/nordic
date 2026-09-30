import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const claims = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getAuthClaims: () => claims() }));
vi.mock("@/app/(auth)/actions", () => ({ signOut: async () => {} }));
import { AccountActions } from "./account-actions";

beforeEach(() => claims.mockReset());

it("offers sign-in, and no sign-out, to a visitor without a session", async () => {
  claims.mockResolvedValue(null);
  const html = renderToStaticMarkup(await AccountActions());
  expect(html).toContain('href="/login"');
  expect(html).not.toContain("Đăng xuất");
});

it("shows Workspace and Đăng xuất to a signed-in user on any page", async () => {
  claims.mockResolvedValue({ sub: "11111111-1111-4111-8111-111111111111" });
  const html = renderToStaticMarkup(await AccountActions());
  expect(html).toContain('href="/dashboard"');
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Đăng xuất<\/button>/);
  expect(html).not.toContain('href="/login"');
});
