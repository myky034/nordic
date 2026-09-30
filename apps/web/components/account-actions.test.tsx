import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const perms = vi.fn();
const pending = vi.fn();
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: () => perms() }));
vi.mock("@/lib/review/pending-total", () => ({ pendingProposalTotal: () => pending() }));
vi.mock("@/app/(auth)/actions", () => ({ signOut: async () => {} }));
import { AccountActions } from "./account-actions";

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

it("adds the editor entry with the pending count for a reviewer", async () => {
  perms.mockResolvedValue(["facts.review"]);
  pending.mockResolvedValue(7);
  const html = await render();
  for (const text of ['href="/dashboard"', "Biên tập", ">7<", "7 đề xuất chờ duyệt", 'href="/workspace"', "Đăng xuất"]) expect(html).toContain(text);
});

it("shows the editor entry without a count to a proposer, and no count when counting failed", async () => {
  perms.mockResolvedValue(["education.manage"]);
  const proposer = await render();
  expect(proposer).toContain("Biên tập");
  expect(pending).not.toHaveBeenCalled();
  perms.mockResolvedValue(["facts.review"]);
  pending.mockResolvedValue(null);
  expect(await render()).not.toContain("đề xuất chờ duyệt");
});
