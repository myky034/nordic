import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// PR 1.5 acceptance (docs/architecture/pr1.5-structure-preview-plan.md §8).
// The real query module runs against a fake Supabase client that records every
// call, so the tests also prove which table/view each read goes through.
const { ctx } = vi.hoisted(() => ({ ctx: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/rbac/access", () => ({ accessContext: ctx, logAccessError: vi.fn() }));
vi.mock("@/components/key-nav", () => ({ KeyNav: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
import Page from "./page";

const DOC = "11111111-1111-4111-8111-111111111111";
const OLD_DOC = "22222222-2222-4222-8222-222222222222";
const S_NEW = "33333333-3333-4333-8333-333333333333";
const S_OLD = "44444444-4444-4444-8444-444444444444";
const S_OTHER = "55555555-5555-4555-8555-555555555555";
// The crawler's real output for a synthetic page, saved by the crawler (see crawler/scripts/structure-fixtures.ts).
const fixture = readFileSync(new URL("../../../../../../../../crawler/test/fixtures/structures/programme-sidebar.json", import.meta.url), "utf8");
const structure = () => JSON.parse(fixture);
const changed = () => { const s = structure(); s.pairs[3].value = "First instalment: 47000 SEK."; return s; };
const snap = (id: string, document_id: string, captured_at: string, s: unknown) =>
  ({ id, document_id, format_version: "html-structure-v1", structure_hash: "ab".repeat(32), captured_at, crawler_run_id: "66666666-6666-4666-8666-666666666666", created_at: captured_at, structure: s });

type Call = { table: string; filters: [string, string, unknown][]; select: string; count?: string; range?: [number, number] };
let calls: Call[];
let db: { documents: Record<string, unknown>[]; structures: ReturnType<typeof snap>[]; facts: unknown[]; items: unknown[] };
function client() {
  return {
    from(table: string) {
      const call: Call = { table, filters: [], select: "" };
      calls.push(call);
      const rows = () => {
        const all: Record<string, unknown>[] = table === "documents" ? db.documents : table === "facts" ? db.facts as never : table === "crawler_run_items" ? db.items as never
          : table === "document_structures_latest" ? latest() : db.structures;
        return all.filter((r) => call.filters.every(([op, k, v]) => op === "eq" ? r[k] === v : op === "in" ? (v as unknown[]).includes(r[k]) : op === "neq" ? r[k] !== v : true));
      };
      const q = {
        select: (s: string, o?: { count?: string }) => { call.select = s; call.count = o?.count; return q; },
        eq: (k: string, v: unknown) => { call.filters.push(["eq", k, v]); return q; },
        neq: (k: string, v: unknown) => { call.filters.push(["neq", k, v]); return q; },
        in: (k: string, v: unknown) => { call.filters.push(["in", k, v]); return q; },
        order: () => q, limit: () => q,
        // Like PostgREST: range() pages the rows, count is the total before paging.
        range: (from: number, to: number) => { call.range = [from, to]; return q; },
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (r: (v: unknown) => unknown) => { const all = sorted(rows()); return r({ data: call.range ? all.slice(call.range[0], call.range[1] + 1) : all, count: call.count ? all.length : null, error: null }); },
      };
      return q;
    },
  };
}
// Newest first, as the queries order them (captured_at / retrieved_at desc).
const sorted = (rows: Record<string, unknown>[]) => [...rows].sort((a, b) => String(b.captured_at ?? b.retrieved_at ?? "").localeCompare(String(a.captured_at ?? a.retrieved_at ?? "")));
// The view returns one row per document: the newest capture.
const latest = () => [...new Set(db.structures.map((s) => s.document_id))].map((d) => db.structures.filter((s) => s.document_id === d).sort((a, b) => b.captured_at.localeCompare(a.captured_at))[0]);

const doc = (over: Record<string, unknown> = {}) => ({ id: DOC, source_id: "s1", canonical_url: "https://uni.example.test/p", title: "Example programme", retrieved_at: "2026-10-10T08:00:00Z",
  ingestion_method: "crawler", sources: { name: "Example University" }, ...over });
const page = async (q: Record<string, string> = {}, id = DOC) => renderToStaticMarkup(await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve(q) } as never));
const as = (permissions: string[]) => ctx.mockResolvedValue({ client: client(), permissions });

beforeEach(() => {
  calls = [];
  db = {
    documents: [doc(), doc({ id: OLD_DOC, retrieved_at: "2026-09-01T08:00:00Z" })],
    structures: [snap(S_NEW, DOC, "2026-10-10T08:00:00Z", structure()), snap(S_OLD, DOC, "2026-10-01T08:00:00Z", structure()), snap(S_OTHER, OLD_DOC, "2026-09-01T08:00:00Z", changed())],
    facts: [{ id: "f1", document_id: DOC, status: "proposed", value: "45000 SEK", unit: null, value_number: 45000, value_currency: "SEK", value_period: null, value_date: null, fact_types: { label_vi: "Học phí", label_en: "Tuition" } }],
    items: [{ url: "https://uni.example.test/p", created_at: "2026-10-10T08:00:00Z", outcome: "created", http_status: 200, error_category: null, crawler_runs: { status: "partial", note: "1 structure_failed" } }],
  };
});

describe("access", () => {
  it("refuses viewers with neither crawler.manage nor a structure-read permission", async () => {
    as(["documents.read"]);
    const html = await page();
    expect(html).toContain("Bạn chưa có quyền xem dữ liệu cấu trúc");
    expect(calls).toHaveLength(0);
  });
  it("lets an Editor (documents.ingest) read the structure, and hides crawl runs from them", async () => {
    as(["documents.ingest"]);
    const html = await page({ tab: "pairs" });
    expect(html).toContain("Tuition fee");
    expect(calls.some((c) => c.table === "crawler_run_items")).toBe(false);
  });
  it("tells a crawler operator without a read permission that RLS hides the data (no bypass)", async () => {
    as(["crawler.manage"]);
    const html = await page();
    expect(html).toContain("Bạn chưa có quyền xem dữ liệu cấu trúc");
    expect(html).not.toContain("Tuition fee");
  });
  it("uses only the viewer's client: no service-role import anywhere in the feature", () => {
    for (const f of ["app/(app)/admin/crawler/documents/[id]/page.tsx", "lib/crawler/structure-queries.ts", "lib/crawler/structure-view.ts", "components/crawler/structure-preview.tsx"]) {
      // Code only: comments may name the service role to say it is not used.
      const src = readFileSync(new URL(`../../../../../../${f}`, import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(src).not.toMatch(/@supabase\/supabase-js|process\.env/);
      expect(src).not.toMatch(/service[-_]?role|SERVICE_ROLE|supabase\/admin|createAdminClient/i);
      expect(src).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    }
  });
});

describe("three states", () => {
  it("not crawled: a manual document explains why there is no structure and reads nothing else", async () => {
    db.documents = [doc({ ingestion_method: "manual" })];
    as(["documents.ingest"]);
    expect(await page()).toContain("Tài liệu này không do crawler lấy");
    expect(calls.map((c) => c.table)).toEqual(["documents"]);
  });
  it("missing: a crawler document without snapshot, with the latest crawl attempts for operators", async () => {
    db.structures = [];
    as(["crawler.manage", "facts.review"]);
    const html = await page();
    expect(html).toContain("Phiên bản này chưa có cấu trúc");
    expect(html).toContain("1 structure_failed");
    expect(html).toContain("HTTP 200");
  });
  it("available: latest through the deterministic view, with format and hash", async () => {
    as(["facts.review"]);
    const html = await page();
    const current = calls.find((c) => c.select.includes("structure") && c.select.startsWith("id,") && c.filters.some(([, k, v]) => k === "document_id" && v === DOC) && c.table !== "document_structures");
    expect(current?.table).toBe("document_structures_latest");
    expect(html).toContain("html-structure-v1");
    expect(html).toContain("Mới nhất");
    expect(html).toContain("Đây là NỘI DUNG THÔ");
  });
  it("?snapshot opens the chosen capture of THIS document, by id", async () => {
    as(["facts.review"]);
    const html = await page({ snapshot: S_OLD });
    const byId = calls.find((c) => c.filters.some(([, k, v]) => k === "id" && v === S_OLD));
    expect(byId?.table).toBe("document_structures");
    expect(byId?.filters).toContainEqual(["eq", "document_id", DOC]);
    expect(html).toContain("2026-10-01 08:00");
  });
  it("an unknown snapshot id is a 404, and a malformed payload is shown raw", async () => {
    as(["facts.review"]);
    await expect(page({ snapshot: "77777777-7777-4777-8777-777777777777" })).rejects.toThrow("NEXT_NOT_FOUND");
    db.structures = [snap(S_NEW, DOC, "2026-10-10T08:00:00Z", { formatVersion: "html-structure-v9", x: 1 })];
    const html = await page();
    expect(html).toContain("Định dạng chưa hỗ trợ");
    expect(html).toContain("html-structure-v9");
  });
});

describe("views", () => {
  it("shows pairs with ref, section and origin; the filter narrows by text and section", async () => {
    as(["facts.review"]);
    const pairs = await page({ tab: "pairs" });
    for (const s of ["p4", "Tuition fee", "First instalment: 45000 SEK.", "Master&#x27;s Programme in Example Studies"]) expect(pairs).toContain(s);
    const filtered = await page({ tab: "pairs", q: "instalment" });
    expect(filtered).toContain("Tuition fee");
    expect(filtered).not.toContain("Selection");
    const bySection = await page({ tab: "pairs", section: "Master's Programme in Example Studies › Programme overview" });
    expect(bySection).toContain("Required supporting documentation");
    expect(bySection).not.toContain("Tuition fee");
  });
  it("?ref opens the element inspector with domPath, labelPath and valuePath", async () => {
    as(["facts.review"]);
    const html = await page({ tab: "pairs", ref: "p4" });
    expect(html).toContain('role="dialog"');
    for (const s of ["Phần tử p4", "labelPath", "valuePath", "ref và domPath chỉ ổn định trong snapshot này."]) expect(html).toContain(s);
  });
  it("JSON-LD is printed as escaped text, never as HTML", async () => {
    const s = structure();
    s.structuredData = [{ adapter: "json-ld", adapterVersion: 1, items: [{ "@type": "Course", name: "<script>alert(1)</script>" }] }];
    db.structures = [snap(S_NEW, DOC, "2026-10-10T08:00:00Z", s)];
    as(["facts.review"]);
    const html = await page({ tab: "jsonld" });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
  });
  it("normalized facts are a separate panel linking to the mapping screen", async () => {
    as(["facts.propose"]);
    const html = await page({ tab: "pairs" });
    expect(html).toContain("First instalment");
    expect(html).toContain("Thông tin chương trình đã chuẩn hóa");
    expect(html).toContain("Học phí");
    expect(html).toContain(`/facts/map/${DOC}`);
    // Raw content stays out of the normalized panel.
    const panel = html.slice(html.indexOf("Thông tin chương trình đã chuẩn hóa"));
    expect(panel).toContain("45000 SEK");
    expect(panel).not.toContain("First instalment");
  });
});

describe("long histories (review 2026-10-15)", () => {
  const uuidN = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
  const at = (n: number) => new Date(Date.UTC(2026, 8, 1) + n * 3600_000).toISOString();
  it("pages the snapshot history with an exact total; latest still comes from the view", async () => {
    db.structures = Array.from({ length: 60 }, (_, i) => snap(uuidN(i + 1), DOC, at(i), structure()));
    as(["facts.review"]);
    const html = await page({ hpage: "2" });
    const history = calls.find((c) => c.table === "document_structures" && c.count === "exact");
    expect(history?.range).toEqual([50, 99]);
    expect(html).toContain("Lịch sử snapshot của phiên bản này (60)");
    expect(html).toContain("51–60 / 60");
    // The newest capture (#60) is not on page 2, yet it is shown and marked latest via the view.
    expect(calls.some((c) => c.table === "document_structures_latest" && c.filters.some(([, k, v]) => k === "document_id" && v === DOC))).toBe(true);
    expect(html).toContain(`${at(59).replace("T", " ").slice(0, 16)}`);
    expect(html).toContain("Mới nhất");
    expect(html).not.toContain(`snapshot=${uuidN(60)}`);
  });
  it("pages the versions list and still compares with a version that is not on the page shown", async () => {
    const versions = Array.from({ length: 55 }, (_, i) => doc({ id: uuidN(100 + i), retrieved_at: at(i) }));
    db.documents = [doc(), ...versions];
    db.structures.push(snap(uuidN(900), uuidN(100), at(0), changed()));
    as(["facts.review"]);
    const html = await page({ vpage: "1", tab: "diff", compare: uuidN(900) });
    expect(calls.find((c) => c.table === "documents" && c.count === "exact")?.range).toEqual([0, 49]);
    expect(html).toContain("Các phiên bản của trang (56)");
    expect(html).toContain("1–50 / 56");
    // Oldest version (page 2 of versions) is still a valid comparison: same source + URL, checked in the database.
    expect(html).toContain("First instalment: 47000 SEK.");
  });
});

describe("comparison by content", () => {
  it("compares with another version of the page and reports the changed value, not refs", async () => {
    as(["facts.review"]);
    const html = await page({ tab: "diff", compare: S_OTHER });
    expect(html).toContain("Đổi giá trị");
    expect(html).toContain("First instalment: 47000 SEK.");
    expect(html).toContain("First instalment: 45000 SEK.");
    // The comparison snapshot's document must be a version of THIS page (same source + canonical URL).
    const sibling = calls.find((c) => c.table === "documents" && c.filters.some(([, k, v]) => k === "id" && v === OLD_DOC));
    expect(sibling?.filters).toEqual(expect.arrayContaining([["eq", "source_id", "s1"], ["eq", "canonical_url", "https://uni.example.test/p"]]));
  });
  it("two snapshots with the same content are reported as identical", async () => {
    as(["facts.review"]);
    expect(await page({ tab: "diff", compare: S_OLD })).toContain("Không có khác biệt về nội dung.");
  });
  it("a snapshot from an unrelated document cannot be pulled in as comparison", async () => {
    db.structures.push(snap("88888888-8888-4888-8888-888888888888", "99999999-9999-4999-8999-999999999999", "2026-10-05T08:00:00Z", changed()));
    as(["facts.review"]);
    expect(await page({ tab: "diff", compare: "88888888-8888-4888-8888-888888888888" })).toContain("Chọn một snapshot");
  });
});
