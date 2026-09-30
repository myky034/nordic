import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

// Synthetic roles, users and audit rows; the Supabase client is a stand-in.
const me = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const roles = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Zeta reviewer", description: "", role_permissions: [{ permission_key: "facts.review" }] },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Alpha admin", description: "Toàn quyền", role_permissions: [{ permission_key: "roles.manage" }, { permission_key: "users.assign_roles" }, { permission_key: "facts.review" }] },
];
const audit = [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", actor_id: me, action: "role.granted", target_id: other, details: {}, created_at: "2026-09-30T08:00:00Z" }];
const users = [{ user_id: me, email: "me@example.test", role_ids: [roles[1].id] }, { user_id: other, email: "other@example.test", role_ids: [] }];
const table = (data: unknown) => { const q = { select: () => q, order: () => q, limit: () => q, then: (r: (v: unknown) => void) => r({ data, error: null }) }; return q; };
vi.mock("@/lib/rbac/access", () => ({
  logAccessError: vi.fn(),
  accessContext: async () => ({
    userId: me, permissions: ["roles.manage", "users.assign_roles", "facts.review"],
    client: {
      from: (t: string) => table(t === "roles" ? roles : t === "permissions" ? [{ key: "facts.review", description: "" }] : audit),
      rpc: async () => ({ data: users, error: null }),
    },
  }),
}));
vi.mock("@/components/key-nav", () => ({ KeyNav: () => null }));
vi.mock("./forms", () => ({ RoleForm: ({ role }: { role?: { name: string } }) => <p>ROLE_FORM {role?.name ?? "new"}</p>, UserRoles: ({ user }: { user: string }) => <p>USER_ROLES {user}</p> }));
import AccessPage from "./page";
const render = async (q: Record<string, string>) => renderToStaticMarkup(await AccessPage({ params: Promise.resolve({}), searchParams: Promise.resolve(q) }));

it("lists users in a table and opens one in the inspector from the URL", async () => {
  const closed = await render({});
  expect(closed).toContain("other@example.test");
  expect(closed).toContain("Chưa có vai trò");
  expect(closed).not.toContain('role="dialog"');
  const open = await render({ user: other });
  expect(open).toContain('role="dialog"');
  expect(open).toContain(`USER_ROLES ${other}`);
  // The signed-in admin's own inspector lists the permissions granted by their role.
  const mine = await render({ user: me });
  for (const text of ["Quyền hiện có", "Duyệt đề xuất", "roles.manage", "từ Alpha admin"]) expect(mine).toContain(text);
  expect(open).toContain("Không có quyền đặc biệt");
});

it("sorts roles by the chosen column and opens the new-role form", async () => {
  const byName = await render({ tab: "roles" });
  expect(byName.indexOf("Alpha admin")).toBeLessThan(byName.indexOf("Zeta reviewer"));
  const byCount = await render({ tab: "roles", sort: "permissions", dir: "desc" });
  expect(byCount.indexOf("Alpha admin")).toBeLessThan(byCount.indexOf("Zeta reviewer"));
  const byCountAsc = await render({ tab: "roles", sort: "permissions", dir: "asc" });
  expect(byCountAsc.indexOf("Zeta reviewer")).toBeLessThan(byCountAsc.indexOf("Alpha admin"));
  expect(await render({ tab: "roles", new: "1" })).toContain("ROLE_FORM new");
});

it("shows the audit log with readable actions and names instead of UUIDs", async () => {
  const html = await render({ tab: "audit" });
  for (const text of ["Gán vai trò", "Bạn", "other@example.test"]) expect(html).toContain(text);
  expect(await render({ tab: "audit", entry: audit[0].id })).toContain("Chi tiết kỹ thuật");
});
