# Crawler fixtures (synthetic)

Synthetic HTML pages that reproduce the **structures** met on real programme
pages, with invented institutions on `example.test` and invented values. They
are not copies of any real page: the repository is public and AGENTS.md §8
forbids mirroring third-party content. Real page versions stay in the database
(`document_texts`, editors only).

| File | Structure it reproduces |
|---|---|
| `programme-sidebar.html` | Label and value in sibling inline elements of a sidebar (the label/value pair is not a block), an embedded JSON state blob, an intake selector, a collapsed section (Stockholm-University-like layout seen 2026-10-15) |
| `programme-table.html` | Key facts in a `<table>` with `<th>` row headers, curriculum as a table with header row |
| `programme-dl.html` | Key facts as a `<dl>` definition list, requirements as a nested list |
| `programme-intake.html` | One intake page of a programme: label/value pairs and short facts under an intake heading ("Autumn 2026 …"), plus a heading about ANOTHER intake ("… autumn 2027") elsewhere on the page (Stockholm-University-like layout, PR 2b) |
| `programme-deadlines.html` | Programme page whose deadlines are lines of one paragraph under a heading naming the intake month, no label/value pairs, fees on another page (KTH-like layout, PR 2b) |

`src/extract.baseline.test.ts` pins what the current text extractor
(`extractPage`, hash method `sha256-text-v1`) produces for each file. PR 1 of
the configurable-extraction plan must keep these outputs unchanged (or version
the hash method explicitly).

`structures/*.json` holds `extractStructure()` output for these pages, written by
`npm run structure-fixtures -w @nordic/crawler` and checked by
`src/structure.fixtures.test.ts`. The web app's tests read those JSON files
instead of importing crawler code (the web build does not install cheerio).
