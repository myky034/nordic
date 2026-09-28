import pg from "pg";
import type { Candidate } from "./validate";
import type { Country, SourceDocument } from "./prompt";

// The worker's only database surface: the extractor_* SQL functions. Its role
// has no table privileges; every rule is enforced (again) in the database.
export type Claimed = SourceDocument & { request_id: string; document_id: string };
export type ProposeResult = { outcome: "proposed" | "invalid" | "duplicate" | "limit"; reason: string | null; fact_id: string | null };
export type ExtractorDb = {
  startRun(trigger: string, provider: string, model: string, promptVersion: string): Promise<string>;
  countries(): Promise<Country[]>;
  claim(runId: string, limit: number): Promise<Claimed[]>;
  propose(runId: string, requestId: string, candidate: Candidate): Promise<ProposeResult>;
  finishRequest(runId: string, requestId: string, status: "done" | "failed", note: string, inputTokens: number, outputTokens: number, truncated: boolean): Promise<void>;
  finishRun(runId: string, status: "succeeded" | "partial" | "failed", note: string | null): Promise<Record<string, number>>;
  close(): Promise<void>;
};

export function pgExtractorDb(connectionString: string): ExtractorDb {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 15_000, statement_timeout: 30_000 });
  return {
    startRun: async (t, p, m, v) => (await pool.query("SELECT extractor_start_run($1,$2,$3,$4) AS id", [t, p, m, v])).rows[0].id,
    countries: async () => (await pool.query("SELECT * FROM extractor_countries()")).rows,
    claim: async (runId, limit) => (await pool.query("SELECT * FROM extractor_claim($1,$2)", [runId, limit])).rows,
    propose: async (runId, requestId, c) => (await pool.query("SELECT extractor_propose($1,$2,$3) AS r", [runId, requestId, JSON.stringify(c)])).rows[0].r,
    finishRequest: async (runId, requestId, status, note, i, o, truncated) => {
      await pool.query("SELECT extractor_finish_request($1,$2,$3,$4,$5,$6,$7)", [runId, requestId, status, note, i, o, truncated]);
    },
    finishRun: async (runId, status, note) => (await pool.query("SELECT extractor_finish_run($1,$2,$3) AS c", [runId, status, note])).rows[0].c,
    close: () => pool.end(),
  };
}
