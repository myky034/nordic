import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { countryName } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { degreeLabel } from "@/lib/education/domain";
import { ExistenceEvidence, programmeDetailSelect, type ProgrammeDetailRow } from "@/lib/education/view";
import { BackLink, Card, DescriptionList, EmptyState, ExternalLink, PageHeader, Section } from "@/components/ui";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { textLink } from "@/components/ui/styles";

export default async function ProgrammePage({ params }: PageProps<"/programmes/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const client = await createClient();
  const [programmeResult, factsResult] = await Promise.all([
    client.from("programmes").select(programmeDetailSelect).eq("id", id)
      .eq("status", "reviewed").eq("universities.status", "reviewed").maybeSingle(),
    // Tuition, deadline, duration etc. are facts (Option A), so they carry
    // their own evidence, review status and conflict flag.
    client.from("facts").select(factSelect).eq("programme_id", id).in("status", ["reviewed", "conflicted"])
      .order("topic", { ascending: true }).order("created_at", { ascending: false }).limit(100),
  ]);
  if (programmeResult.error || factsResult.error) { logAccessError("public_programme"); throw new Error("Không tải được chương trình."); }
  if (!programmeResult.data) notFound();
  const programme = programmeResult.data as unknown as ProgrammeDetailRow;
  const facts = factsResult.data as unknown as FactRow[];
  const uni = programme.universities;
  const save = await savedState("programme", programme.id);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.programmes, dict.common];
  return <>
    <PageHeader back={<BackLink href="/programmes">{t.back}</BackLink>} actions={<SaveButton kind="programme" id={programme.id} signedIn={save.signedIn} initialSaved={save.saved} locale={locale} />}
      eyebrow={<>{degreeLabel(programme.degree_type, locale)} · <Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{countryName(uni.countries.slug, uni.countries.name, locale)}</Link></>}
      title={programme.name}
      description={<Link href={`/programmes?university=${uni.id}`} className={textLink}>{uni.name}</Link>} />
    <DescriptionList items={[
      [t.field, programme.field ?? c.notStated],
      [t.language, programme.language ?? c.notStated],
      [t.page, <ExternalLink key="p" href={programme.official_url}>{programme.official_url}</ExternalLink>],
      [t.applicationPage, programme.application_url ? <ExternalLink key="a" href={programme.application_url}>{programme.application_url}</ExternalLink> : c.notRecorded],
    ]} />
    <Section title={t.facts}>
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} internal={internal} locale={locale} />)}</div>
        : <EmptyState>{t.noFacts}</EmptyState>}
    </Section>
    <Section title={t.why}>
      <Card><ExistenceEvidence excerpt={programme.evidence_excerpt} document={programme.documents} reviewedAt={programme.reviewed_at} locale={locale} /></Card>
    </Section>
    <p className="mt-10 px-1 text-[13px] text-ink-3">{t.disclaimer}</p>
  </>;
}
