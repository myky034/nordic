// PR 1 real-world acceptance (docs/architecture/pr1-structured-content-plan.md §6):
// saves the RENDERED HTML of one official page to test/real/snapshots/, which
// git ignores: the repository is public and must not mirror third-party pages
// (AGENTS.md §8). Use only for URLs the project owner provided or registered.
//
//   npm run snapshot -w @nordic/crawler -- <id> <url>
//
// robots.txt is checked first with the crawler's own user agent; the page is
// read with the same headless browser as the crawler (src/render.ts).
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { RobotsTxtFile } from "@crawlee/utils";
import { BOT_NAME, userAgent } from "../src/config";
import { playwrightRenderer } from "../src/render";
import { canonical } from "../src/urls";

const [id, rawUrl] = process.argv.slice(2);
const url = rawUrl ? canonical(rawUrl) : null;
if (!id || !/^[a-z0-9-]{3,60}$/.test(id) || !url) {
  console.error("usage: npm run snapshot -w @nordic/crawler -- <id: a-z0-9-> <https url>");
  process.exit(2);
}
const robots = await RobotsTxtFile.find(url);
if (!robots.isAllowed(url, BOT_NAME)) { console.error(`robots.txt disallows ${url} for ${BOT_NAME}; nothing saved.`); process.exit(1); }
const renderer = await playwrightRenderer(userAgent(process.env.CRAWLER_CONTACT_URL));
try {
  const result = await renderer.render(url);
  if (result.kind !== "ok") { console.error(`render failed: ${result.kind}`); process.exit(1); }
  const dir = new URL("../test/real/snapshots/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  const sha256 = createHash("sha256").update(result.html, "utf8").digest("hex");
  writeFileSync(new URL(`${id}.html`, dir), result.html);
  writeFileSync(new URL(`${id}.json`, dir), JSON.stringify({ id, url, capturedAt: new Date().toISOString(), sha256, bytes: Buffer.byteLength(result.html) }, null, 2));
  console.log(JSON.stringify({ saved: id, url, sha256 }));
} finally { await renderer.close(); }
