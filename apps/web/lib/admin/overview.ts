// Rules behind the admin overview (/admin). Pure functions, kept out of the
// page so every number on the dashboard is testable (AGENTS.md §16, §17).
//
// Every figure is a plain count of rows the viewer may read under RLS. There is
// no score, ranking or "health percentage": a count plus the rule that
// produced it is easier to check than a heuristic (AGENTS.md §11, §15).

const DAY = 86_400_000;

/** Upper bound of rows loaded per table. Counts past this are reported as
 *  incomplete instead of silently truncated (see `complete`). */
export const ROW_LIMIT = 5000;

/** PostgREST returns at most the rows requested; `count: "exact"` tells how
 *  many exist. If they differ, any total built from the rows would be wrong. */
export function complete(rows: unknown[] | null, count: number | null) {
  return rows !== null && count !== null && rows.length >= count;
}

export function daysSince(iso: string | null | undefined, now: Date) {
  if (!iso) return null;
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY));
}

export function sinceIso(days: number, now: Date) {
  return new Date(now.getTime() - days * DAY).toISOString();
}

// ---------------------------------------------------------------- days

/** The last `days` calendar days in UTC, oldest first, ending today. UTC
 *  matches every timestamp shown elsewhere in the admin pages. */
export function dayKeys(days: number, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10));
}
/** "2026-09-30" -> "30/9", the label under a day column. */
export const dayLabel = (key: string) => `${Number(key.slice(8, 10))}/${Number(key.slice(5, 7))}`;

/** Sums `value(row)` into the day of `at(row)`; rows outside the window are
 *  ignored. Days with nothing stay at zero so gaps are visible. */
export function perDay<T>(rows: T[], at: (r: T) => string, keys: string[], value: (r: T) => Record<string, number>) {
  const index = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map((day) => ({ day, values: {} as Record<string, number> }));
  for (const r of rows) {
    const t = new Date(at(r));
    if (Number.isNaN(t.getTime())) continue; // no usable timestamp: not placed on any day
    const i = index.get(t.toISOString().slice(0, 10));
    if (i === undefined) continue;
    for (const [k, v] of Object.entries(value(r))) out[i].values[k] = (out[i].values[k] ?? 0) + v;
  }
  return out;
}

// ---------------------------------------------------------------- system state

/** Crawl outcomes an operator should look at (see lib/crawler/domain.ts). */
export const problemOutcomes = ["error", "robots_disallowed", "skipped_type", "too_large"] as const;

/** The crawler is scheduled weekly (Mondays). A last run older than this is
 *  shown as a caution: the schedule may have stopped. It is a reminder, not a
 *  failure — a manual run also resets it. */
export const CRAWLER_STALE_DAYS = 8;

export type RunRow = { status: string; started_at: string };
export function crawlerState(lastRun: RunRow | null, states: { last_outcome: string | null }[], now: Date) {
  const age = daysSince(lastRun?.started_at, now);
  const problems: Record<string, number> = {};
  const outcomes: Record<string, number> = {};
  for (const s of states) {
    if (!s.last_outcome) continue;
    outcomes[s.last_outcome] = (outcomes[s.last_outcome] ?? 0) + 1;
    if ((problemOutcomes as readonly string[]).includes(s.last_outcome)) problems[s.last_outcome] = (problems[s.last_outcome] ?? 0) + 1;
  }
  return {
    lastRun, age,
    stale: age === null || age > CRAWLER_STALE_DAYS,
    trackedUrls: states.length,
    problemUrls: Object.values(problems).reduce((a, n) => a + n, 0),
    problems, outcomes,
  };
}

export type ExtractionRunRow = RunRow & { input_tokens: number; output_tokens: number };
/** `runs` = runs started in the window, newest first. */
export function extractionState(runs: ExtractionRunRow[]) {
  return {
    lastRun: runs[0] ?? null,
    runs: runs.length,
    failedRuns: runs.filter((r) => r.status === "failed" || r.status === "partial").length,
    inputTokens: runs.reduce((a, r) => a + (r.input_tokens ?? 0), 0),
    outputTokens: runs.reduce((a, r) => a + (r.output_tokens ?? 0), 0),
  };
}

