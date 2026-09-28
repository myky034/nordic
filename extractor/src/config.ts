// Extraction limits and fixed vocabularies (Slice 10a decisions, PROJECT_SPEC.md §21).
// The database re-enforces every limit that matters (extractor_* functions);
// these values keep cost and rate-limit usage low on a free tier.
export const PROMPT_VERSION = "extract-v1";
export const LIMITS = {
  defaultDocuments: 5,
  maxDocuments: 10, // same cap as extractor_claim()
  maxChars: 50_000,
  maxCandidates: 30, // same cap as extractor_propose()
  timeoutMs: 120_000,
  maxRetries: 3,
  delayBetweenDocumentsMs: 5_000, // spreads requests under a free-tier RPM limit
} as const;
// Must match public.extraction_topics() in the migration.
export const TOPICS = ["education", "admission", "tuition", "deadline", "scholarship", "immigration",
  "labour_market", "living_cost", "housing", "language", "other"] as const;
