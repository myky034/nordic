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
  const save = await savedState("immigration_rule", rule.id);
  return <>
    <PageHeader back={<BackLink href="/immigration">Tất cả quy định</BackLink>} actions={<SaveButton kind="immigration_rule" id={rule.id} signedIn={save.signedIn} initialSaved={save.saved} />}
      eyebrow={<>{ruleTypeLabel(rule.rule_type)} · <Link href={`/countries/${rule.countries.slug}`} className="hover:underline">{countryName(rule.countries.slug, rule.countries.name)}</Link></>}
      title={rule.title} />
    <div className="-mt-4 space-y-4">
      <LegalDisclaimer />
      {facts.some((f) => f.status === "conflicted") && <ConflictBanner />}
    </div>
    <div className="mt-8">
      <DescriptionList items={[
        ["Trang chính thức", <ExternalLink key="o" href={rule.official_url}>{rule.official_url}</ExternalLink>],
        ["Nguồn", `${source.name} · ${tierLabel(source.source_tier)}`],
        ["Nguồn xác minh gần nhất", day(source.last_verified_at)],
        ["Ngày lấy trang bằng chứng", day(rule.documents.retrieved_at)],
        ["Ngày duyệt bằng chứng", day(rule.reviewed_at)],
      ]} />
    </div>
    <Section title="Điều kiện">
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState>Chưa có điều kiện nào của quy định này được duyệt với nguồn đã xác minh. Hãy đọc trang chính thức ở trên; ở đây không có gì được tóm tắt hay suy đoán.</EmptyState>}
    </Section>
    <Section title="Vì sao quy định này có trong danh sách">
      <Card className="space-y-3">
        <Quote>{rule.evidence_excerpt}</Quote>
        <p className="text-[13px] text-ink-3"><ExternalLink href={rule.documents.canonical_url}>Mở trang gốc</ExternalLink></p>
      </Card>
    </Section>
  </>;
}
