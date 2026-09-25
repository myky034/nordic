import { runCrawl } from "./crawl";
import { pgCrawlerDb } from "./db";
import { extractPage } from "./extract";
import { fetchLimited } from "./fetch";
import { BOT_NAME, PAGE_TYPES, userAgent } from "./config";
import { RobotsTxtFile } from "@crawlee/utils";
import { textHash } from "@nordic/db/document-hash";

// Entry point.
//   npm run crawl -w @nordic/crawler              → full run against the database
//   npm run probe -w @nordic/crawler -- <url> [selector]
//                                                 → fetch ONE url and print what would be
//                                                   stored (no database; for choosing selectors)
const args = process.argv.slice(2);
const contactUrl = process.env.CRAWLER_CONTACT_URL || process.env.NEXT_PUBLIC_APP_URL;

async function probe(url: string, selector?: string) {
  // Same robots.txt rule as a real run: never fetch a disallowed page, even once.
  const robots = await RobotsTxtFile.find(url);
  if (!robots.isAllowed(url, BOT_NAME)) { console.log(JSON.stringify({ url, outcome: "robots_disallowed" })); return; }
  const res = await fetchLimited(url, { userAgent: userAgent(contactUrl), accept: PAGE_TYPES });
  if (res.kind !== "ok") { console.log(JSON.stringify(res)); return; }
  const page = extractPage(res.body, selector);
  console.log(JSON.stringify({ status: res.status, title: page.title, chars: page.text.length, hash: textHash(page.text), etag: res.etag, lastModified: res.lastModified }, null, 2));
  console.log("--- first 800 characters of extracted text ---\n" + page.text.slice(0, 800));
}

async function main() {
  if (args[0] === "--probe") {
    if (!args[1]) throw new Error("usage: npm run probe -w @nordic/crawler -- <url> [css-selector]");
    return probe(args[1], args[2]);
  }
  const url = process.env.CRAWLER_DATABASE_URL;
  if (!url) throw new Error("CRAWLER_DATABASE_URL is not set (see docs/architecture/slice-09-crawler.md).");
  const trigger = (process.env.CRAWLER_TRIGGER as "schedule" | "manual" | "local") || "local";
  const db = pgCrawlerDb(url);
  try { await runCrawl({ db, trigger, contactUrl }); } finally { await db.close(); }
}

main().catch((error) => {
  // Log category and message only — never the connection string.
  console.error(JSON.stringify({ source: "crawler", operation: "main", status: "failed", message: error instanceof Error ? error.message : "unknown" }));
  process.exit(1);
});
