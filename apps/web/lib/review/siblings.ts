// Other claims from the same evidence document, shown next to the one being
// reviewed.
//
// WHY: in the 2026-09-26 Sweden batch, nine distinct claims (different
// occupations' salaries, different permit requirements) were rejected as
// "duplicates" because they came from the same page. Many claims per page is
// normal: each proves one thing. A claim is only a POSSIBLE duplicate when it
// states the same thing — same subject and same predicate. That is flagged as
// a hint for the reviewer, never decided automatically (AGENTS.md 1.4).

export type Sibling = { id: string; subject: string; predicate: string; value: string; unit: string | null; status: string };

// NFC + case + whitespace, so "Residence permit " and "residence  permit" match.
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

export function isSameClaim(a: { subject: string; predicate: string }, b: { subject: string; predicate: string }) {
  return norm(a.subject) === norm(b.subject) && norm(a.predicate) === norm(b.predicate);
}

/** Possible duplicates first, then in the order given (oldest first). Rejected claims are left out: they are not a duplicate risk. */
export function sameDocumentClaims(current: { subject: string; predicate: string }, others: Sibling[]) {
  const rows = others.filter((o) => o.status !== "rejected").map((o) => ({ ...o, possibleDuplicate: isSameClaim(current, o) }));
  return [...rows.filter((r) => r.possibleDuplicate), ...rows.filter((r) => !r.possibleDuplicate)];
}
