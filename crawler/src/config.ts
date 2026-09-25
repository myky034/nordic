// Crawler limits and identity. Conservative by design (PROJECT_SPEC.md §8,
// AGENTS.md §6): one request at a time per domain, a pause between requests,
// bounded retries, size and type limits, and an honest User-Agent.
export const BOT_NAME = "NordicResearchBot";
export const LIMITS = {
  maxBytes: 2 * 1024 * 1024,
  maxTextChars: 200_000,
  timeoutMs: 30_000,
  sameDomainDelaySecs: 5,
  maxRetries: 2,
} as const;
export const PAGE_TYPES = ["text/html", "application/xhtml+xml"];
export const SITEMAP_TYPES = ["application/xml", "text/xml"];

/** Identifies the bot and how to reach the operator; never a browser disguise. */
export function userAgent(contactUrl?: string) {
  return `${BOT_NAME}/0.1 (+${contactUrl || "https://github.com/myky034/nordic"}; research indexing; low rate)`;
}
