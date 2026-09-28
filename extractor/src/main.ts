import { readFileSync } from "node:fs";
import { LIMITS } from "./config";
import { pgExtractorDb } from "./db";
import { openAiCompatible } from "./llm";
import { buildMessages, candidateSchema, truncateText } from "./prompt";
import { runExtraction } from "./run";
import { parseCandidates, precheck } from "./validate";

// Entry point.
//   npm run extract -w @nordic/extractor                       → process pending requests
//   npm run dry-run -w @nordic/extractor -- <text-file> [url]  → call the model on a local
//       text file and print candidates with local checks (no database writes)
const args = process.argv.slice(2);

function llmFromEnv() {
  const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;
  if (!LLM_BASE_URL || !LLM_API_KEY || !LLM_MODEL) throw new Error("LLM_BASE_URL, LLM_API_KEY and LLM_MODEL must be set (see extractor/README.md).");
  return openAiCompatible({ baseUrl: LLM_BASE_URL, apiKey: LLM_API_KEY, model: LLM_MODEL });
}

// Slugs used only by --dry-run, which has no database; the real run reads them
// from extractor_countries(). Keep in sync with the countries seed.
const DRY_RUN_COUNTRIES = [
  { slug: "sweden", name: "Sweden" }, { slug: "denmark", name: "Denmark" }, { slug: "finland", name: "Finland" },
  { slug: "norway", name: "Norway" }, { slug: "netherlands", name: "Netherlands" },
];

async function dryRun(file: string, url = "file://local") {
  const llm = llmFromEnv();
  const { text, truncated } = truncateText(readFileSync(file, "utf8"));
  const doc = { title: null, url, source_name: "dry run", source_tier: null, text };
  const completion = await llm.complete(buildMessages(doc, DRY_RUN_COUNTRIES), candidateSchema);
  const { candidates } = parseCandidates(completion.content);
  const slugs = DRY_RUN_COUNTRIES.map((c) => c.slug);
  for (const c of candidates) console.log(JSON.stringify({ check: precheck(c, text, slugs) ?? "ok", ...c }));
  console.log(JSON.stringify({ candidates: candidates.length, truncated, tokens: { input: completion.inputTokens, output: completion.outputTokens } }));
}

async function main() {
  if (args[0] === "--dry-run") {
    if (!args[1]) throw new Error("usage: npm run dry-run -w @nordic/extractor -- <text-file> [url]");
    return dryRun(args[1], args[2]);
  }
  const url = process.env.EXTRACTOR_DATABASE_URL;
  if (!url) throw new Error("EXTRACTOR_DATABASE_URL is not set (see docs/architecture/slice-10a-ai-extraction.md).");
  const trigger = (process.env.EXTRACTOR_TRIGGER as "schedule" | "manual" | "local") || "local";
  const maxDocuments = Number(process.env.EXTRACTOR_MAX_DOCUMENTS) || LIMITS.defaultDocuments;
  // Without the Supabase CA the connection is either unencrypted or fails
  // verification; say so instead of failing silently later.
  if (!process.env.DATABASE_CA_CERT) console.warn(JSON.stringify({ source: "extractor", operation: "connect", status: "warning", message: "DATABASE_CA_CERT not set: database TLS certificate is not verified against the Supabase CA" }));
  const db = pgExtractorDb(url, process.env.DATABASE_CA_CERT);
  try { await runExtraction({ db, llm: llmFromEnv(), trigger, maxDocuments }); } finally { await db.close(); }
}

main().catch((error) => {
  // Message only — never the connection string, API key or page text.
  console.error(JSON.stringify({ source: "extractor", operation: "main", status: "failed", message: error instanceof Error ? error.message : "unknown" }));
  process.exit(1);
});
