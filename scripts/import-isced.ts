// Explicit operator action (Slice 11a): import ISCED-F 2013 fields of study
// from docs/data/isced-f-2013.csv into study_fields.
//
//   node scripts/import-isced.ts <document-uuid>            # check only
//   node scripts/import-isced.ts <document-uuid> --write    # import
//
// <document-uuid> is the Nordic document for the official UNESCO PDF, imported
// first through "Nhập tài liệu" (so every field points to its source). The
// script refuses to write unless every CSV line has verified_by/verified_on,
// and unless that document's SHA-256 is the one recorded in
// docs/data/isced-f-2013.md (i.e. the exact file the CSV was checked against).
// Node 24 runs this TypeScript file directly (type stripping).
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
import { parseIscedCsv, unverifiedCodes } from "../apps/web/lib/taxonomy/isced-csv.ts";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
// SHA-256 of "ISCED-F 2013 – Detailed field descriptions" (UIS, 2015), English PDF.
const OFFICIAL_SHA256 = "3f463bb91d7ae89f17f12fcbd53d7746db46c81c140e49183518b8d7804e8564";

const [document, flag] = process.argv.slice(2);
if (!document || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(document) || (flag && flag !== "--write")) {
  console.error("Usage: node scripts/import-isced.ts <document-uuid> [--write]"); process.exit(1);
}
const { rows, errors } = parseIscedCsv(readFileSync("docs/data/isced-f-2013.csv", "utf8"));
if (errors.length) { console.error(`CSV has ${errors.length} problem(s):\n${errors.join("\n")}`); process.exit(1); }
const pending = unverifiedCodes(rows);
console.log(`CSV: ${rows.length} codes, ${rows.length - pending.length} verified.`);
if (pending.length) {
  console.error(`Not imported: ${pending.length} line(s) have no verified_by/verified_on yet (first: ${pending.slice(0, 10).join(", ")}).`);
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL, connectionTimeoutMillis: 10000 });
try {
  await client.connect();
  const found = await client.query("SELECT d.title, d.canonical_url, d.content_hash, s.name AS source FROM public.documents d JOIN public.sources s ON s.id=d.source_id WHERE d.id=$1", [document]);
  if (!found.rowCount) throw new Error("taxonomy_document_missing");
  const d = found.rows[0];
  console.log(`Document: ${d.title ?? "(no title)"} — ${d.canonical_url}\nSource: ${d.source}`);
  if (d.content_hash !== OFFICIAL_SHA256) throw new Error("taxonomy_document_hash_mismatch");
  if (flag !== "--write") { console.log("Check passed. Nothing written; add --write to import."); process.exit(0); }
  const result = await client.query("SELECT public.import_study_fields($1::uuid,$2::jsonb) AS r", [document, JSON.stringify(rows)]);
  console.log(`Imported: ${result.rows[0].r.inserted} new, ${result.rows[0].r.unchanged} already present. Audited as study_fields.imported.`);
} catch (error) {
  const known = ["taxonomy_document_missing", "taxonomy_document_hash_mismatch", "taxonomy_unverified", "taxonomy_conflict",
    "taxonomy_invalid", "taxonomy_parent_missing", "taxonomy_duplicate_code"];
  const message = error instanceof Error ? error.message : "";
  const detail = (error as { detail?: string }).detail;
  console.error(known.includes(message) ? `${message}${detail ? ` (code ${detail})` : ""}` : "Import failed. Check the connection and that the taxonomy migration is applied.");
  process.exitCode = 1;
} finally { await client.end(); }
