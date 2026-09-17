import "server-only";
import { prisma } from "../db";
import type { Prisma } from "../../prisma/generated/client/client";
import { registryFilters } from "./domain";

async function readPublic<T>(operation: string, read: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
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

export function listSources(query: Record<string, string | string[] | undefined>) {
  const filters = registryFilters(query);
  return readPublic("list_sources", (tx) => tx.source.findMany({
    where: {
      ...(filters.country === "unassigned" ? { countryId: null } : filters.country ? { country: { slug: filters.country } } : {}),
      ...(filters.tier ? { sourceTier: filters.tier === "unknown" ? null : filters.tier } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: { country: { select: { name: true, slug: true } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 101,
  }));
}
