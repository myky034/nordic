import { LIMITS } from "./config";
import { sameOrigin } from "./urls";

export type FetchResult =
  | { kind: "ok"; status: number; body: string; etag: string | null; lastModified: string | null }
  | { kind: "not_modified"; status: 304; etag: string | null; lastModified: string | null }
  | { kind: "skipped_type" | "too_large"; status: number }
  | { kind: "http_error"; status: number; retryable: boolean }
  | { kind: "off_origin"; status: number };

export type Fetcher = typeof fetch;

/**
 * One bounded GET. Conditional headers make unchanged pages cheap; redirects
 * leaving the registered origin are refused; bodies are streamed with a hard
 * byte cap; only the expected content types are read.
 */
export async function fetchLimited(url: string, opts: {
  userAgent: string; accept: string[]; etag?: string | null; lastModified?: string | null; fetcher?: Fetcher;
}): Promise<FetchResult> {
  const headers: Record<string, string> = { "user-agent": opts.userAgent, accept: opts.accept.join(", ") };
  if (opts.etag) headers["if-none-match"] = opts.etag;
  if (opts.lastModified) headers["if-modified-since"] = opts.lastModified;
  const res = await (opts.fetcher ?? fetch)(url, { headers, redirect: "follow", signal: AbortSignal.timeout(LIMITS.timeoutMs) });
  const etag = res.headers.get("etag"), lastModified = res.headers.get("last-modified");
  if (res.url && !sameOrigin(res.url, url)) { await res.body?.cancel(); return { kind: "off_origin", status: res.status }; }
  if (res.status === 304) return { kind: "not_modified", status: 304, etag, lastModified };
  if (!res.ok) {
    await res.body?.cancel();
    return { kind: "http_error", status: res.status, retryable: res.status === 429 || res.status >= 500 };
  }
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!opts.accept.includes(type)) { await res.body?.cancel(); return { kind: "skipped_type", status: res.status }; }
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > LIMITS.maxBytes) { await res.body?.cancel(); return { kind: "too_large", status: res.status }; }
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > LIMITS.maxBytes) { await reader.cancel(); return { kind: "too_large", status: res.status }; }
      chunks.push(value);
    }
  }
  return { kind: "ok", status: res.status, body: Buffer.concat(chunks).toString("utf8"), etag, lastModified };
}
