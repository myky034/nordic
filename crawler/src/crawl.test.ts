import { expect, it } from "vitest";
import { runCrawl } from "./crawl";
import type { CrawlerDb, RecordInput, Target } from "./db";
import type { Fetcher } from "./fetch";
import type { Renderer, RenderResult } from "./render";

function fakeDb(targets: Target[], states: Record<string, { etag: string }> = {}) {
  const records: RecordInput[] = []; let finished: { status: string; note: string | null } | null = null;
  const structures: { documentId: string; formatVersion: string; pairs: number; capturedAt: Date }[] = [];
  const db: CrawlerDb = {
    startRun: async () => "run-1",
    dueTargets: async () => targets,
    urlStates: async () => Object.entries(states).map(([url, s]) => ({ url, etag: s.etag, last_modified: null, last_hash: null })),
    record: async (r) => { records.push(r); return { outcome: r.outcome === "fetched" ? "created" : r.outcome, document_id: r.outcome === "fetched" ? `doc:${r.url}` : null, flagged_facts: 0 }; },
    recordStructure: async (_run, documentId, structure, capturedAt) => { structures.push({ documentId, formatVersion: structure.formatVersion, pairs: structure.pairs.length, capturedAt }); return "created"; },
    finishRun: async (_id, status, note) => { finished = { status, note }; return {}; },
    close: async () => {},
  };
  return { db, records, structures, finished: () => finished };
}
const target = (over: Partial<Target>): Target => ({ target_id: "t1", source_id: "s1", source_url: "https://agency.example.test/", url: "https://agency.example.test/p",
  kind: "page", path_prefix: null, max_urls: 20, content_selector: null, render_js: false, ...over });
const site: Record<string, () => Response> = {
  "https://agency.example.test/p": () => new Response("<main><p>Rule A</p></main>", { headers: { "content-type": "text/html", etag: '"a"' } }),
  "https://agency.example.test/same": () => new Response(null, { status: 304 }),
  "https://agency.example.test/sitemap.xml": () => new Response(`<urlset><url><loc>https://agency.example.test/study/x</loc></url><url><loc>https://agency.example.test/work/y</loc></url></urlset>`, { headers: { "content-type": "application/xml" } }),
  "https://agency.example.test/study/x": () => new Response("<main><p>Study page</p></main>", { headers: { "content-type": "text/html" } }),
  "https://agency.example.test/pdf": () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }),
};
let flaky = 0;
const fetcher = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url === "https://agency.example.test/flaky") return ++flaky < 2 ? new Response("", { status: 503 }) : new Response("<p>ok</p>", { headers: { "content-type": "text/html" } });
  return (site[url] ?? (() => new Response("", { status: 404 })))();
}) as Fetcher;
const quiet = { respectRobots: false, delaySecs: 0, fetcher, log: () => {} } as const;

it("records new pages with a text hash, unchanged pages as not_modified, and expands sitemaps by prefix", async () => {
  const { db, records, finished } = fakeDb([
    target({}), target({ target_id: "t2", url: "https://agency.example.test/same" }),
    target({ target_id: "t3", kind: "sitemap", url: "https://agency.example.test/sitemap.xml", path_prefix: "/study/" }),
  ], { "https://agency.example.test/same": { etag: '"old"' } });
  await runCrawl({ db, trigger: "local", ...quiet });
  const byUrl = Object.fromEntries(records.map((r) => [r.url, r]));
  expect(byUrl["https://agency.example.test/p"]).toMatchObject({ outcome: "fetched", text: "Rule A", etag: '"a"' });
  expect(byUrl["https://agency.example.test/p"].contentHash).toMatch(/^[0-9a-f]{64}$/);
  expect(byUrl["https://agency.example.test/same"].outcome).toBe("not_modified");
  expect(byUrl["https://agency.example.test/study/x"]).toMatchObject({ outcome: "fetched", targetId: "t3" });
  expect(byUrl["https://agency.example.test/work/y"]).toBeUndefined();
  expect(finished()).toEqual({ status: "succeeded", note: null });
});
it("retries transient errors, records permanent ones, and ends the run as partial", async () => {
  const { db, records, finished } = fakeDb([
    target({ target_id: "a", url: "https://agency.example.test/flaky" }), target({ target_id: "b", url: "https://agency.example.test/missing" }),
    target({ target_id: "c", url: "https://agency.example.test/pdf" }),
  ]);
  await runCrawl({ db, trigger: "local", ...quiet });
  const byUrl = Object.fromEntries(records.map((r) => [r.url, r]));
  expect(byUrl["https://agency.example.test/flaky"].outcome).toBe("fetched");
  expect(byUrl["https://agency.example.test/missing"]).toMatchObject({ outcome: "error", errorCategory: "http_404" });
  expect(byUrl["https://agency.example.test/pdf"].outcome).toBe("skipped_type");
  expect(finished()?.status).toBe("partial");
});
it("closes the run as failed and rethrows when the database is unavailable", async () => {
  const { db, finished } = fakeDb([]);
  db.dueTargets = async () => { throw new Error("db down"); };
  await expect(runCrawl({ db, trigger: "local", ...quiet })).rejects.toThrow("db down");
  expect(finished()?.status).toBe("failed");
});

