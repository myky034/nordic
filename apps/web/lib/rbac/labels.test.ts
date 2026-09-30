import { expect, it } from "vitest";
import { auditActionLabel, permissionGroups, permissionLabels } from "./labels";

it("puts every permission in exactly one group", () => {
  const grouped = permissionGroups.flatMap((g) => g.keys);
  expect(new Set(grouped).size).toBe(grouped.length);
  expect([...grouped].sort()).toEqual(Object.keys(permissionLabels).sort());
});
it("names known audit actions and keeps unknown ones as stored", () => {
  expect(auditActionLabel("role.granted")).toBe("Gán vai trò");
  expect(auditActionLabel("something.new")).toBe("something.new");
});