// ---------------------------------------------------------------- coverage

export type Country = { id: string; slug: string; name: string };
type Keyed = { country_id: string | null; status: string };
export type CoverageInput = { sources: Keyed[]; facts: Keyed[]; universities: Keyed[]; programmes: Keyed[]; rules: Keyed[]; occupations: Keyed[] };
export type CoverageRow = {
  key: string; country: Country | null;
  sourcesVerified: number; sourcesTotal: number;
  factsReviewed: number; factsProposed: number; factsConflicted: number;
  universities: number; programmes: number; rules: number; occupations: number;
};

/** One row per country (+ "no country" when anything lacks one) and a total.
 *  Universities, programmes, rules and occupations count only reviewed rows:
 *  the question is "what can readers already use", not "what was typed in". */
export function coverage(countries: Country[], data: CoverageInput): { rows: CoverageRow[]; total: CoverageRow } {
  const empty = (key: string, country: Country | null): CoverageRow => ({ key, country, sourcesVerified: 0, sourcesTotal: 0,
    factsReviewed: 0, factsProposed: 0, factsConflicted: 0, universities: 0, programmes: 0, rules: 0, occupations: 0 });
  const byId = new Map(countries.map((c) => [c.id, empty(c.id, c)]));
  const none = empty("none", null);
  const total = empty("total", null);
  const at = (id: string | null) => (id && byId.get(id)) || none;
  const add = (rows: Keyed[], f: (r: CoverageRow, x: Keyed) => void) => rows.forEach((x) => { f(at(x.country_id), x); f(total, x); });
  add(data.sources, (r, x) => { r.sourcesTotal++; if (x.status === "verified") r.sourcesVerified++; });
  add(data.facts, (r, x) => {
    if (x.status === "reviewed") r.factsReviewed++;
    else if (x.status === "proposed") r.factsProposed++;
    else if (x.status === "conflicted") r.factsConflicted++;
  });
  const reviewed = (k: "universities" | "programmes" | "rules" | "occupations") => (r: CoverageRow, x: Keyed) => { if (x.status === "reviewed") r[k]++; };
  add(data.universities, reviewed("universities"));
  add(data.programmes, reviewed("programmes"));
  add(data.rules, reviewed("rules"));
  add(data.occupations, reviewed("occupations"));
  const used = (r: CoverageRow) => r.sourcesTotal + r.factsReviewed + r.factsProposed + r.factsConflicted + r.universities + r.programmes + r.rules + r.occupations > 0;
  return { rows: [...byId.values(), ...(used(none) ? [none] : [])], total };
}

// ---------------------------------------------------------------- review activity

export type ReviewKind = "facts" | "education" | "immigration" | "labour";
export const reviewKinds: { kind: ReviewKind; label: string; href: string }[] = [
  { kind: "facts", label: "Thông tin", href: "/facts/workspace" },
  { kind: "education", label: "Trường & chương trình", href: "/education/workspace" },
  { kind: "immigration", label: "Quy định nhập cư", href: "/immigration/workspace" },
  { kind: "labour", label: "Nghề", href: "/labour/workspace" },
];
/** Decisions as stored (fact_reviews also has conflicted / revalidated). */
export const decisions = ["reviewed", "rejected", "conflicted", "revalidated"] as const;
export type Decision = (typeof decisions)[number];
export const decisionLabels: Record<Decision, string> = { reviewed: "Duyệt", rejected: "Từ chối", conflicted: "Mâu thuẫn", revalidated: "Vẫn khớp nguồn mới" };

export function activity(reviews: Record<ReviewKind, { decision: string }[]>) {
  return reviewKinds.map(({ kind, label, href }) => {
    const counts = Object.fromEntries(decisions.map((d) => [d, 0])) as Record<Decision, number>;
    for (const r of reviews[kind]) if ((decisions as readonly string[]).includes(r.decision)) counts[r.decision as Decision]++;
    return { kind, label, href, counts, total: Object.values(counts).reduce((a, n) => a + n, 0) };
  });
}

/** Activity window, from ?days= (7 or 30; anything else falls back to 7). */
export function readWindow(value: unknown): 7 | 30 {
  return value === "30" ? 30 : 7;
}
