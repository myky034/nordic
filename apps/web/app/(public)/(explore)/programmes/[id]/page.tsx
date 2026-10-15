import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { countryName } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { FactCard, FactValue, factSelect, type FactRow } from "@/lib/facts/view";
import { programmeSlotKeys, programmeSlots } from "@/lib/education/programme-slots";
import { factTypeLabel } from "@/lib/compare/domain";
import { degreeLabel } from "@/lib/education/domain";
import { ExistenceEvidence, programmeDetailSelect, type ProgrammeDetailRow } from "@/lib/education/view";
import { BackLink, Card, DescriptionList, ExternalLink, PageHeader, Section } from "@/components/ui";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { buttonPrimary, textLink } from "@/components/ui/styles";

// Layout (2026-10-13, after the owner found the page said nothing beyond the
// title): the official page first, then the university's own description,
// then a fixed checklist of what visitors ask (tuition, deadline, duration,
// English, prior degree) — filled from reviewed facts or marked "not
// available yet" with the official page — then a summary, then each fact
// with its full source. Nothing is estimated (AGENTS.md §1, §20).
export default async function ProgrammePage({ params }: PageProps<"/programmes/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const client = await createClient();
  const [programmeResult, factsResult, typesResult] = await Promise.all([
    client.from("programmes").select(programmeDetailSelect).eq("id", id)
      .eq("status", "reviewed").eq("universities.status", "reviewed").maybeSingle(),
    // Tuition, deadline, duration etc. are facts (Option A), so they carry
    // their own evidence, review status and conflict flag.
    client.from("facts").select(factSelect).eq("programme_id", id).in("status", ["reviewed", "conflicted"])
      .order("topic", { ascending: true }).order("created_at", { ascending: false }).limit(100),
    // Slot names come from the fact types when they exist (L3a).
    client.from("fact_types").select("key,label_vi,label_en").in("key", [...programmeSlotKeys]),
  ]);
  if (programmeResult.error || factsResult.error) { logAccessError("public_programme"); throw new Error("Không tải được chương trình."); }
  if (!programmeResult.data) notFound();
  // A failed read of slot names falls back to the built-in names; it hides nothing.
  if (typesResult.error) logAccessError("public_programme_fact_types");
  const programme = programmeResult.data as unknown as ProgrammeDetailRow;
  const facts = factsResult.data as unknown as FactRow[];
  const typeNames = new Map(((typesResult.data ?? []) as { key: string; label_vi: string; label_en: string }[]).map((t) => [t.key, t]));
  const uni = programme.universities;
  const save = await savedState("programme", programme.id);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  // L5: editors get a shortcut to map facts from the crawled official page.
  const mapDocument = internal ? (await client.from("documents").select("id").eq("canonical_url", programme.official_url)
    .order("retrieved_at", { ascending: false }).limit(1)).data?.[0]?.id as string | undefined : undefined;
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.programmes, dict.common];
  const { slots, others } = programmeSlots(facts);
  const slotName = (key: (typeof programmeSlotKeys)[number]) => { const ft = typeNames.get(key); return ft ? factTypeLabel(ft, locale) : t.slots[key]; };
  const official = <a href={programme.official_url} target="_blank" rel="noopener noreferrer" className={textLink}>{t.seeOfficial} ↗</a>;
  const withFacts = slots.filter((s) => s.facts.length).flatMap((s) => s.facts);
  return <>
    <PageHeader back={<BackLink href="/programmes">{t.back}</BackLink>}
      actions={<><a href={programme.official_url} target="_blank" rel="noopener noreferrer" className={buttonPrimary}>{t.openProgramme} ↗</a>
        <SaveButton kind="programme" id={programme.id} signedIn={save.signedIn} initialSaved={save.saved} locale={locale} />
        {mapDocument && <Link href={`/facts/map/${mapDocument}`} className={`${textLink} text-[15px]`}>{dict.factMap.entry}</Link>}</>}
      eyebrow={<>{degreeLabel(programme.degree_type, locale)} · <Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{countryName(uni.countries.slug, uni.countries.name, locale)}</Link></>}
      title={programme.name}
      description={<Link href={`/programmes?university=${uni.id}`} className={textLink}>{uni.name}</Link>} />

    <Section title={t.intro} description={t.introHelp}>
      <Card><ExistenceEvidence excerpt={programme.evidence_excerpt} document={programme.documents} reviewedAt={programme.reviewed_at} locale={locale} /></Card>
    </Section>

    <Section title={t.keyFacts} description={t.keyFactsHelp}>
      <Card><dl className="divide-y divide-hairline">
        {slots.map((slot) => <div key={slot.key} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[14rem_1fr] sm:gap-4">
          <dt className="text-[15px] text-ink-2">{slotName(slot.key)}</dt>
          <dd className="min-w-0">{slot.facts.length
            ? <div className="space-y-2">{slot.facts.map((f) => <div key={f.id}>
                <FactValue fact={f} locale={locale} compact />
                <p className="text-[12px] text-ink-3">{f.documents.sources.name} · <a href={`#fact-${f.id}`} className="hover:text-ink">{dict.factCard.showEvidence}</a></p>
              </div>)}</div>
            : <p className="text-[15px] text-ink-3">{t.missing} — {official}</p>}</dd>
        </div>)}
      </dl></Card>
    </Section>

    <Section title={t.summary}>
      <DescriptionList items={[
        [t.university, <Link key="u" href={`/universities/${uni.id}`} className={textLink}>{uni.name}</Link>],
        [t.field, programme.field ?? c.notStated],
        [t.language, programme.language ?? c.notStated],
        [t.page, <ExternalLink key="p" href={programme.official_url}>{programme.official_url}</ExternalLink>],
        [t.applicationPage, programme.application_url ? <ExternalLink key="a" href={programme.application_url}>{programme.application_url}</ExternalLink> : c.notRecorded],
      ]} />
    </Section>

    {withFacts.length > 0 && <Section title={t.detailsTitle}>
      <div className="space-y-4">{withFacts.map((f) => <div key={f.id} id={`fact-${f.id}`} className="scroll-mt-24"><FactCard fact={f} internal={internal} locale={locale} /></div>)}</div>
    </Section>}
    {others.length > 0 && <Section title={t.otherFacts}>
      <div className="space-y-4">{others.map((f) => <div key={f.id} id={`fact-${f.id}`} className="scroll-mt-24"><FactCard fact={f} internal={internal} locale={locale} /></div>)}</div>
    </Section>}
    <p className="mt-10 px-1 text-[13px] text-ink-3">{t.disclaimer}</p>
  </>;
}
