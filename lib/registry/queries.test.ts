import { beforeEach, expect, it, vi } from "vitest";

const { tx, transaction } = vi.hoisted(() => {
  const tx = { $executeRaw: vi.fn(), country: { findMany: vi.fn(), findUnique: vi.fn() }, source: { findMany: vi.fn() } };
  return { tx, transaction: vi.fn(async (read: (client: typeof tx) => unknown) => read(tx)) };
});
vi.mock("server-only", () => ({}));
vi.mock("../db", () => ({ prisma: { $transaction: transaction } }));
import { listCountries, listSources } from "./queries";

beforeEach(() => { vi.clearAllMocks(); });
it("switches to the public role before querying", async () => {
  tx.country.findMany.mockResolvedValue([]);
  expect(await listCountries()).toEqual([]);
  expect(tx.$executeRaw.mock.calls[0][0][0]).toBe("SET LOCAL ROLE anon");
  expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.country.findMany.mock.invocationCallOrder[0]);
});
it("maps unassigned and unknown filters to null without raw SQL", async () => {
  tx.source.findMany.mockResolvedValue([]);
  await listSources({ country: "unassigned", tier: "unknown" });
  expect(tx.source.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { countryId: null, sourceTier: null }, take: 101 }));
});
it("does not turn a database failure into empty results or log secrets", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  tx.country.findMany.mockRejectedValueOnce(new Error("postgresql://secret"));
  await expect(listCountries()).rejects.toThrow("could not be loaded");
  expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
  log.mockRestore();
});
