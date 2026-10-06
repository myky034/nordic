import { Badge, type Tone } from "./index";
import { isTier, tierShortName, unclassifiedLabel } from "@/lib/registry/domain";
import type { Locale } from "@/lib/i18n/locales";

// Visual tone for status values. Labels come from the domain modules; this file
// only decides colour. "Reviewed" is deliberately accent, not green, so it is
// never read as "verified truth" (AGENTS.md Section 15).
export function TierBadge({ tier, locale }: { tier: string | null | undefined; locale?: Locale }) {
  if (!isTier(tier)) return <Badge>{unclassifiedLabel(locale)}</Badge>;
  // Code + plain word: "T1" alone means nothing to a first-time visitor.
  return <Badge tone={tier === "T1" ? "accent" : "neutral"}>{tier} · {tierShortName(tier, locale)}</Badge>;
}

const reviewTones: Record<string, Tone> = { proposed: "caution", reviewed: "accent", rejected: "neutral", conflicted: "critical" };
export function ReviewBadge({ status, children }: { status: string; children: React.ReactNode }) {
  return <Badge tone={reviewTones[status] ?? "neutral"}>{children}</Badge>;
}

const sourceTones: Record<string, Tone> = { verified: "positive", needs_verification: "caution", review_required: "critical" };
export function SourceStatusBadge({ status, children }: { status: string; children: React.ReactNode }) {
  return <Badge tone={sourceTones[status] ?? "neutral"}>{children}</Badge>;
}
