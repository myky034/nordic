import { BasicCrawler, Configuration } from "@crawlee/basic";
import { metadataHash, textHash } from "@nordic/db/document-hash";
import { BOT_NAME, LIMITS, PAGE_TYPES, SITEMAP_TYPES, userAgent } from "./config";
import type { CrawlerDb, RecordInput, Target, UrlState } from "./db";
import { extractPage } from "./extract";
import { failureCategory, fetchLimited, type Fetcher } from "./fetch";
import { sitemapUrls } from "./sitemap";
import { playwrightRenderer, type Renderer } from "./render";
import { extractStructure } from "./structure";

type Job = { target: Target; url: string; phase: "sitemap" | "page"; state?: UrlState };
export type CrawlOptions = {
  db: CrawlerDb; trigger: "schedule" | "manual" | "local"; contactUrl?: string;
  // Test seams; production uses real network, robots.txt and delays.
  fetcher?: Fetcher; respectRobots?: boolean; delaySecs?: number; log?: (line: string) => void;
  // L6: how to start the browser (tests pass a fake; production uses Playwright).
  startRenderer?: () => Promise<Renderer>;
};

/**
 * One crawl run: registered sitemap targets are expanded first (URLs filtered
 * by origin + prefix), then every page is fetched politely and recorded.
 * Failures are recorded per URL; the run ends "partial" if any URL failed.
 */
export async function runCrawl(opts: CrawlOptions) {
  const log = opts.log ?? ((line) => console.log(line));
  const ua = userAgent(opts.contactUrl);
  const runId = await opts.db.startRun(opts.trigger);
  let failures = 0;
  // One browser per run, started only when a page needs it, always closed.
  const session: { renderer: Promise<Renderer> | null } = { renderer: null };
  const browser = () => (session.renderer ??= (opts.startRenderer ?? (() => playwrightRenderer(ua)))());
  const closeBrowser = async () => {
    const started = session.renderer; session.renderer = null;
    // A browser that failed to start was already reported by the page that needed it.
    if (started) await (await started.catch(() => null))?.close().catch((e: unknown) =>
      log(JSON.stringify({ source: "crawler", operation: "browser_close", status: "failed", message: e instanceof Error ? e.message.slice(0, 200) : "unknown" })));
  };
  const record = async (input: Omit<RecordInput, "runId">) => {
    const result = await opts.db.record({ runId, ...input });
    // robots.txt refusals are expected behaviour, not failures.
    if (["error", "too_large", "skipped_type"].includes(result.outcome)) failures += 1;
    log(JSON.stringify({ source: "crawler", operation: "record", url: input.url, outcome: result.outcome, status: input.httpStatus, flagged: result.flagged_facts }));
    return result;
  };
  try {
    const targets = await opts.db.dueTargets();
    const states = new Map<string, UrlState>();
    for (const sourceId of new Set(targets.map((t) => t.source_id))) for (const s of await opts.db.urlStates(sourceId)) states.set(s.url, s);
    const pages: Job[] = targets.filter((t) => t.kind === "page").map((t) => ({ target: t, url: t.url, phase: "page", state: states.get(t.url) }));
    const sitemaps: Job[] = targets.filter((t) => t.kind === "sitemap").map((t) => ({ target: t, url: t.url, phase: "sitemap" }));
    await crawlJobs(sitemaps, opts, async (job) => {
      const started = Date.now();
      const res = await fetchLimited(job.url, { userAgent: ua, accept: SITEMAP_TYPES, fetcher: opts.fetcher });
      if (res.kind === "http_error" && res.retryable) throw new Error(`http_${res.status}`);
      if (res.kind !== "ok") {
        const outcome = res.kind === "skipped_type" || res.kind === "too_large" ? res.kind : "error";
        return record({ targetId: job.target.target_id, url: job.url, httpStatus: res.status, outcome, errorCategory: `sitemap_${res.kind}`, durationMs: Date.now() - started });
      }
      const { urls, index } = sitemapUrls(res.body, job.target.source_url, job.target.path_prefix, job.target.max_urls);
      if (index) log(JSON.stringify({ source: "crawler", operation: "sitemap", url: job.url, note: "sitemap index not followed" }));
      for (const url of urls) pages.push({ target: job.target, url, phase: "page", state: states.get(url) });
    }, record, log);
    await crawlJobs(pages, opts, async (job) => {
      const started = Date.now();
      // The plain GET always runs first: robots.txt (crawlee), origin, type and
      // size checks. Browser pages skip "not modified": a page may keep its HTML
      // shell and load new data with JavaScript, which a 304 would hide.
      const render = job.target.render_js;
      const res = await fetchLimited(job.url, { userAgent: ua, accept: PAGE_TYPES, fetcher: opts.fetcher,
        etag: render ? null : job.state?.etag, lastModified: render ? null : job.state?.last_modified });
      const base = { targetId: job.target.target_id, url: job.url, httpStatus: res.status, durationMs: Date.now() - started };
      if (res.kind === "http_error" && res.retryable) throw new Error(`http_${res.status}`);
      if (res.kind === "not_modified") return record({ ...base, outcome: "not_modified", etag: res.etag, lastModified: res.lastModified });
      if (res.kind === "skipped_type" || res.kind === "too_large") return record({ ...base, outcome: res.kind });
      if (res.kind !== "ok") return record({ ...base, outcome: "error", errorCategory: res.kind === "http_error" ? `http_${res.status}` : res.kind });
      let html = res.body;
      if (render) {
        const rendered = await (await browser()).render(job.url);
        // Never fall back to the static text silently: the URL is recorded as failed.
        if (rendered.kind === "too_large") return record({ ...base, outcome: "too_large", errorCategory: "rendered_too_large" });
        if (rendered.kind !== "ok") return record({ ...base, outcome: "error", errorCategory: rendered.kind });
        html = rendered.html;
      }
      const page = extractPage(html, job.target.content_selector);
      if (!page.text) return record({ ...base, outcome: "error", errorCategory: "empty_text" });
      const retrievedAt = new Date();
      const result = await record({
        ...base, outcome: "fetched", title: page.title, text: page.text, contentHash: textHash(page.text),
        metadataHash: metadataHash({ title: page.title, documentType: "webpage", excerpt: null, publishedAt: null, sourceUpdatedAt: null }),
        etag: res.etag, lastModified: res.lastModified, retrievedAt,
      });
      // PR 1: the structured snapshot of the same HTML, next to the text. A
      // failure here never undoes the stored text: it is logged and the run ends
      // "partial" (AGENTS.md §13).
      if (result.document_id && (result.outcome === "created" || result.outcome === "unchanged")) {
        try {
          const saved = await opts.db.recordStructure(runId, result.document_id, extractStructure(html, job.target.content_selector, job.url), retrievedAt);
          log(JSON.stringify({ source: "crawler", operation: "structure", url: job.url, outcome: saved }));
        } catch (error) {
          failures += 1;
          log(JSON.stringify({ source: "crawler", operation: "structure", url: job.url, status: "failed", category: "structure_failed",
            message: error instanceof Error ? error.message.slice(0, 200) : "unknown" }));
        }
      }
      return result;
    }, record, log);
    await closeBrowser();
    const counts = await opts.db.finishRun(runId, failures ? "partial" : "succeeded", failures ? `${failures} URL(s) failed` : null);
    log(JSON.stringify({ source: "crawler", operation: "finish", runId, counts }));
    return { runId, counts };
  } catch (error) {
    await closeBrowser();
    // Never swallow: close the run as failed, then surface the error.
    await opts.db.finishRun(runId, "failed", error instanceof Error ? error.message.slice(0, 500) : "unknown").catch(() => {});
    throw error;
  }
}

