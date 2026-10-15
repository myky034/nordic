import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { isStructureV1 } from "@nordic/db/document-structure";
import { structureFixtures } from "../test/fixtures/structures/build";

// Writer/reader contract: the JSON the web tests read must be exactly what the
// crawler produces today, and must pass the reader's shape check.
it("structure fixtures for the web tests are up to date and readable", () => {
  for (const [name, structure] of Object.entries(structureFixtures())) {
    const saved = JSON.parse(readFileSync(new URL(`../test/fixtures/structures/${name}.json`, import.meta.url), "utf8"));
    expect(saved, `${name}.json is stale: npm run structure-fixtures -w @nordic/crawler`).toEqual(JSON.parse(JSON.stringify(structure)));
    expect(isStructureV1(saved)).toBe(true);
  }
});
