import { LIMITS, TOPICS } from "./config";

export type Candidate = {
  topic: string; subject: string; predicate: string; value: string; unit: string | null; excerpt: string;
  country: string | null; valid_from: string | null; valid_until: string | null; reference_period: string | null; confidence?: number;
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
      excerpt: str(r.excerpt), country: opt(r.country), valid_from: opt(r.valid_from), valid_until: opt(r.valid_until), reference_period: opt(r.reference_period) };
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
 * Local copy of the database's grounding rules, used by --dry-run (no
 * database) and to explain results. Returns null when the candidate passes.
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
  for (const t of tokens) if (!new RegExp(`(^|[^0-9])${t}([^0-9]|$)`).test(excerpt)) return `Number ${t} not found in the excerpt`;
  return null;
}
