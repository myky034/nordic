import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountry } from "@/lib/registry/queries";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { logAccessError } from "@/lib/rbac/access";
import { Badge, BackLink, EmptyState, List, ListRow, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { SourceList } from "../../source-list";

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
  return <>
    <PageHeader back={<BackLink href="/countries">All countries</BackLink>} eyebrow="Country" title={country.name}
      description={<span className="inline-flex items-center gap-2">Research status <Badge>{country.status.replaceAll("_", " ")}</Badge></span>} />
    <Section title="Explore">
      <List>
        <ListRow href={`/universities?country=${country.slug}`} title={`Reviewed universities in ${country.name}`} />
        <ListRow href={`/programmes?country=${country.slug}`} title={`Reviewed programmes in ${country.name}`} />
        <ListRow href={`/immigration?country=${country.slug}`} title={`Immigration rules in ${country.name}`} subtitle="Research information, not immigration advice." />
      </List>
    </Section>
    {/* Latest few only; the full, paginated list is /facts?country=… */}
    <Section title="Evidence-backed facts" actions={facts.length > 5 ? <Link href={`/facts?country=${country.slug}`} className={`${textLink} text-[15px]`}>All facts</Link> : undefined}>
      {facts.length ? <div className="space-y-4">{facts.slice(0, 5).map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState>No evidence-backed facts for this country yet. Overview, cost of living, education, labour-market and immigration information will appear here only once reviewed through <Link href="/facts/workspace" className={textLink}>the facts workspace</Link> — never invented or inferred.</EmptyState>}
    </Section>
    <Section title="Linked sources" actions={<Link href="/sources" className={`${textLink} text-[15px]`}>Full registry</Link>}>
      <SourceList sources={country.sources.map((source) => ({ ...source, country: { name: country.name, slug: country.slug } }))} />
    </Section>
  </>;
}
