import pg from "pg";

// The crawler's only database surface: the crawler_* SQL functions. Its role
// has no table privileges, so every rule is enforced (again) in the database.
export type Target = { target_id: string; source_id: string; source_url: string; url: string; kind: "page" | "sitemap";
  path_prefix: string | null; max_urls: number; content_selector: string | null };
export type UrlState = { url: string; etag: string | null; last_modified: string | null; last_hash: string | null };
export type RecordInput = { runId: string; targetId: string; url: string; httpStatus: number | null;
  outcome: "fetched" | "not_modified" | "robots_disallowed" | "skipped_type" | "too_large" | "error"; errorCategory?: string | null;
  durationMs: number; title?: string | null; contentHash?: string | null; metadataHash?: string | null; text?: string | null;
  etag?: string | null; lastModified?: string | null; retrievedAt?: Date | null };
export type CrawlerDb = {
  startRun(trigger: "schedule" | "manual" | "local"): Promise<string>;
  dueTargets(): Promise<Target[]>;
  urlStates(sourceId: string): Promise<UrlState[]>;
  record(input: RecordInput): Promise<{ outcome: string; document_id: string | null; flagged_facts: number }>;
  finishRun(runId: string, status: "succeeded" | "partial" | "failed", note: string | null): Promise<Record<string, number>>;
  close(): Promise<void>;
};

export function pgCrawlerDb(connectionString: string): CrawlerDb {
  // One connection is plenty for a sequential crawler and gentle on the pooler.
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000, statement_timeout: 30_000 });
  const one = async <T>(sql: string, args: unknown[]) => (await pool.query(sql, args)).rows[0] as T;
  return {
    startRun: async (trigger) => (await one<{ id: string }>("SELECT crawler_start_run($1) AS id", [trigger])).id,
    dueTargets: async () => (await pool.query("SELECT * FROM crawler_due_targets()")).rows as Target[],
    urlStates: async (sourceId) => (await pool.query("SELECT * FROM crawler_url_states($1)", [sourceId])).rows as UrlState[],
    record: async (r) => (await one<{ r: { outcome: string; document_id: string | null; flagged_facts: number } }>(
      "SELECT crawler_record($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) AS r",
      [r.runId, r.targetId, r.url, r.httpStatus, r.outcome, r.errorCategory ?? null, r.durationMs, r.title ?? null, r.contentHash ?? null,
        r.metadataHash ?? null, r.text ?? null, r.etag ?? null, r.lastModified ?? null, r.retrievedAt ?? null])).r,
    finishRun: async (runId, status, note) => (await one<{ c: Record<string, number> }>("SELECT crawler_finish_run($1,$2,$3) AS c", [runId, status, note])).c,
    close: () => pool.end(),
  };
}
