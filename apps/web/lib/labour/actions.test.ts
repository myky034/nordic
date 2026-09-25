import { beforeEach, expect, it, vi } from "vitest";
const { requirePermission, rpc } = vi.hoisted(() => ({ requirePermission: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ requirePermission, logAccessError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { proposeOccupation, reviewOccupation } from "@/app/(app)/labour/workspace/actions";
const uuid = "11111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; };
beforeEach(() => { vi.clearAllMocks(); requirePermission.mockResolvedValue({ client: { rpc } }); rpc.mockResolvedValue({ error: null }); });

it("requires labour.manage to propose and facts.review to decide", async () => {
  await proposeOccupation({}, form({ name: "n", document: uuid, excerpt: "e" }));
  expect(requirePermission).toHaveBeenLastCalledWith("labour.manage");
  await reviewOccupation({}, form({ id: uuid, decision: "reviewed", note: "n" }));
  expect(requirePermission).toHaveBeenLastCalledWith("facts.review");
});
it("forwards only allowlisted fields and nulls for an international occupation", async () => {
  await proposeOccupation({}, form({ name: "n", document: uuid, excerpt: "e", actor: "forged", status: "reviewed" }));
  expect(rpc.mock.calls[0][1]).toEqual({ p_name: "n", p_system: null, p_code: null, p_country: null, p_document: uuid, p_excerpt: "e" });
});
it("rejects a code without a system, unknown systems and bad ids before the database", async () => {
  for (const bad of [{ code: "2512" }, { system: "ISCO-08" }, { system: "guess", code: "1" }, { document: "x" }, { country: "x" }] as Record<string, string>[]) {
    expect((await proposeOccupation({}, form({ name: "n", document: uuid, excerpt: "e", ...bad }))).error).toBeDefined();
  }
  expect((await reviewOccupation({}, form({ id: uuid, decision: "conflicted", note: "n" }))).error).toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
});
it("hides raw database errors", async () => {
  rpc.mockResolvedValue({ error: { message: "postgres://secret" } });
  expect((await proposeOccupation({}, form({ name: "n", document: uuid, excerpt: "e" }))).error).not.toContain("secret");
});
