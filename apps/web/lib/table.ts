// Sorting for data tables whose rows are already loaded (URL state:
// ?sort=<key>&dir=desc). Kept out of components so it is testable.

export type SortDir = "asc" | "desc";

/** The sort to apply: a known key from the URL, else the default. */
export function readSort<K extends string>(keys: readonly K[], sort: unknown, dir: unknown, fallback: K, fallbackDir: SortDir = "asc") {
  const key = typeof sort === "string" && (keys as readonly string[]).includes(sort) ? (sort as K) : fallback;
  const d: SortDir = dir === "desc" ? "desc" : dir === "asc" ? "asc" : key === fallback ? fallbackDir : "asc";
  return { key, dir: d };
}

/** Clicking a header: a new column sorts ascending; the same column flips. */
export function nextDir(current: { key: string; dir: SortDir }, key: string): SortDir {
  return current.key === key && current.dir === "asc" ? "desc" : "asc";
}

/**
 * Stable sort by one column. Empty values (null / "") always go last, in
 * both directions, so "unknown" never masquerades as the smallest value.
 */
export function sortRows<T>(rows: readonly T[], value: (row: T) => string | number | null | undefined, dir: SortDir): T[] {
  const coll = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });
  return rows.map((row, i) => ({ row, i, v: value(row) })).sort((a, b) => {
    const ea = a.v === null || a.v === undefined || a.v === "", eb = b.v === null || b.v === undefined || b.v === "";
    if (ea || eb) return ea === eb ? a.i - b.i : ea ? 1 : -1;
    const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : coll.compare(String(a.v), String(b.v));
    return (dir === "desc" ? -c : c) || a.i - b.i;
  }).map((x) => x.row);
}
