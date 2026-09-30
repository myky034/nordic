import { expect, it } from "vitest";
import { effectivePermissions } from "./effective";

const roles = [
  { id: "r1", name: "Reviewer", role_permissions: [{ permission_key: "facts.review" }, { permission_key: "sources.manage" }] },
  { id: "r2", name: "Editor", role_permissions: [{ permission_key: "facts.propose" }, { permission_key: "facts.review" }] },
  { id: "r3", name: "Unassigned", role_permissions: [{ permission_key: "roles.manage" }] },
];

it("unions the permissions of assigned roles only, with the roles that grant each", () => {
  const e = effectivePermissions(roles, ["r1", "r2"]);
  expect(e.total).toBe(3);
  const all = e.groups.flatMap((g) => g.items);
  expect(all.find((i) => i.key === "facts.review")?.roles).toEqual(["Reviewer", "Editor"]);
  expect(all.some((i) => i.key === "roles.manage")).toBe(false);
});
it("groups like the role editor, in its order, and keeps unknown keys under Khác", () => {
  const e = effectivePermissions([{ id: "x", name: "X", role_permissions: [{ permission_key: "sources.manage" }, { permission_key: "facts.propose" }, { permission_key: "future.key" }] }], ["x"]);
  expect(e.groups.map((g) => g.title)).toEqual(["Thông tin và duyệt", "Nguồn và tài liệu", "Khác"]);
  expect(e.groups[0].items[0]).toMatchObject({ key: "facts.propose", label: "Đề xuất thông tin" });
});
it("is empty for a user without roles", () => {
  expect(effectivePermissions(roles, [])).toEqual({ total: 0, groups: [] });
});
