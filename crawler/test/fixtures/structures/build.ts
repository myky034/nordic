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
    // PR 2b: an intake page (Stockholm-University-like: label/value pairs under an
    // intake heading, and a mention of ANOTHER intake elsewhere on the page) …
    "programme-intake": extractStructure(html("programme-intake.html"), null, PAGE),
    // … the same programme's next intake page …
    "programme-intake-next": extractStructure(html("programme-intake.html").replace("Autumn 2026 | Period 1", "Autumn 2027 | Period 1")
      .replace("31/08/2026 - 04/06/2028", "30/08/2027 - 03/06/2029").replace("<p>Closed for application</p>", "<p>Application opens 16 October 2026</p>"), null, PAGE),
    // … and a programme page with deadlines as lines under one heading, no pairs (KTH-like).
    "programme-deadlines": extractStructure(html("programme-deadlines.html"), null, PAGE),
    // The sidebar page after an edit: a fee, a heading and a link changed (diff tests).
    "programme-sidebar-changed": extractStructure(html("programme-sidebar.html").replace("90000 SEK", "95000 SEK").replace("<h3>Year 1</h3>", "<h3>Year One</h3>")
      .replace('<a href="/course/ex2">Example Theory 7.5 credits</a>', '<a href="/course/ex3">Example Practice 7.5 credits</a>'), null, PAGE),
  };
}
