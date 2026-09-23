import "server-only";
import { prisma } from "../db";
import type { Prisma } from "@nordic/db";
import { registryFilters } from "./domain";
import { pageWindow, searchParam } from "../pagination";
import { uuidPattern } from "../documents/domain";

export async function readPublic<T>(operation: string, read: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  try {
    // Direct Prisma connections do not inherit Supabase JWT/RLS context.
    // A transaction-local role prevents owner credentials from bypassing public RLS
    // and cannot leak to the next request through the connection pool.
    // Allow a bounded cold TLS/pooler connection beyond the 2-second default.
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL ROLE anon`;
      return read(tx);
    }, { maxWait: 10_000, timeout: 10_000 });
  } catch (error) {
    const rawCode = error && typeof error === "object" && "code" in error ? error.code : null;
    const code = typeof rawCode === "string" && /^P\d{4}$/.test(rawCode) ? rawCode : "unknown";
    console.error({ source: "postgresql", operation, timestamp: new Date().toISOString(), status: "failed", category: "registry_read_failed", code });
    throw new Error("The registry could not be loaded. Please try again later.");
  }
}

export function listCountries() {
  return readPublic("list_countries", (tx) => tx.country.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { sources: true } } } }));
}

export function getCountry(slug: string) {
  return readPublic("get_country", (tx) => tx.country.findUnique({ where: { slug }, include: { sources: { orderBy: { name: "asc" } } } }));
}

type Query = Record<string, string | string[] | undefined>;
function sourceWhere(query: Query): Prisma.SourceWhereInput {
  const filters = registryFilters(query);
  const q = searchParam(query);
  return {
    ...(filters.country === "unassigned" ? { countryId: null } : filters.country ? { country: { slug: filters.country } } : {}),
    ...(filters.tier ? { sourceTier: filters.tier === "unknown" ? null : filters.tier } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    // Prisma parameterises `contains`, and escapes %/_ itself.
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { canonicalUrl: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
}

/** Unpaginated, capped list for pickers (e.g. the document import form). */
export function listSources(query: Query) {
  return readPublic("list_sources", (tx) => tx.source.findMany({
    where: sourceWhere(query),
    include: { country: { select: { name: true, slug: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 101,
  }));
}

/** One page of sources plus the total, for browsable lists. */
export function searchSources(query: Query, page: number) {
  const { skip, take } = pageWindow(page);
  const where = sourceWhere(query);
  return readPublic("search_sources", async (tx) => {
    const [rows, total] = await Promise.all([
      tx.source.findMany({ where, include: { country: { select: { name: true, slug: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], skip, take }),
      tx.source.count({ where }),
    ]);
    return { rows, total };
  });
}

/** Counts per verification status, for the admin segmented control. */
export function sourceStatusCounts() {
  return readPublic("source_status_counts", (tx) => tx.source.groupBy({ by: ["status"], _count: { _all: true } }));
}

export function getSource(id: string) {
  if (!uuidPattern.test(id)) return Promise.resolve(null);
  return readPublic("get_source", (tx) => tx.source.findUnique({
    where: { id },
    include: {
      country: { select: { name: true, slug: true } },
      documents: { select: { id: true, title: true, retrievedAt: true }, orderBy: [{ retrievedAt: "desc" }, { id: "desc" }], take: 10 },
      _count: { select: { documents: true } },
    },
  }));
}
