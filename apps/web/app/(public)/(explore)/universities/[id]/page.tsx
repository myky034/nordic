import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { degreeLabel } from "@/lib/education/domain";
import { countryName } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { ExistenceEvidence, universityListSelect, type UniversityRow } from "@/lib/education/view";
import { BackLink, Badge, Card, DescriptionList, EmptyState, ExternalLink, List, ListRow, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";

export default async function UniversityPage({ params }: PageProps<"/universities/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const client = await createClient();
  const [uniResult, programmesResult] = await Promise.all([
    client.from("universities").select(universityListSelect).eq("id", id).eq("status", "reviewed").maybeSingle(),
    client.from("programmes").select("id,name,degree_type,field,language", { count: "exact" }).eq("university_id", id).eq("status", "reviewed")
      .order("name", { ascending: true }).limit(10),
  ]);
  if (uniResult.error || programmesResult.error) { logAccessError("public_university"); throw new Error("Không tải được trường."); }
  if (!uniResult.data) notFound();
  const uni = uniResult.data as unknown as UniversityRow;
  const programmes = (programmesResult.data ?? []) as { id: string; name: string; degree_type: string; field: string | null; language: string | null }[];
  const total = programmesResult.count ?? programmes.length;
  const save = await savedState("university", uni.id);
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.universities, dict.common];
  return <>
    <PageHeader back={<BackLink href="/universities">{t.back}</BackLink>} actions={<SaveButton kind="university" id={uni.id} signedIn={save.signedIn} initialSaved={save.saved} locale={locale} />}
      eyebrow={<Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{countryName(uni.countries.slug, uni.countries.name, locale)}</Link>} title={uni.name} />
    <DescriptionList items={[[t.website, <ExternalLink key="w" href={uni.official_url}>{uni.official_url}</ExternalLink>]]} />
    <Section title={t.programmes} actions={total > programmes.length ? <Link href={`/programmes?university=${uni.id}`} className={`${textLink} text-[15px]`}>{c.seeAllCount(total)}</Link> : undefined}>
      {programmes.length ? <List label={t.programmes}>{programmes.map((p) => <ListRow key={p.id} href={`/programmes/${p.id}`} title={p.name}
        badges={<Badge tone="accent">{degreeLabel(p.degree_type, locale)}</Badge>}
        subtitle={`${p.field ?? c.notStatedField} · ${p.language ?? c.notStatedLanguage}`} />)}</List>
        : <EmptyState>{t.noProgrammes}</EmptyState>}
    </Section>
    <Section title={t.why}>
      <Card><ExistenceEvidence excerpt={uni.evidence_excerpt} document={uni.documents} reviewedAt={uni.reviewed_at} locale={locale} /></Card>
    </Section>
  </>;
}
