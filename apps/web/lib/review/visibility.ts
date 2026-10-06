import { defaultLocale, type Locale } from "@/lib/i18n/locales";
// Why a reviewed record is (or will be) hidden from the public.
//
// The database is the source of truth: public visibility is decided by the RLS
// policies `facts_public`, `immigration_rules_public`, `occupations_public`,
// `universities_public` and `programmes_public`. Workspace pages check the real
// answer with the anonymous client (lib/review/public-check.ts). The functions
// here only EXPLAIN a "hidden" answer in plain words, so a reviewer knows what
// to do next (usually: verify the source in the Source Registry).
//
// They mirror the policies as of migration 20260925090000_labour_market. If a
// policy changes, update the matching function and its test. A mismatch can
// only produce a vaguer explanation ("unknownReason"), never a wrong
// "public" badge, because that badge comes from the database.

export type Blocker =
  | "source_unverified"
  | "rule_not_reviewed"
  | "rule_source_unverified"
  | "rule_source_not_t1"
  | "occupation_not_reviewed"
  | "university_not_reviewed";

export const blockerLabels: Record<Blocker, string> = {
  source_unverified: "Nguồn của bằng chứng chưa được xác minh trong Source Registry.",
  rule_not_reviewed: "Quy định nhập cư được gắn với thông tin này chưa được duyệt.",
  rule_source_unverified: "Nguồn của quy định nhập cư chưa được xác minh trong Source Registry.",
  rule_source_not_t1: "Nguồn của quy định nhập cư không thuộc T1 (cơ quan nhà nước).",
  occupation_not_reviewed: "Nghề được gắn với số liệu này chưa được duyệt.",
  university_not_reviewed: "Trường của chương trình này chưa được duyệt.",
};

const blockerLabelsEn: Record<Blocker, string> = {
  source_unverified: "The evidence's source has not been verified under Manage sources.",
  rule_not_reviewed: "The immigration rule linked to this fact has not been reviewed.",
  rule_source_unverified: "The immigration rule's source has not been verified under Manage sources.",
  rule_source_not_t1: "The immigration rule's source is not T1 (a government authority).",
  occupation_not_reviewed: "The occupation linked to this figure has not been reviewed.",
  university_not_reviewed: "This programme's university has not been reviewed.",
};
export const blockerLabel = (blocker: Blocker, locale: Locale = defaultLocale) => (locale === "en" ? blockerLabelsEn : blockerLabels)[blocker];

/** Blockers that an operator fixes in the Source Registry, not by reviewing. */
export function needsSourceVerification(blockers: readonly Blocker[]) {
  return blockers.some((b) => b === "source_unverified" || b === "rule_source_unverified" || b === "rule_source_not_t1");
}

type Source = { status: string; source_tier: string | null };

/**
 * facts_public: a plain fact needs only reviewed/conflicted status. A fact
 * linked to an immigration rule also needs that rule reviewed with a verified
 * T1 source, AND its own evidence source verified. A fact linked to an
 * occupation needs the occupation reviewed AND its own source verified.
 */
export function factBlockers(fact: {
  source: Source;
  rule?: { status: string; source: Source } | null;
  occupation?: { status: string } | null;
}): Blocker[] {
  const out: Blocker[] = [];
  const linked = !!fact.rule || !!fact.occupation;
  if (fact.rule) {
    if (fact.rule.status !== "reviewed") out.push("rule_not_reviewed");
    if (fact.rule.source.status !== "verified") out.push("rule_source_unverified");
    if (fact.rule.source.source_tier !== "T1") out.push("rule_source_not_t1");
  }
  if (fact.occupation && fact.occupation.status !== "reviewed") out.push("occupation_not_reviewed");
  if (linked && fact.source.status !== "verified") out.push("source_unverified");
  return out;
}

/** immigration_rules_public: reviewed AND evidence source verified AND T1. */
export function ruleBlockers(rule: { source: Source }): Blocker[] {
  const out: Blocker[] = [];
  if (rule.source.status !== "verified") out.push("rule_source_unverified");
  if (rule.source.source_tier !== "T1") out.push("rule_source_not_t1");
  return out;
}

/** programmes_public: reviewed AND its university reviewed. Universities and occupations need only their own review. */
export function programmeBlockers(programme: { universityStatus: string | null | undefined }): Blocker[] {
  return programme.universityStatus === "reviewed" ? [] : ["university_not_reviewed"];
}

export type Visibility =
  | { state: "public" }
  | { state: "hidden"; blockers: Blocker[] }
  | { state: "will_be_public" }
  | { state: "will_stay_hidden"; blockers: Blocker[] }
  | { state: "unknown" };

/**
 * Combine the database answer (`publicIds`, null when the check failed) with
 * the explanation.
 * - Proposals are never public; the blockers PREVIEW what would still hide
 *   them after review, so the reviewer learns it before deciding.
 * - Reviewed/conflicted records: public only if the anonymous client can read
 *   them. A failed check is "unknown", never assumed public (AGENTS.md 13).
 * - Rejected records return null: nothing to explain.
 */
export function visibilityOf(id: string, status: string, publicIds: ReadonlySet<string> | null, blockers: Blocker[]): Visibility | null {
  if (status === "proposed") return blockers.length ? { state: "will_stay_hidden", blockers } : { state: "will_be_public" };
  if (status !== "reviewed" && status !== "conflicted") return null;
  if (!publicIds) return { state: "unknown" };
  return publicIds.has(id) ? { state: "public" } : { state: "hidden", blockers };
}
