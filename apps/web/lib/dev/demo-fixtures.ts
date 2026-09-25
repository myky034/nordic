// =============================================================================
// DEMO fixtures for the development-only UI preview (/dev/preview).
//
// Every name is visibly fictional ("DEMO …"), every URL uses the reserved
// `.example.test` domain, and every number is a placeholder. Nothing here is a
// real university, rule, salary or statistic (AGENTS.md Section 1.1), and none
// of it is ever written to a database: it only feeds React components.
// =============================================================================
import type { Source } from "@nordic/db";
import type { FactRow } from "../facts/view";
import type { CompareCountry, CompareValue } from "@/components/compare-table";

export const DEMO = "DEMO";
const url = (path: string) => `https://demo.example.test/${path}`;
const iso = "2026-01-15T00:00:00Z";
// Source name shown for each tier, so a fixture's label always matches its badge.
const sourceByTier = (tier: string | null) => ({ T1: "DEMO Government Agency", T2: "DEMO University Portal", T3: "DEMO Trade Magazine", T4: "DEMO Community Blog" } as Record<string, string>)[tier ?? ""] ?? "DEMO Unclassified Source";

export const demoCountries: CompareCountry[] = [
  { id: "c1", slug: "sweden", name: "Sweden" }, { id: "c2", slug: "denmark", name: "Denmark" }, { id: "c3", slug: "finland", name: "Finland" },
];

const baseSource: Omit<Source, "id" | "name" | "canonicalUrl" | "sourceTier" | "status" | "lastVerifiedAt"> = {
  countryId: null, sourceType: "demo", topics: ["demo"], language: "en", authorityNotes: null, crawlEnabled: false, crawlPolicy: "not_reviewed",
  crawlFrequency: null, lastCrawledAt: null, notes: null, createdAt: new Date(iso), updatedAt: new Date(iso),
};
export const demoSources: (Source & { country: { name: string; slug: string } | null })[] = [
  { ...baseSource, id: "s1", name: "DEMO Government Agency", canonicalUrl: url("agency"), sourceTier: "T1", status: "verified", lastVerifiedAt: new Date(iso), country: { name: "Sweden", slug: "sweden" } },
  { ...baseSource, id: "s2", name: "DEMO University Portal", canonicalUrl: url("portal"), sourceTier: "T2", status: "needs_verification", lastVerifiedAt: null, country: null },
  { ...baseSource, id: "s3", name: "DEMO Community Blog", canonicalUrl: url("blog"), sourceTier: "T4", status: "review_required", lastVerifiedAt: null, country: { name: "Denmark", slug: "denmark" } },
  { ...baseSource, id: "s4", name: "DEMO Unclassified Source", canonicalUrl: url("unknown"), sourceTier: null, status: "needs_verification", lastVerifiedAt: null, country: null },
];

function fact(id: string, over: Partial<FactRow> & { tier?: string | null }): FactRow {
  const { tier = "T1", ...rest } = over;
  return {
    id, document_id: "demo-doc", topic: "demo", subject: "DEMO subject", predicate: "demo attribute", value: "DEMO value", unit: null,
    status: "reviewed", valid_from: null, valid_until: null, reviewed_at: iso,
    evidence: { source_url: url("evidence"), excerpt: "DEMO excerpt — placeholder text standing in for a verbatim quote from a source.", retrieved_at: iso },
    documents: { title: "DEMO document", sources: { name: sourceByTier(tier), source_tier: tier } },
    ...rest,
  };
}

