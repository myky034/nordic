import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { degreeLabel } from "@/lib/education/domain";
import { countryName } from "@/lib/registry/domain";
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
  return <>
    <PageHeader back={<BackLink href="/universities">Tất cả trường</BackLink>} actions={<SaveButton kind="university" id={uni.id} signedIn={save.signedIn} initialSaved={save.saved} />}
      eyebrow={<Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{countryName(uni.countries.slug, uni.countries.name)}</Link>} title={uni.name} />
    <DescriptionList items={[["Trang web chính thức", <ExternalLink key="w" href={uni.official_url}>{uni.official_url}</ExternalLink>]]} />
    <Section title="Chương trình học" actions={total > programmes.length ? <Link href={`/programmes?university=${uni.id}`} className={`${textLink} text-[15px]`}>Xem tất cả {total}</Link> : undefined}>
      {programmes.length ? <List label="Chương trình học">{programmes.map((p) => <ListRow key={p.id} href={`/programmes/${p.id}`} title={p.name}
        badges={<Badge tone="accent">{degreeLabel(p.degree_type)}</Badge>}
        subtitle={`${p.field ?? "Nguồn không nêu ngành"} · ${p.language ?? "Nguồn không nêu ngôn ngữ"}`} />)}</List>
        : <EmptyState>Chưa có chương trình nào của trường này được duyệt.</EmptyState>}
    </Section>
    <Section title="Vì sao trường này có trong danh sách">
      <Card><ExistenceEvidence excerpt={uni.evidence_excerpt} document={uni.documents} reviewedAt={uni.reviewed_at} /></Card>
    </Section>
  </>;
}
