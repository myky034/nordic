import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { degreeLabel } from "@/lib/education/domain";
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
  return <>
    <PageHeader back={<BackLink href="/universities">All universities</BackLink>}
      eyebrow={<Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{uni.countries.name}</Link>} title={uni.name} />
    <DescriptionList items={[["Official website", <ExternalLink key="w" href={uni.official_url}>{uni.official_url}</ExternalLink>]]} />
    <Section title="Programmes" actions={total > programmes.length ? <Link href={`/programmes?university=${uni.id}`} className={`${textLink} text-[15px]`}>All {total}</Link> : undefined}>
      {programmes.length ? <List label="Programmes">{programmes.map((p) => <ListRow key={p.id} href={`/programmes/${p.id}`} title={p.name}
        badges={<Badge tone="accent">{degreeLabel(p.degree_type)}</Badge>}
        subtitle={`${p.field ?? "Field not stated"} · ${p.language ?? "Language not stated"}`} />)}</List>
        : <EmptyState>No reviewed programmes for this university yet.</EmptyState>}
    </Section>
    <Section title="Why this university is listed">
      <Card><ExistenceEvidence excerpt={uni.evidence_excerpt} document={uni.documents} reviewedAt={uni.reviewed_at} /></Card>
    </Section>
  </>;
}
