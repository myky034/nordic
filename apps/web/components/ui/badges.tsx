import { Badge, type Tone } from "./index";

// Visual tone for status values. Labels come from the domain modules; this file
// only decides colour. "Reviewed" is deliberately accent, not green, so it is
// never read as "verified truth" (AGENTS.md Section 15).
export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <Badge>Unclassified</Badge>;
  return <Badge tone={tier === "T1" ? "accent" : "neutral"}>{tier}</Badge>;
}

const reviewTones: Record<string, Tone> = { proposed: "caution", reviewed: "accent", rejected: "neutral", conflicted: "critical" };
export function ReviewBadge({ status, children }: { status: string; children: React.ReactNode }) {
  return <Badge tone={reviewTones[status] ?? "neutral"}>{children}</Badge>;
}

const sourceTones: Record<string, Tone> = { verified: "positive", needs_verification: "caution", review_required: "critical" };
export function SourceStatusBadge({ status, children }: { status: string; children: React.ReactNode }) {
  return <Badge tone={sourceTones[status] ?? "neutral"}>{children}</Badge>;
}
