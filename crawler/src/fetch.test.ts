import { expect, it } from "vitest";
import { fetchLimited, type Fetcher } from "./fetch";

const html = { "content-type": "text/html; charset=utf-8" };
const reply = (body: BodyInit | null, init: ResponseInit & { url?: string }): Fetcher => (async (_input: RequestInfo | URL, req?: RequestInit) => {
  seen.push(req?.headers as Record<string, string>);
  const res = new Response(body, init);
  if (init.url) Object.defineProperty(res, "url", { value: init.url });
  return res;
}) as Fetcher;
const seen: Record<string, string>[] = [];
const base = { userAgent: "NordicResearchBot/0.1 (+x)", accept: ["text/html"] };
const url = "https://agency.example.test/p";

it("sends an honest user agent and conditional headers", async () => {
  await fetchLimited(url, { ...base, etag: '"v1"', lastModified: "Mon, 01 Jan 2026 00:00:00 GMT", fetcher: reply(null, { status: 304 }) });
  expect(seen.at(-1)).toMatchObject({ "user-agent": "NordicResearchBot/0.1 (+x)", "if-none-match": '"v1"', "if-modified-since": "Mon, 01 Jan 2026 00:00:00 GMT" });
});
it("maps 304, wrong types, off-origin redirects and HTTP errors", async () => {
  expect((await fetchLimited(url, { ...base, fetcher: reply(null, { status: 304, headers: { etag: '"v2"' } }) })).kind).toBe("not_modified");
  expect((await fetchLimited(url, { ...base, fetcher: reply("%PDF", { status: 200, headers: { "content-type": "application/pdf" } }) })).kind).toBe("skipped_type");
  expect((await fetchLimited(url, { ...base, fetcher: reply("<p>x</p>", { status: 200, headers: html, url: "https://other.example.test/p" }) })).kind).toBe("off_origin");
  expect(await fetchLimited(url, { ...base, fetcher: reply("", { status: 503 }) })).toEqual({ kind: "http_error", status: 503, retryable: true });
  expect(await fetchLimited(url, { ...base, fetcher: reply("", { status: 404 }) })).toEqual({ kind: "http_error", status: 404, retryable: false });
});
it("stops reading at the byte limit even without a content-length header", async () => {
  const big = new ReadableStream({ start(c) { for (let i = 0; i < 3; i++) c.enqueue(new Uint8Array(1024 * 1024)); c.close(); } });
  expect((await fetchLimited(url, { ...base, fetcher: reply(big, { status: 200, headers: html }) })).kind).toBe("too_large");
  expect((await fetchLimited(url, { ...base, fetcher: reply("x", { status: 200, headers: { ...html, "content-length": String(10 * 1024 * 1024) } }) })).kind).toBe("too_large");
});
it("returns the body and validators for a normal page", async () => {
  const res = await fetchLimited(url, { ...base, fetcher: reply("<p>ok</p>", { status: 200, headers: { ...html, etag: '"v3"' } }) });
  expect(res).toMatchObject({ kind: "ok", body: "<p>ok</p>", etag: '"v3"' });
});
