import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const perms = vi.fn();
const pending = vi.fn();
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: () => perms() }));
vi.mock("@/lib/review/pending-total", () => ({ pendingProposalTotal: () => pending() }));
vi.mock("@/app/(auth)/actions", () => ({ signOut: async () => {} }));
import { setTestLocale } from "@/test/i18n";
import { AccountActions, PendingBadge } from "./account-actions";

beforeEach(() => { perms.mockReset(); pending.mockReset(); });
const render = async () => renderToStaticMarkup(await AccountActions());

it("offers only sign-in to a visitor without a session", async () => {
  perms.mockResolvedValue(null);
  const html = await render();
  expect(html).toContain('href="/login"');
  expect(html).not.toContain("Đăng xuất");
  expect(html).not.toContain("/dashboard");
});

it("gives a signed-in user without permissions their own space and sign-out, but no editor entry", async () => {
  perms.mockResolvedValue([]);
  const html = await render();
  expect(html).toContain('href="/workspace"');
  expect(html).toContain("Không gian của tôi");
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Đăng xuất<\/button>/);
  expect(html).not.toContain("Biên tập");
  expect(pending).not.toHaveBeenCalled();
});

it("adds the editor entry for a reviewer; the pending count streams in as its own badge", async () => {
  perms.mockResolvedValue(["facts.review"]);
  const html = await render();
  for (const text of ['href="/dashboard"', "Biên tập", 'href="/workspace"', "Đăng xuất"]) expect(html).toContain(text);
  pending.mockResolvedValue(7);
  const badge = renderToStaticMarkup(await PendingBadge());
  expect(badge).toContain(">7<");
  expect(badge).toContain("đề xuất chờ duyệt");
  pending.mockResolvedValue(null);
  expect(await PendingBadge()).toBeNull();
  pending.mockResolvedValue(0);
  expect(await PendingBadge()).toBeNull();
});

it("shows the editor entry to a proposer without asking for the count", async () => {
  perms.mockResolvedValue(["education.manage"]);
  expect(await render()).toContain("Biên tập");
  expect(pending).not.toHaveBeenCalled();
});

it("labels the account buttons in the viewer's language", async () => {
  perms.mockResolvedValue(["facts.review"]); pending.mockResolvedValue(0); setTestLocale("en");
  const html = await render();
  for (const text of ["Editing", "My workspace", "Sign out"]) expect(html).toContain(text);
  perms.mockResolvedValue(null);
  expect(await render()).toContain("Sign in");
  setTestLocale("vi");
});