// L6 (Decision Log 2026-10-15): pages read in a real browser by default.
function fakeBrowser(pages: Record<string, RenderResult>) {
  const rendered: string[] = []; let starts = 0, closed = 0;
  const renderer: Renderer = { render: async (url) => { rendered.push(url); return pages[url] ?? { kind: "render_failed" }; }, close: async () => { closed++; } };
  return { startRenderer: async () => { starts++; return renderer; }, rendered, stats: () => ({ starts, closed }) };
}
it("reads browser pages from the rendered HTML, so text drawn by JavaScript is kept", async () => {
  const { db, records } = fakeDb([target({ render_js: true })]);
  const b = fakeBrowser({ "https://agency.example.test/p": { kind: "ok", html: "<main><p>Rule A</p><p>Tuition fee: 67500 SEK</p></main>" } });
  await runCrawl({ db, trigger: "local", ...quiet, startRenderer: b.startRenderer });
  expect(records[0]).toMatchObject({ outcome: "fetched", text: "Rule A\nTuition fee: 67500 SEK" });
  expect(b.stats()).toEqual({ starts: 1, closed: 1 });
});
it("never asks 'not modified' for browser pages, and starts no browser when no page needs it", async () => {
  const states = { "https://agency.example.test/same": { etag: '"old"' } };
  const sent: (string | null)[] = [];
  const spy = (async (input: RequestInfo | URL, init?: RequestInit) => { sent.push(new Headers(init?.headers).get("if-none-match")); return fetcher(input, init); }) as Fetcher;
  const browserPage = fakeDb([target({ url: "https://agency.example.test/p", render_js: true })], { "https://agency.example.test/p": { etag: '"a"' } });
  const b = fakeBrowser({ "https://agency.example.test/p": { kind: "ok", html: "<main><p>Rule A</p></main>" } });
  await runCrawl({ db: browserPage.db, trigger: "local", ...quiet, fetcher: spy, startRenderer: b.startRenderer });
  expect(sent).toEqual([null]);
  const staticOnly = fakeDb([target({ url: "https://agency.example.test/same" })], states);
  const unused = fakeBrowser({});
  await runCrawl({ db: staticOnly.db, trigger: "local", ...quiet, startRenderer: unused.startRenderer });
  expect(staticOnly.records[0].outcome).toBe("not_modified");
  expect(unused.stats()).toEqual({ starts: 0, closed: 0 });
});
it("records a rendering failure as an error and never stores the static text instead", async () => {
  const { db, records, finished } = fakeDb([target({ render_js: true }), target({ target_id: "t2", url: "https://agency.example.test/study/x", render_js: true })]);
  const b = fakeBrowser({ "https://agency.example.test/p": { kind: "render_timeout" }, "https://agency.example.test/study/x": { kind: "off_origin" } });
  await runCrawl({ db, trigger: "local", ...quiet, startRenderer: b.startRenderer });
  const byUrl = Object.fromEntries(records.map((r) => [r.url, r]));
  expect(byUrl["https://agency.example.test/p"]).toMatchObject({ outcome: "error", errorCategory: "render_timeout" });
  expect(byUrl["https://agency.example.test/p"].text).toBeUndefined();
  expect(byUrl["https://agency.example.test/study/x"]).toMatchObject({ outcome: "error", errorCategory: "off_origin" });
  expect(finished()?.status).toBe("partial");
  expect(b.stats().closed).toBe(1);
});
it("does not fetch or render a page whose plain GET already fails", async () => {
  const { db, records } = fakeDb([target({ url: "https://agency.example.test/pdf", render_js: true })]);
  const b = fakeBrowser({});
  await runCrawl({ db, trigger: "local", ...quiet, startRenderer: b.startRenderer });
  expect(records[0].outcome).toBe("skipped_type");
  expect(b.rendered).toEqual([]);
});

// PR 1 (KHLOE-161): structured snapshot next to the stored text.
it("stores a structure snapshot for every stored or unchanged page, with the same capture time as the text", async () => {
  const { db, records, structures } = fakeDb([target({}), target({ target_id: "t2", url: "https://agency.example.test/same" })], { "https://agency.example.test/same": { etag: '"old"' } });
  await runCrawl({ db, trigger: "local", ...quiet });
  expect(structures).toEqual([{ documentId: "doc:https://agency.example.test/p", formatVersion: "html-structure-v1", pairs: 0, capturedAt: records[0].retrievedAt }]);
  // 304 (not modified) carries no HTML, so no snapshot.
  expect(records.find((r) => r.url.endsWith("/same"))?.outcome).toBe("not_modified");
});
it("logs a failed structure save and ends the run partial, but keeps the stored text", async () => {
  const { db, records, finished } = fakeDb([target({})]);
  db.recordStructure = async () => { throw new Error("crawler_invalid"); };
  const lines: string[] = [];
  await runCrawl({ db, trigger: "local", ...quiet, log: (l) => lines.push(l) });
  expect(records[0]).toMatchObject({ outcome: "fetched", text: "Rule A" });
  expect(lines.some((l) => l.includes('"operation":"structure"') && l.includes('"category":"structure_failed"') && l.includes("crawler_invalid"))).toBe(true);
  expect(finished()?.status).toBe("partial");
});
it("does not save a structure for pages that failed or were skipped", async () => {
  const { db, structures } = fakeDb([target({ url: "https://agency.example.test/pdf" }), target({ target_id: "b", url: "https://agency.example.test/missing" })]);
  await runCrawl({ db, trigger: "local", ...quiet });
  expect(structures).toEqual([]);
});
