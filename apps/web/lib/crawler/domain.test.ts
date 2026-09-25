import { expect, it } from "vitest";
import { crawlerError, crawlReadiness } from "./domain";

it("explains exactly why a source will not be crawled", () => {
  expect(crawlReadiness({ crawl_enabled: true, crawl_policy: "approved", status: "verified" }).ready).toBe(true);
  const r = crawlReadiness({ crawl_enabled: false, crawl_policy: "not_reviewed", status: "needs_verification" });
  expect(r.ready).toBe(false);
  for (const part of ["chưa verified", "chưa approved", "chưa bật crawl"]) expect(r.reason).toContain(part);
});
it("maps only known codes", () => {
  expect(crawlerError("crawler_url_not_source")).toContain("cùng domain");
  expect(crawlerError("postgres://secret")).not.toContain("secret");
});
