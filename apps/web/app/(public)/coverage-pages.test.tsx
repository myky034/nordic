import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/form", () => ({ default: (props: { children: React.ReactNode }) => <form>{props.children}</form> }));
vi.mock("@/lib/rbac/viewer", () => ({ viewerPermissions: async () => null }));
vi.mock("@/lib/rbac/access", () => ({ logAccessError: vi.fn() }));
vi.mock("@/lib/registry/queries", () => ({ listCountries: async () => ["sweden", "denmark", "finland", "norway", "netherlands"].map((slug, i) => ({ id: `c${i}`, slug, name: slug, status: "needs_research", _count: { sources: 3 } })) }));
vi.mock("@/lib/supabase/public", () => ({ createPublicClient: () => ({ from: (t: string) => { calls.push(t); throw new Error("no database in this test"); } }) }));
import { setTestCoverage } from "@/test/coverage";
import { setTestLocale } from "@/test/i18n";
import { navigationFor } from "@/lib/navigation/menu";
import { dictionaries } from "@/lib/i18n/dictionaries";
import Home from "./page";
import Countries from "./(explore)/countries/page";
import Compare from "./(explore)/compare/page";

// UX review 2026-10-13 (B1, B2, C5): synthetic coverage only.
const sweden = { countries: { sweden: { topics: ["study", "permits", "work"] as const }, denmark: { topics: [] }, finland: { topics: [] }, norway: { topics: [] }, netherlands: { topics: [] } }, compareReady: false };
afterEach(() => { setTestCoverage(null); setTestLocale("vi"); });

it("hides the comparison entry from the menu only when told it is not ready", () => {
  const ids = (o?: { showCompare?: boolean }) => navigationFor(dictionaries.vi.nav, o).map((e) => e.id);
  expect(ids()).toContain("compare");
  expect(ids({ showCompare: false })).not.toContain("compare");
});
it("leads the home page with countries that have data and lists the rest as coming soon", async () => {
  setTestCoverage({ ...sweden, countries: { ...sweden.countries, sweden: { topics: [...sweden.countries.sweden.topics] } } });
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain("Hiện có nhiều dữ liệu nhất: Thụy Điển, thạc sĩ CNTT.");
  expect(html).toContain("Du học · Visa &amp; cư trú · Việc làm");
  expect(html).toMatch(/Sắp có: .*Đan Mạch/);
  expect(html).not.toContain('href="/compare"');
});
it("keeps the old home page when coverage is unknown", async () => {
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain('href="/compare"');
  expect(html).not.toContain("Sắp có");
});
it("labels countries by covered topics and groups the rest, in English too", async () => {
  setTestLocale("en");
  setTestCoverage({ ...sweden, countries: { ...sweden.countries, sweden: { topics: ["study", "permits", "work"] } } });
  const html = renderToStaticMarkup(await Countries());
  expect(html).toContain("Partial");
  expect(html).toContain("Data on: Study · Visas &amp; residence · Work");
  expect(html).toContain("Coming soon");
  expect(html.indexOf("Sweden")).toBeLessThan(html.indexOf("Coming soon"));
  expect(html).toContain("They do not rate quality or completeness.");
});
it("explains why the comparison is not available yet, without querying the database", async () => {
  setTestCoverage({ countries: {}, compareReady: false });
  calls.length = 0;
  const html = renderToStaticMarkup(await Compare({ params: Promise.resolve({}), searchParams: Promise.resolve({ c: ["sweden", "denmark"] }) }));
  expect(html).toContain("Bảng so sánh sắp có");
  expect(html).toContain("ít nhất 3 chỉ số");
  expect(calls).toEqual([]);
});
