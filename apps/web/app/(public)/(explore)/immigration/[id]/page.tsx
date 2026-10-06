import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { FactCard, type FactRow } from "@/lib/facts/view";
import { countryName, tierLabel } from "@/lib/registry/domain";
import { ruleTypeLabel } from "@/lib/immigration/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { ConflictBanner, day, LegalDisclaimer, ruleDetailSelect, ruleFactSelect, type RuleDetailRow } from "@/lib/immigration/view";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
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
  const save = await savedState("immigration_rule", rule.id);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.immigration, dict.common];
  return <>
    <PageHeader back={<BackLink href="/immigration">{t.back}</BackLink>} actions={<SaveButton kind="immigration_rule" id={rule.id} signedIn={save.signedIn} initialSaved={save.saved} locale={locale} />}
      eyebrow={<>{ruleTypeLabel(rule.rule_type, locale)} · <Link href={`/countries/${rule.countries.slug}`} className="hover:underline">{countryName(rule.countries.slug, rule.countries.name, locale)}</Link></>}
      title={rule.title} />
    <div className="-mt-4 space-y-4">
      <LegalDisclaimer locale={locale} />
      {facts.some((f) => f.status === "conflicted") && <ConflictBanner locale={locale} />}
    </div>
    <div className="mt-8">
      <DescriptionList items={[
        [t.officialPage, <ExternalLink key="o" href={rule.official_url}>{rule.official_url}</ExternalLink>],
        [t.source, `${source.name} · ${tierLabel(source.source_tier, locale)}`],
        [t.sourceLastVerified, day(source.last_verified_at, locale)],
        [t.evidenceRetrieved, day(rule.documents.retrieved_at, locale)],
        [t.evidenceReviewed, day(rule.reviewed_at, locale)],
      ]} />
    </div>
    <Section title={t.requirements}>
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} internal={internal} locale={locale} />)}</div>
        : <EmptyState>{t.noRequirements}</EmptyState>}
    </Section>
    <Section title={t.why}>
      <Card className="space-y-3">
        <Quote>{rule.evidence_excerpt}</Quote>
        <p className="text-[13px] text-ink-3"><ExternalLink href={rule.documents.canonical_url}>{c.openOriginal}</ExternalLink></p>
      </Card>
    </Section>
  </>;
}