async function crawlJobs(jobs: Job[], opts: CrawlOptions, handle: (job: Job) => Promise<unknown>,
  record: (input: Omit<RecordInput, "runId">) => Promise<unknown>, log: (line: string) => void) {
  if (!jobs.length) return;
  const byKey = new Map(jobs.map((j) => [`${j.phase}:${j.target.target_id}:${j.url}`, j]));
  // In-memory only: incremental state lives in the database, not on the runner.
  const config = new Configuration({ persistStorage: false, purgeOnStart: true });
  const crawler = new BasicCrawler({
    maxConcurrency: 1,
    sameDomainDelaySecs: opts.delaySecs ?? LIMITS.sameDomainDelaySecs,
    maxRequestRetries: LIMITS.maxRetries,
    requestHandlerTimeoutSecs: 90,
    respectRobotsTxtFile: opts.respectRobots === false ? false : { userAgent: BOT_NAME },
    onSkippedRequest: async ({ url, reason }) => {
      const job = [...byKey.values()].find((j) => j.url === url);
      if (job && reason === "robotsTxt") await record({ targetId: job.target.target_id, url, httpStatus: null, outcome: "robots_disallowed", durationMs: 0 });
    },
    requestHandler: async ({ request }) => { await handle(byKey.get(request.uniqueKey)!); },
    failedRequestHandler: async ({ request }, error) => {
      const job = byKey.get(request.uniqueKey)!;
      const category = failureCategory(error);
      log(JSON.stringify({ source: "crawler", operation: "fetch", url: job.url, status: "failed", category }));
      await record({ targetId: job.target.target_id, url: job.url, httpStatus: null, outcome: "error", errorCategory: category, durationMs: 0 });
    },
  }, config);
  await crawler.run([...byKey.entries()].map(([uniqueKey, j]) => ({ url: j.url, uniqueKey })));
}
