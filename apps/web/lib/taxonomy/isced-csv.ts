// Reads docs/data/isced-f-2013.csv (Slice 11a). Shared by the operator import
// script (scripts/import-isced.ts, run directly by Node, so this file uses
// only plain TypeScript and imports nothing) and by the tests.
//
// WHY so strict: the file is the only way ISCED-F codes enter the database,
// and it is typed by hand from the UNESCO document. Any shape problem is
// reported with its line number instead of being "fixed" silently. The
// database function import_study_fields() checks the same rules again.

export type IscedRow = {
  code: string; level: number; parent_code: string; name_en: string; name_vi: string;
  source_page: number | null; verified_by: string; verified_on: string;
};
const header = ["code", "level", "parent_code", "name_en", "name_vi", "source_page", "verified_by", "verified_on"];

/** RFC 4180 fields: commas inside quotes, "" for a quote. Returns rows of cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function parseIscedCsv(text: string): { rows: IscedRow[]; errors: string[] } {
  const [head, ...lines] = parseCsv(text.replace(/^﻿/, ""));
  const errors: string[] = [];
  if (!head || head.join(",") !== header.join(",")) return { rows: [], errors: [`Header must be: ${header.join(",")}`] };
  const rows: IscedRow[] = [];
  const codes = new Set<string>();
  lines.forEach((cells, i) => {
    const line = i + 2;
    if (cells.length !== header.length) { errors.push(`Line ${line}: expected ${header.length} columns, found ${cells.length}`); return; }
    const [code, level, parent, nameEn, nameVi, page, by, on] = cells.map((c) => c.trim());
    if (!/^\d{2,4}$/.test(code)) errors.push(`Line ${line}: code "${code}" is not 2-4 digits`);
    else if (Number(level) !== code.length - 1) errors.push(`Line ${line}: level ${level} does not match code ${code}`);
    else if (parent !== (code.length === 2 ? "" : code.slice(0, -1))) errors.push(`Line ${line}: parent of ${code} must be "${code.slice(0, -1)}"`);
    if (codes.has(code)) errors.push(`Line ${line}: duplicate code ${code}`);
    codes.add(code);
    if (!nameEn || !nameVi) errors.push(`Line ${line}: both names are required`);
    if (page && !/^\d{1,3}$/.test(page)) errors.push(`Line ${line}: source_page must be a number`);
    // Verification is all-or-nothing per line: a name without a date (or the
    // reverse) is a typo, not a verification.
    if (Boolean(by) !== Boolean(on)) errors.push(`Line ${line}: verified_by and verified_on go together`);
    if (on && !/^\d{4}-\d{2}-\d{2}$/.test(on)) errors.push(`Line ${line}: verified_on must be YYYY-MM-DD`);
    rows.push({ code, level: Number(level), parent_code: parent, name_en: nameEn, name_vi: nameVi, source_page: page ? Number(page) : null, verified_by: by, verified_on: on });
  });
  for (const r of rows) if (r.parent_code && !codes.has(r.parent_code)) errors.push(`Code ${r.code}: parent ${r.parent_code} is not in the file`);
  return { rows, errors };
}

/** Codes nobody has signed off yet; the import refuses the file while any remain. */
export const unverifiedCodes = (rows: IscedRow[]) => rows.filter((r) => !r.verified_by || !r.verified_on).map((r) => r.code);
