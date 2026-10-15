import { readFileSync } from "node:fs";
import { extractStructure } from "../../../src/structure";

const html = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const PAGE = "https://uni.example.test/p";

/** Every structure fixture, by file name (without .json). Synthetic pages only. */
export function structureFixtures() {
  return {
    "programme-sidebar": extractStructure(html("programme-sidebar.html"), null, PAGE),
    "programme-table": extractStructure(html("programme-table.html"), null, PAGE),
    "programme-dl": extractStructure(html("programme-dl.html"), null, PAGE),
    "programme-rendered": extractStructure(html("programme-rendered.html"), null, PAGE),
    // The sidebar page after an edit: a fee, a heading and a link changed (diff tests).
    "programme-sidebar-changed": extractStructure(html("programme-sidebar.html").replace("90000 SEK", "95000 SEK").replace("<h3>Year 1</h3>", "<h3>Year One</h3>")
      .replace('<a href="/course/ex2">Example Theory 7.5 credits</a>', '<a href="/course/ex3">Example Practice 7.5 credits</a>'), null, PAGE),
  };
}
