import { expect, it } from "vitest";
import { runCrawl } from "./crawl";
import type { CrawlerDb, RecordInput, Target } from "./db";
import type { Fetcher } from "./fetch";

function fakeDb(targets: Target[], states: Record<string, { etag: string }> = {}) {
  const records: RecordInput[] = []; let finished: { status: string; note: string | null } | null = null;
  const db: CrawlerDb = {
    startRun: async () => "run-1",
    dueTargets: async () => targets,
    urlStates: async () => Object.entries(states).map(([url, s]) => ({ url, etag: s.etag, last_modified: null, last_hash: null })),
    record: async (r) => { records.push(r); return { outcome: r.outcome === "fetched" ? "created" : r.outcome, document_id: null, flagged_facts: 0 }; },
    finishRun: async (_id, status, note) => { finished = { status, note }; return {}; },
    close: async () => {},
  };
  return { db, records, finished: () => finished };
}
const target = (over: Partial<Target>): Target => ({ target_id: "t1", source_id: "s1", source_url: "https://agency.example.test/", url: "https://agency.example.test/p",
  kind: "page", path_prefix: null, max_urls: 20, content_selector: null, ...over });
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
