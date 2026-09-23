import { beforeEach, expect, it, vi } from "vitest";
const { requirePermission, rpc } = vi.hoisted(() => ({ requirePermission: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ requirePermission, logAccessError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { proposeRule, reviewRule } from "@/app/(app)/immigration/workspace/actions";
const uuid = "11111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; };
const valid = { country: uuid, document: uuid, ruleType: "work_permit", title: "t", officialUrl: "https://authority.example.test/p#x", excerpt: "e" };
beforeEach(() => { vi.clearAllMocks(); requirePermission.mockResolvedValue({ client: { rpc } }); rpc.mockResolvedValue({ error: null }); });

it("requires immigration.manage to propose and facts.review to decide", async () => {
  await proposeRule({}, form(valid));
  expect(requirePermission).toHaveBeenLastCalledWith("immigration.manage");
  await reviewRule({}, form({ id: uuid, decision: "reviewed", note: "n" }));
  expect(requirePermission).toHaveBeenLastCalledWith("facts.review");
  requirePermission.mockRejectedValue(new Error("access_forbidden"));
  rpc.mockClear();
  expect((await proposeRule({}, form(valid))).error).toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
});
it("forwards only allowlisted fields and a canonical URL", async () => {
  await proposeRule({}, form({ ...valid, actor: "forged", status: "reviewed", tier: "T1" }));
  const args = rpc.mock.calls[0][1];
  expect(Object.keys(args).sort()).toEqual(["p_country", "p_document", "p_excerpt", "p_official_url", "p_rule_type", "p_title"]);
  expect(args.p_official_url).toBe("https://authority.example.test/p");
});
it("rejects unknown rule types, unsafe URLs and bad ids before the database", async () => {
  for (const bad of [{ ruleType: "golden_visa" }, { officialUrl: "javascript:alert(1)" }, { document: "x" }]) {
    expect((await proposeRule({}, form({ ...valid, ...bad }))).error).toBeDefined();
  }
  expect((await reviewRule({}, form({ id: uuid, decision: "conflicted", note: "n" }))).error).toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
});
it("maps the T1 refusal to a clear message", async () => {
  rpc.mockResolvedValue({ error: { message: "immigration_requires_t1" } });
  expect((await proposeRule({}, form(valid))).error).toContain("T1");
});
