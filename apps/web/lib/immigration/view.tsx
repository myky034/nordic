import { factSelect } from "../facts/view";
import { Notice } from "@/components/ui";

// Public selects. The !inner embeds let the page filter on the evidence
// source's status/tier, mirroring the RLS rule explicitly so editors (who can
// see drafts through RLS) still get exactly the public view.
export const ruleListSelect =
  "id,rule_type,title,official_url,reviewed_at,countries!inner(slug,name),documents!immigration_rules_document_id_fkey!inner(sources!inner(name,source_tier,status,last_verified_at))";
export const ruleDetailSelect =
  "id,rule_type,title,official_url,evidence_excerpt,reviewed_at,countries(slug,name),documents!immigration_rules_document_id_fkey!inner(canonical_url,retrieved_at,title,sources!inner(name,source_tier,status,last_verified_at))";
// Same shape as factSelect, but the source embed is inner-joined so the page can
// require a verified source for each requirement fact.
export const ruleFactSelect = factSelect.replace(
  "documents!facts_document_id_fkey(title,sources(name,source_tier))",
  "documents!facts_document_id_fkey!inner(title,sources!inner(name,source_tier,status))",
);
export const authoritySelect = "id,name,canonical_url,status,last_verified_at,countries!inner(slug,name)";

type RuleSource = { name: string; source_tier: string | null; status: string; last_verified_at: string | null };
export type RuleListRow = {
  id: string; rule_type: string; title: string; official_url: string; reviewed_at: string | null;
  countries: { slug: string; name: string }; documents: { sources: RuleSource };
};
export type RuleDetailRow = Omit<RuleListRow, "documents"> & {
  evidence_excerpt: string;
  documents: { canonical_url: string; retrieved_at: string; title: string | null; sources: RuleSource };
};
export type AuthorityRow = { id: string; name: string; canonical_url: string; status: string; last_verified_at: string | null; countries: { slug: string; name: string } };

export const day = (value: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "not available";

// Recommendation 4 (2026-09-23): always visible on immigration pages.
export function LegalDisclaimer() {
  return <Notice tone="caution" title="Thông tin nghiên cứu, không phải tư vấn di trú.">
    Research information, not immigration or legal advice. Rules change; always confirm on the official authority&apos;s website before applying or making decisions.
  </Notice>;
}

// SRS/UserFlow 2.3: warn instead of silently choosing between sources.
export function ConflictBanner() {
  return <Notice tone="critical" role="alert" title="Thông tin đang có mâu thuẫn giữa các nguồn.">
    Sources currently disagree on at least one requirement below; both claims are shown and neither has been chosen as correct.
  </Notice>;
}
