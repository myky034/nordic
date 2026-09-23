import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { FactCard, type FactRow } from "@/lib/facts/view";
import { tierLabel } from "@/lib/registry/domain";
import { ruleTypeLabel } from "@/lib/immigration/domain";
import { ConflictBanner, day, LegalDisclaimer, ruleDetailSelect, ruleFactSelect, type RuleDetailRow } from "@/lib/immigration/view";
import { BackLink, Card, DescriptionList, EmptyState, ExternalLink, PageHeader, Quote, Section } from "@/components/ui";

export default async function ImmigrationRulePage({ params }: PageProps<"/immigration/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const client = await createClient();
  const [ruleResult, factsResult] = await Promise.all([
    client.from("immigration_rules").select(ruleDetailSelect).eq("id", id).eq("status", "reviewed")
      .eq("documents.sources.status", "verified").eq("documents.sources.source_tier", "T1").maybeSingle(),
    // Requirements are facts (Option A). Same public conditions as the
    // facts_public RLS policy: reviewed/conflicted and a verified source.
    client.from("facts").select(ruleFactSelect).eq("immigration_rule_id", id).in("status", ["reviewed", "conflicted"])
      .eq("documents.sources.status", "verified")
      .order("topic", { ascending: true }).order("created_at", { ascending: false }).limit(100),
  ]);
  if (ruleResult.error || factsResult.error) { logAccessError("public_immigration_rule"); throw new Error("Không tải được quy định nhập cư."); }
  if (!ruleResult.data) notFound();
  const rule = ruleResult.data as unknown as RuleDetailRow;
  const facts = factsResult.data as unknown as FactRow[];
  const source = rule.documents.sources;
  return <>
    <PageHeader back={<BackLink href="/immigration">All immigration rules</BackLink>}
      eyebrow={<>{ruleTypeLabel(rule.rule_type)} · <Link href={`/countries/${rule.countries.slug}`} className="hover:underline">{rule.countries.name}</Link></>}
      title={rule.title} />
    <div className="-mt-4 space-y-4">
      <LegalDisclaimer />
      {facts.some((f) => f.status === "conflicted") && <ConflictBanner />}
    </div>
    <div className="mt-8">
      <DescriptionList items={[
        ["Official page", <ExternalLink key="o" href={rule.official_url}>{rule.official_url}</ExternalLink>],
        ["Source", `${source.name} · ${tierLabel(source.source_tier)}`],
        ["Source last verified", `Source last verified: ${day(source.last_verified_at)}`],
        ["Evidence retrieved", day(rule.documents.retrieved_at)],
        ["Evidence reviewed", day(rule.reviewed_at)],
      ]} />
    </div>
    <Section title="Requirements">
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState>No reviewed requirements with a verified source for this rule yet. Read the official page above; nothing is summarised or inferred here.</EmptyState>}
    </Section>
    <Section title="Why this rule is listed">
      <Card className="space-y-3">
        <Quote>{rule.evidence_excerpt}</Quote>
        <p className="text-[13px] text-ink-3"><ExternalLink href={rule.documents.canonical_url}>Open original source</ExternalLink></p>
      </Card>
    </Section>
  </>;
}
