// Shared paging/search rules for every list. Kept out of UI components so the
// limits are testable and identical across Prisma and PostgREST reads.
export const PAGE_SIZE = 25;
// Deep offsets are expensive and never useful to a human; 400 pages x 25 = 10k rows.
export const MAX_PAGE = 400;

type Query = Record<string, string | string[] | undefined>;

export function pageParam(query: Query) {
  const raw = typeof query.page === "string" ? query.page : "";
  const n = /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  return Math.min(Math.max(n, 1), MAX_PAGE);
}

// Free-text search box. Trimmed, length-capped, control characters removed.
// Callers must still escape LIKE wildcards (likePattern) or use Prisma `contains`.
export function searchParam(query: Query) {
  const raw = typeof query.q === "string" ? query.q : "";
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100);
}

/** Inclusive row range for PostgREST `.range(from, to)`; `skip/take` for Prisma. */
export function pageWindow(page: number, size = PAGE_SIZE) {
  const from = (page - 1) * size;
  return { from, to: from + size - 1, skip: from, take: size };
}

export function pageSummary(total: number, page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  const first = total === 0 ? 0 : (current - 1) * size + 1;
  const last = Math.min(current * size, total);
  return { pages, current, first, last, total, hasPrev: current > 1, hasNext: current < pages };
}

/** Rebuilds a list URL with one parameter changed; empty values are dropped. */
export function withParams(path: string, query: Query, changes: Record<string, string | number | null>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string" && value.trim()) params.set(key, value.trim());
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "" || (key === "page" && value === 1)) params.delete(key);
    else params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

/** Allowlisted tab/segment value from the URL, e.g. ?status=proposed. */
export function choiceParam<T extends string>(query: Query, key: string, allowed: readonly T[], fallback: T): T {
  const raw = query[key];
  return typeof raw === "string" && (allowed as readonly string[]).includes(raw) ? raw as T : fallback;
}

/**
 * PostgREST answers a page past the last row with error PGRST103 ("range not
 * satisfiable") instead of an empty list — e.g. an old ?page=3 link after the
 * data or filters shrank. Callers redirect to page 1 rather than show an error.
 */
export function isPastLastPage(error: { code?: string } | null | undefined) {
  return error?.code === "PGRST103";
}