/** One card per visual state the FactCard can take. */
export const demoFacts: { label: string; fact: FactRow }[] = [
  { label: "Reviewed, T1, with validity dates", fact: fact("f1", { subject: "DEMO permit", predicate: "processing time", value: "0", unit: "demo weeks", valid_from: "2026-01-01", valid_until: "2026-12-31" }) },
  { label: "Conflicted (two sources disagree)", fact: fact("f2", { status: "conflicted", subject: "DEMO permit", predicate: "financial requirement", value: "0", unit: "DEMO currency" }) },
  { label: "Proposed (workspace only)", fact: fact("f3", { status: "proposed", reviewed_at: null, subject: "DEMO programme", predicate: "tuition", value: "0", unit: "DEMO currency / year" }) },
  { label: "Rejected (workspace only)", fact: fact("f4", { status: "rejected", reviewed_at: null }) },
  { label: "Deadline, rolling admission", fact: fact("f5", { subject: "DEMO programme", predicate: "application deadline", value: "Rolling — no fixed date stated", deadline_type: "rolling", programme_id: "p1" }) },
  { label: "Immigration requirement from a non-T1 source", fact: fact("f6", { tier: "T4", immigration_rule_id: "r1", subject: "DEMO rule", predicate: "community-reported waiting time", value: "0", unit: "demo weeks" }) },
  { label: "Occupation figure, non-official, with period and metric", fact: fact("f7", { tier: "T4", occupation_id: "o1", reference_period: "2025-Q2", metric_id: "m1", comparison_metrics: { label: "DEMO monthly figure" }, subject: "DEMO occupation", predicate: "median pay", value: "0", unit: "DEMO currency / month" }) },
];

/** 60 rows to exercise pagination (25 per page). */
export const demoProgrammes = Array.from({ length: 60 }, (_, i) => ({
  id: `p${i + 1}`, name: `DEMO Programme ${String(i + 1).padStart(2, "0")}`, degree: i % 3 === 0 ? "Bachelor" : i % 3 === 1 ? "Master" : "PhD",
  university: `DEMO University ${String.fromCharCode(65 + (i % 5))}`, country: demoCountries[i % 3].name,
  field: i % 4 === 0 ? null : "DEMO field", language: i % 5 === 0 ? null : "English",
}));

const value = (id: string, country: string, v: string, period: string | null, status = "reviewed", tier: string | null = "T1"): CompareValue => ({
  id, document_id: "demo-doc", metric_id: "m1", country_id: country, value: v, unit: "DEMO unit", reference_period: period, status, created_at: iso,
  evidence: { retrieved_at: iso }, documents: { sources: { name: sourceByTier(tier), source_tier: tier } },
});
/** Comparison cells: several values, a conflict, a non-official value and an empty cell. */
export const demoCompareRows = [
  { key: "m1", label: "DEMO monthly living cost", unit: "DEMO unit / month", description: "DEMO definition of exactly what is measured.",
    cells: { c1: [value("v1", "c1", "0", "2025-Q2"), value("v2", "c1", "0", "2024", "conflicted")], c2: [value("v3", "c2", "0", "2025")], c3: [] as CompareValue[] } },
  { key: "m2", label: "DEMO tuition (non-EU, Master)", unit: "DEMO unit / year", description: "DEMO definition.",
    cells: { c1: [], c2: [value("v4", "c2", "0", "2026", "reviewed", "T4")], c3: [value("v5", "c3", "0", null, "reviewed", "T2")] } },
];

export const demoSearchGroups = [
  { label: "Countries", total: 1, hits: [{ id: "h1", title: "DEMO country result", subtitle: undefined }] },
  { label: "Programmes", total: 14, hits: Array.from({ length: 5 }, (_, i) => ({ id: `hp${i}`, title: `DEMO Programme match ${i + 1}`, subtitle: "DEMO University A" })) },
  { label: "Facts", total: 2, hits: [{ id: "hf1", title: "DEMO subject — demo attribute", subtitle: "DEMO value" }, { id: "hf2", title: "DEMO subject — other attribute", subtitle: "DEMO value" }] },
];

export const demoEvidenceDocument = { canonical_url: url("evidence"), retrieved_at: iso, title: "DEMO document", sources: { name: "DEMO Government Agency", source_tier: "T1" } };
