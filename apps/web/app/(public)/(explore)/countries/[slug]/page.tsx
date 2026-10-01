import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { getCountry } from "@/lib/registry/queries";
import { countryName, countryStatusLabels } from "@/lib/registry/domain";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { logAccessError } from "@/lib/rbac/access";
import { Badge, BackLink, EmptyState, List, ListRow, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { SourceList } from "../../source-list";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { canOpenFactsWorkspace } from "@/lib/rbac/ui";

export default async function CountryPage({ params }: PageProps<"/countries/[slug]">) {
  const { slug } = await params;
  const country = await getCountry(slug);
  if (!country) notFound();
  // Same public read path as /facts (Supabase client + RLS), scoped to this
  // country — evidence-backed facts are the only thing this page is allowed
  // to show as country-profile content (AGENTS.md Section 1.1: no invented
  // overview/cost-of-living/etc. text).
  const client = await createClient();
  const { data, error } = await client.from("facts").select(factSelect)
    .eq("country_id", country.id).in("status", ["reviewed", "conflicted"])
    .order("created_at", { ascending: false }).limit(6);
  if (error) { logAccessError("country_facts"); throw new Error("Không tải được thông tin của quốc gia này."); }
  const facts = data as unknown as FactRow[];
  const save = await savedState("country", country.id);
  // Visitors are told why the section is empty; only editors get the workspace link.
  const canEdit = canOpenFactsWorkspace(await viewerPermissions());
  const name = countryName(country.slug, country.name);
  return <>
    <PageHeader back={<BackLink href="/countries">Tất cả quốc gia</BackLink>} actions={<SaveButton kind="country" id={country.id} signedIn={save.signedIn} initialSaved={save.saved} />} eyebrow={country.name} title={name}
      description={<span className="inline-flex items-center gap-2">Trạng thái nghiên cứu <Badge tone={country.status === "active" ? "accent" : "neutral"}>{countryStatusLabels[country.status] ?? country.status}</Badge></span>} />
    <Section title="Khám phá">
      <List>
        <ListRow href={`/universities?country=${country.slug}`} title={`Trường đại học tại ${name}`} subtitle="Chỉ các trường đã được đối chiếu với nguồn." />
        <ListRow href={`/programmes?country=${country.slug}`} title={`Chương trình học tại ${name}`} />
        <ListRow href={`/immigration?country=${country.slug}`} title={`Quy định nhập cư của ${name}`} subtitle="Thông tin nghiên cứu, không phải tư vấn di trú." />
        <ListRow href={`/compare?c=${country.slug}`} title={`So sánh ${name} với nước khác`} subtitle="Đặt cạnh nhau, kèm nguồn; không chấm điểm hay xếp hạng." />
        <ListRow href="/occupations" title="Nghề nghiệp và số liệu lao động" subtitle={`Chọn một nghề, rồi lọc số liệu theo ${name}.`} />
      </List>
    </Section>
    {/* Latest few only; the full, paginated list is /facts?country=… */}
    <Section title="Thông tin có bằng chứng" actions={facts.length > 5 ? <Link href={`/facts?country=${country.slug}`} className={`${textLink} text-[15px]`}>Xem tất cả</Link> : undefined}>
      {facts.length ? <div className="space-y-4">{facts.slice(0, 5).map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState title="Chưa có thông tin nào được duyệt">Thông tin về chi phí sinh hoạt, giáo dục, lao động và nhập cư của nước này chỉ xuất hiện ở đây sau khi được đối chiếu với nguồn và duyệt; không bao giờ được tự điền hay suy đoán.{canEdit && <> Bạn có thể thêm ở <Link href="/facts/workspace" className={textLink}>trang biên tập thông tin</Link>.</>}</EmptyState>}
    </Section>
    <Section title="Nguồn của quốc gia này" actions={<Link href="/sources" className={`${textLink} text-[15px]`}>Tất cả nguồn</Link>}>
      <SourceList sources={country.sources.map((source) => ({ ...source, country: { name: country.name, slug: country.slug } }))} />
    </Section>
  </>;
}
