import { expect, it } from "vitest";
import { accountLinks, canOpenFactsWorkspace, canProposeFacts, isEditor } from "./ui";

it("treats signed-out and permission-less viewers as non-editors", () => {
  expect(isEditor(null)).toBe(false);
  expect(isEditor([])).toBe(false);
  expect(isEditor(["documents.read"])).toBe(false);
});
it("counts anyone with an editing or administration tile as an editor", () => {
  for (const p of ["facts.propose", "facts.review", "education.manage", "documents.ingest", "sources.manage", "roles.manage", "crawler.manage"]) expect(isEditor([p])).toBe(true);
});
it("separates proposing from reviewing", () => {
  expect(canProposeFacts(["facts.review"])).toBe(false);
  expect(canOpenFactsWorkspace(["facts.review"])).toBe(true);
  expect(canOpenFactsWorkspace(null)).toBe(false);
});
it("builds the header links per role", () => {
  expect(accountLinks(null)).toEqual({ signedIn: false });
  expect(accountLinks([])).toMatchObject({ signedIn: true, personal: { href: "/workspace" }, editor: null });
  expect(accountLinks(["sources.manage"])).toMatchObject({ editor: { href: "/dashboard", showPending: false } });
  expect(accountLinks(["facts.review"])).toMatchObject({ editor: { showPending: true } });
});
