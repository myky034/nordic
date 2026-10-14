import { LIMITS, TOPICS } from "./config";

export type Candidate = {
  topic: string; subject: string; predicate: string; value: string; unit: string | null; excerpt: string;
  country: string | null; valid_from: string | null; valid_until: string | null; reference_period: string | null; confidence?: number;
  // L3c: optional fact type and its structured value (null = not stated).
  fact_type: string | null; value_number: string | null; value_currency: string | null; value_period: string | null; value_date: string | null;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const opt = (v: unknown) => str(v) || null;

/**
 * Shape-only parsing of model output: anything that is not a list of objects
 * is refused; "" becomes null. Content rules are checked by precheck() here
 * and, authoritatively, again by extractor_propose() in the database.
 */
export function parseCandidates(content: unknown): { candidates: Candidate[]; dropped: number } {
  const list = (content as { candidates?: unknown })?.candidates;
  if (!Array.isArray(list)) return { candidates: [], dropped: 0 };
  const candidates: Candidate[] = [];
  for (const raw of list.slice(0, LIMITS.maxCandidates)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const c: Candidate = { topic: str(r.topic), subject: str(r.subject), predicate: str(r.predicate), value: str(r.value), unit: opt(r.unit),
      excerpt: str(r.excerpt), country: opt(r.country), valid_from: opt(r.valid_from), valid_until: opt(r.valid_until), reference_period: opt(r.reference_period),
      fact_type: opt(r.fact_type), value_number: opt(r.value_number), value_currency: opt(r.value_currency)?.toUpperCase() ?? null,
      value_period: opt(r.value_period), value_date: opt(r.value_date) };
    if (typeof r.confidence === "number" && Number.isFinite(r.confidence)) c.confidence = r.confidence;
    candidates.push(c);
  }
  return { candidates, dropped: Math.max(list.length - LIMITS.maxCandidates, 0) };
}

/** Mirrors public.extraction_norm(): NFC, lower case, digit separators removed, whitespace collapsed. */
export function norm(s: string) {
  let out = s.normalize("NFC").toLowerCase();
  for (let i = 0; i < 2; i++) out = out.replace(/([0-9])[ ,.'’  ]([0-9])/g, "$1$2");
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Local copy of the database's grounding rules (group 1 of extractor_propose),
 * used by --dry-run (no database). Returns null when the candidate would be
 * proposed; problems with the fact type or structured value never refuse a
 * candidate (L4) — see structuredNotes().
 */
export function precheck(c: Candidate, documentText: string, countrySlugs: string[]): string | null {
  if (!(TOPICS as readonly string[]).includes(c.topic)) return "Topic not in the allowed list";
  if (!c.subject || !c.predicate || !c.value) return "Missing subject/predicate/value";
  if (c.excerpt.length < 20 || c.excerpt.length > 500) return "Excerpt must be 20-500 characters";
  const excerpt = norm(c.excerpt);
  if (!norm(documentText).includes(excerpt)) return "Excerpt not found verbatim in the document text";
  if (c.country && !countrySlugs.includes(c.country)) return "Unknown country";
  const tokens = new Set(norm(`${c.value} ${c.unit ?? ""}`).match(/[0-9]+/g) ?? []);
  for (const d of [c.valid_from, c.valid_until, c.reference_period]) if (d) tokens.add(d.slice(0, 4));
  for (const t of tokens) if (!inExcerpt(t, excerpt)) return `Number ${t} not found in the excerpt`;
  return null;
}
const inExcerpt = (token: string, normalisedExcerpt: string) => new RegExp(`(^|[^0-9])${token}([^0-9]|$)`).test(normalisedExcerpt);

/**
 * What the database would drop from a grounded candidate (group 2, L4), for
 * --dry-run output. Kind and range checks need the type rows and are left to
 * the database.
 */
export function structuredNotes(c: Candidate, factTypeKeys: readonly string[]): string[] {
  const notes: string[] = [];
  const typed = !!c.fact_type && factTypeKeys.includes(c.fact_type);
  if (c.fact_type && !typed) notes.push(`Fact type dropped: "${c.fact_type}" is not offered for this page`);
  const number = c.value_number && /^[0-9]+(\.[0-9]+)?$/.test(c.value_number) ? c.value_number : null;
  if (c.value_number && !number) notes.push(`Structured number dropped: "${c.value_number}" is not digits with an optional decimal point`);
  if (![number, c.value_currency, c.value_period, c.value_date].some(Boolean)) return notes;
  if (!typed) return [...notes, "Structured value dropped: no fact type"];
  // Same as the database: trailing zeros dropped (6.50 -> 6.5), then normalised (6.5 -> 65).
  const token = number ? norm(number.includes(".") ? number.replace(/\.?0+$/, "") : number.replace(/^0+(?=\d)/, "")) : c.value_date?.slice(0, 4);
  if (token && !inExcerpt(token, norm(c.excerpt))) notes.push(`Structured value dropped: ${token} is not in the excerpt`);
  return notes;
}
