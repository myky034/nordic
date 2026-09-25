import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { countrySlugs } from "@/lib/registry/domain";
import { FactCard, type FactRow } from "@/lib/facts/view";
import { ExistenceEvidence } from "@/lib/education/view";
import { classificationLabel } from "@/lib/labour/domain";
import { figureSelect, occupationDetailSelect, type OccupationDetailRow } from "@/lib/labour/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, withParams } from "@/lib/pagination";
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
  const name = (slug: string) => slug[0].toUpperCase() + slug.slice(1);
  return <>
    <PageHeader back={<BackLink href="/occupations">All occupations</BackLink>} eyebrow="Occupation" title={occupation.name} />
    <DescriptionList items={[
      ["Classification", classificationLabel(occupation.classification_system, occupation.classification_code)],
      ["Scope", occupation.countries ? <Link key="c" href={`/countries/${occupation.countries.slug}`} className="text-accent hover:underline">{occupation.countries.name}</Link> : "International definition"],
    ]} />
    <Section title="Labour-market figures" description="Each figure states its country and reference period. Figures from different periods or sources are not directly comparable.">
      <Segmented label="Country" items={[
        { href: withParams(`/occupations/${id}`, {}, {}), label: "All", count: total, active: !country },
        ...countrySlugs.map((slug, i) => ({ href: withParams(`/occupations/${id}`, {}, { country: slug }), label: name(slug), count: counts[i], active: country === slug })),
      ]} />
      {facts.some((f) => f.status === "conflicted") && <div className="mb-4"><Notice tone="critical" role="alert" title="Sources disagree on at least one figure.">Both claims are shown; neither has been chosen as correct.</Notice></div>}
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState>No reviewed figures with a verified source{country ? ` for ${name(country)}` : ""} yet. Nothing is estimated here.</EmptyState>}
      <Pagination summary={pageSummary(figuresResult.count ?? facts.length, page)} href={(p) => withParams(`/occupations/${id}`, query, { page: p })} />
    </Section>
    <Section title="Why this occupation is listed">
      <Card><ExistenceEvidence excerpt={occupation.evidence_excerpt} document={occupation.documents} reviewedAt={occupation.reviewed_at} /></Card>
    </Section>
  </>;
}
