import { LIMITS } from "./config";
import { sameOrigin } from "./urls";

// L6 (Decision Log 2026-10-15): pages are read in a real headless browser by
// default, because many pages draw their key content (tuition, dates) with
// JavaScript and the static HTML holds only empty headings. The browser runs
// AFTER the plain GET in crawl.ts, which already checked robots.txt, origin,
// content type, size and "not modified".

export type RenderResult =
  | { kind: "ok"; html: string }
  | { kind: "off_origin" | "too_large" | "render_timeout" | "render_failed" };
export type Renderer = { render(url: string): Promise<RenderResult>; close(): Promise<void> };

// Not needed to read text; skipping them keeps the browser light and polite.
const SKIPPED = new Set(["image", "media", "font"]);

/**
 * Starts one headless Chromium for the whole run. Playwright is imported
 * lazily so runs (and tests) without browser targets never load it.
 */
export async function playwrightRenderer(userAgent: string): Promise<Renderer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  // Honest identity (config.ts userAgent), no stored state between pages.
  const context = await browser.newContext({ userAgent, javaScriptEnabled: true, serviceWorkers: "block" });
  await context.route("**/*", (route) => (SKIPPED.has(route.request().resourceType()) ? route.abort() : route.continue()));
  return {
    async render(url) {
      const page = await context.newPage();
      try {
        // The browser only loads this page and what it needs; it never clicks
        // or follows links. "networkidle" waits for the page's own data calls.
        await page.goto(url, { waitUntil: "networkidle", timeout: LIMITS.renderTimeoutMs });
        if (!sameOrigin(page.url(), url)) return { kind: "off_origin" };
        const html = await page.content();
        if (Buffer.byteLength(html, "utf8") > LIMITS.maxRenderedBytes) return { kind: "too_large" };
        return { kind: "ok", html };
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        return { kind: name === "TimeoutError" ? "render_timeout" : "render_failed" };
      } finally {
        await page.close().catch(() => {});
      }
    },
    close: () => browser.close(),
  };
}
