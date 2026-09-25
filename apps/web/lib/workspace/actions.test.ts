import { beforeEach, expect, it, vi } from "vitest";
// A chainable Supabase stand-in that records every call.
const { calls, claims, result } = vi.hoisted(() => ({ calls: [] as unknown[][], claims: { value: { sub: "u" } as object | null }, result: { value: { data: null as unknown, error: null as unknown } } }));
function chain(table: string): Record<string, unknown> {
  const self: Record<string, unknown> = { then: (r: (v: unknown) => void) => r(result.value) };
  for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "not", "maybeSingle", "single"]) self[m] = (...a: unknown[]) => { calls.push([table, m, ...a]); return self; };
  return self;
}
vi.mock("@/lib/auth/session", () => ({ getAuthClaims: async () => claims.value }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (t: string) => chain(t), rpc: (n: string) => { calls.push(["rpc", n]); return chain("rpc"); } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { deleteMyWorkspace, saveNote, savePlan, saveProject, toggleSaved } from "@/app/(app)/workspace/actions";
const form = (v: Record<string, string | string[]>) => { const f = new FormData(); for (const [k, x] of Object.entries(v)) for (const y of [x].flat()) f.append(k, y); return f; };
const uuid = "11111111-1111-4111-8111-111111111111";
beforeEach(() => { calls.length = 0; claims.value = { sub: "u" }; result.value = { data: null, error: null }; vi.spyOn(console, "error").mockImplementation(() => {}); });

it("requires a signed-in user before touching the database", async () => {
  claims.value = null;
  expect((await saveProject({}, form({ name: "Sweden 2028" }))).error).toContain("đăng nhập");
  expect(calls).toHaveLength(0);
});
it("never forwards an owner id from the form", async () => {
  result.value = { data: { id: uuid }, error: null };
  await saveProject({}, form({ name: "Sweden 2028", user_id: "forged", targetYear: "2028", countries: [uuid, "not-a-uuid"] }));
  const insert = calls.find((c) => c[0] === "research_projects" && c[1] === "insert")!;
  expect(insert[2]).toEqual({ name: "Sweden 2028", description: null, target_year: 2028, target_role: null });
  expect(calls.find((c) => c[0] === "research_project_countries" && c[1] === "insert")![2]).toEqual([{ project_id: uuid, country_id: uuid }]);
});
it("validates kinds, ids, years and budgets before any write", async () => {
  expect((await toggleSaved({}, form({ kind: "fact", id: uuid }))).error).toBeDefined();
  expect((await toggleSaved({}, form({ kind: "programme", id: "x" }))).error).toBeDefined();
  expect((await saveProject({}, form({ name: "x", targetYear: "1800" }))).error).toBeDefined();
  expect((await savePlan({}, form({ budgetAmount: "1000" }))).error).toContain("Ngân sách");
  expect((await saveNote({}, form({ content: "" }))).error).toBeDefined();
  expect(calls).toHaveLength(0);
});
it("requires typed confirmation to wipe the workspace", async () => {
  expect((await deleteMyWorkspace({}, form({ confirm: "xoa" }))).error).toContain("XÓA");
  expect(calls).toHaveLength(0);
  await deleteMyWorkspace({}, form({ confirm: "XÓA" }));
  expect(calls).toContainEqual(["rpc", "delete_my_workspace"]);
});
it("hides raw database errors", async () => {
  result.value = { data: null, error: { code: "XX000", message: "postgres://secret" } };
  expect((await saveNote({}, form({ content: "note" }))).error).not.toContain("secret");
});
