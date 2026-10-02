import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { countryName, countrySlugs } from "@/lib/registry/domain";
import { FactCard, type FactRow } from "@/lib/facts/view";
import { ExistenceEvidence } from "@/lib/education/view";
import { classificationLabel } from "@/lib/labour/domain";
import { figureSelect, occupationDetailSelect, type OccupationDetailRow } from "@/lib/labour/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, withParams } from "@/lib/pagination";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { BackLink, Card, DescriptionList, EmptyState, Notice, PageHeader, Pagination, Section, Segmented } from "@/components/ui";

export default async function OccupationPage({ params, searchParams }: PageProps<"/occupations/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const query = await searchParams;
  // Figures are compared per country; the segmented control narrows to one.
  const country = typeof query.country === "string" && countrySlugs.some((s) => s === query.country) ? query.country : "";
  const page = pageParam(query);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  // Same public conditions as facts_public for occupation figures: reviewed or
  // conflicted, and a registry-verified evidence source.
  const base = (head = false) => client.from("facts").select(figureSelect, { count: "exact", head }).eq("occupation_id", id)
    .in("status", ["reviewed", "conflicted"]).eq("documents.sources.status", "verified");
  let figures = base();
  if (country) figures = figures.eq("countries.slug", country);
  const [occupationResult, figuresResult, ...countryCounts] = await Promise.all([
    client.from("occupations").select(occupationDetailSelect).eq("id", id).eq("status", "reviewed").maybeSingle(),
    figures.order("reference_period", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).range(from, to),
    // Count-only (HEAD) requests for the per-country segment badges.
    ...countrySlugs.map((slug) => base(true).eq("countries.slug", slug)),
  ]);
  if (isPastLastPage(figuresResult.error)) redirect(withParams(`/occupations/${id}`, query, { page: null }));
  if (occupationResult.error || figuresResult.error || countryCounts.some((r) => r.error)) { logAccessError("public_occupation"); throw new Error("Không tải được thông tin nghề."); }
  if (!occupationResult.data) notFound();
  const occupation = occupationResult.data as unknown as OccupationDetailRow;
  const facts = (figuresResult.data ?? []) as unknown as FactRow[];
  const counts = countryCounts.map((r) => r.count ?? 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const name = (slug: string) => countryName(slug, slug);
  const save = await savedState("occupation", occupation.id);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  return <>
    <PageHeader back={<BackLink href="/occupations">Tất cả nghề</BackLink>} actions={<SaveButton kind="occupation" id={occupation.id} signedIn={save.signedIn} initialSaved={save.saved} />} eyebrow="Nghề nghiệp" title={occupation.name} />
    <DescriptionList items={[
      ["Mã phân loại", classificationLabel(occupation.classification_system, occupation.classification_code)],
      ["Phạm vi", occupation.countries ? <Link key="c" href={`/countries/${occupation.countries.slug}`} className="text-accent hover:underline">{countryName(occupation.countries.slug, occupation.countries.name)}</Link> : "Định nghĩa quốc tế"],
    ]} />
    <Section title="Số liệu thị trường lao động" description="Mỗi số liệu ghi rõ quốc gia và kỳ số liệu. Số liệu khác kỳ hoặc khác nguồn không so sánh trực tiếp được.">
      <Segmented label="Quốc gia" items={[
        { href: withParams(`/occupations/${id}`, {}, {}), label: "Tất cả", count: total, active: !country },
        ...countrySlugs.map((slug, i) => ({ href: withParams(`/occupations/${id}`, {}, { country: slug }), label: name(slug), count: counts[i], active: country === slug })),
      ]} />
      {facts.some((f) => f.status === "conflicted") && <div className="mb-4"><Notice tone="critical" role="alert" title="Các nguồn khác nhau ở ít nhất một số liệu.">Cả hai đều được hiển thị; hệ thống không chọn bên nào là đúng.</Notice></div>}
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} internal={internal} />)}</div>
        : <EmptyState>Chưa có số liệu nào được duyệt với nguồn đã xác minh{country ? ` cho ${name(country)}` : ""}. Ở đây không có gì được ước lượng.</EmptyState>}
      <Pagination summary={pageSummary(figuresResult.count ?? facts.length, page)} href={(p) => withParams(`/occupations/${id}`, query, { page: p })} />
    </Section>
    <Section title="Vì sao nghề này có trong danh sách">
      <Card><ExistenceEvidence excerpt={occupation.evidence_excerpt} document={occupation.documents} reviewedAt={occupation.reviewed_at} /></Card>
    </Section>
  </>;
}
