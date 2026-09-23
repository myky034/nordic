import { beforeEach, expect, it, vi } from "vitest";
const { requirePermission, rpc } = vi.hoisted(() => ({ requirePermission: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/rbac/access", () => ({ requirePermission, logAccessError: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { proposeProgramme, proposeUniversity, reviewEducation } from "@/app/(app)/education/workspace/actions";
const uuid = "11111111-1111-4111-8111-111111111111";
const form = (values: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(values)) f.set(k, v); return f; };
beforeEach(() => { vi.clearAllMocks(); requirePermission.mockResolvedValue({ client: { rpc } }); rpc.mockResolvedValue({ error: null }); });

it("checks the right capability before any RPC", async () => {
  requirePermission.mockRejectedValue(new Error("access_forbidden"));
  expect((await proposeUniversity({}, new FormData())).error).toBeDefined();
  expect((await reviewEducation({}, new FormData())).error).toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
  requirePermission.mockResolvedValue({ client: { rpc } });
  await reviewEducation({}, form({ kind: "university", id: uuid, decision: "reviewed", note: "n" }));
  expect(requirePermission).toHaveBeenLastCalledWith("facts.review");
  await proposeProgramme({}, new FormData());
  expect(requirePermission).toHaveBeenLastCalledWith("education.manage");
});
it("never forwards actor or status and canonicalizes the official URL", async () => {
  await proposeUniversity({}, form({ country: uuid, document: uuid, name: " Test ", officialUrl: "https://uni.example.test/#top", excerpt: "e", actor: "forged", status: "reviewed" }));
  const args = rpc.mock.calls[0][1];
  expect(Object.keys(args).sort()).toEqual(["p_country", "p_document", "p_excerpt", "p_name", "p_official_url"]);
  expect(args.p_official_url).toBe("https://uni.example.test/");
});
it("rejects unsafe URLs, unknown degrees and malformed ids without calling the database", async () => {
  const base = { university: uuid, document: uuid, name: "n", degree: "master", officialUrl: "https://uni.example.test/p", excerpt: "e" };
  for (const bad of [{ officialUrl: "javascript:alert(1)" }, { applicationUrl: "ftp://x" }, { degree: "diploma" }, { university: "x" }] as Record<string, string>[]) {
    expect((await proposeProgramme({}, form({ ...base, ...bad }))).error).toBeDefined();
  }
  expect((await reviewEducation({}, form({ kind: "country", id: uuid, decision: "reviewed", note: "n" }))).error).toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
});
it("hides raw database errors", async () => {
  rpc.mockResolvedValue({ error: { message: "connection string postgres://secret" } });
  const result = await proposeUniversity({}, form({ country: uuid, document: uuid, name: "n", officialUrl: "https://uni.example.test/", excerpt: "e" }));
  expect(result.error).not.toContain("secret");
});
