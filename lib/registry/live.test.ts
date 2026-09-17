import { config } from "dotenv";
import { afterAll, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const live = process.env.REGISTRY_LIVE_TEST === "1";
if (live) config({ path: ".env.local", quiet: true });

it.skipIf(!live)("reads the deployed registry through the production Prisma/RLS path", async () => {
  const { listCountries, listSources, getCountry } = await import("./queries");
  const countries = await listCountries();
  expect(countries).toHaveLength(5);
  expect((await getCountry("sweden"))?.name).toBe("Sweden");
  expect(await getCountry("missing-country")).toBeNull();
  expect(await listSources({ country: "unassigned" })).toHaveLength(2);
  expect(await listSources({ country: "sweden" })).toHaveLength(0);
}, 30000);

afterAll(async () => {
  if (live) {
    const { prisma } = await import("../db");
    await prisma.$disconnect();
  }
});
