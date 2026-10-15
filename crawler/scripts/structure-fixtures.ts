// Writes extractStructure() output for the synthetic fixtures to
// test/fixtures/structures/*.json. The web app's structure-preview tests read
// these files instead of importing crawler code: the web build (Vercel) type-
// checks its test files and does not install crawler dependencies (cheerio).
// src/structure.fixtures.test.ts fails when a file is out of date; regenerate
// with: npm run structure-fixtures -w @nordic/crawler
import { writeFileSync } from "node:fs";
import { structureFixtures } from "../test/fixtures/structures/build";

for (const [name, structure] of Object.entries(structureFixtures())) {
  writeFileSync(new URL(`../test/fixtures/structures/${name}.json`, import.meta.url), `${JSON.stringify(structure, null, 2)}\n`);
  console.log(`wrote ${name}.json`);
}
