import { config } from "dotenv";
import { afterAll, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const live = process.env.DOCUMENTS_LIVE_TEST === "1";
if (live) config({ path: ".env.local", quiet: true });
it.skipIf(!live)("reads empty hosted library and checks role grants without inserting fixtures", async () => {
  const { listDocuments, getDocument } = await import("./queries");
  expect(await listDocuments()).toEqual([]);
  expect(await getDocument("invalid-id")).toBeNull();
  const { prisma } = await import("../db");
  const grants = await prisma.$queryRaw<{ public_insert: boolean; public_member: boolean; internal_insert: boolean; internal_update: boolean }[]>`
    SELECT has_table_privilege('authenticated', 'public.documents', 'INSERT') AS public_insert,
    pg_has_role('authenticated', 'nordic_ingestor', 'MEMBER') AS public_member,
    has_table_privilege('nordic_ingestor', 'public.documents', 'INSERT') AS internal_insert,
    has_table_privilege('nordic_ingestor', 'public.documents', 'UPDATE') AS internal_update`;
  expect(grants[0]).toEqual({ public_insert: false, public_member: false, internal_insert: true, internal_update: false });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL ROLE nordic_ingestor`;
    expect(await tx.document.count()).toBe(0);
    expect(await tx.source.count()).toBeGreaterThanOrEqual(2);
  }, { maxWait: 10000, timeout: 10000 });
}, 30000);
afterAll(async () => { if (live) { const { prisma } = await import("../db"); await prisma.$disconnect(); } });
