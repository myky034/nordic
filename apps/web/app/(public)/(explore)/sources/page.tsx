import Link from "next/link";
import Form from "next/form";
import { searchSources } from "@/lib/registry/queries";
import { countrySlugs, registryFilters, sourceStatuses, tiers } from "@/lib/registry/domain";
import { pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";
import { SourceList } from "../source-list";

export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const query = await searchParams;
  const filters = registryFilters(query);
  const q = searchParam(query);
  const page = pageParam(query);
  const { rows, total } = await searchSources(query, page);
  return <>
    <PageHeader eyebrow="Evidence starts here" title="Source registry"
      description="Discover where research begins. Registration and source tier do not verify a source’s claims. Unreviewed details remain unknown." />
    <Form action="/sources" className={filterBar}>
      <div className="sm:col-span-2 lg:col-span-4"><SearchInput defaultValue={q} placeholder="Search by name or URL" /></div>
      <Field label="Country"><select name="country" defaultValue={filters.country} className={control}><option value="">All countries</option><option value="unassigned">Not assigned</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{slug[0].toUpperCase() + slug.slice(1)}</option>)}</select></Field>
      <Field label="Source tier"><select name="tier" defaultValue={filters.tier} className={control}><option value="">All tiers</option><option value="unknown">Unclassified</option>{Object.entries(tiers).map(([tier, label]) => <option key={tier} value={tier}>{tier} · {label}</option>)}</select></Field>
      <Field label="Review status"><select name="status" defaultValue={filters.status} className={control}><option value="">All statuses</option>{sourceStatuses.map((status) => <option key={status} value={status}>{status === "verified" ? "Registry metadata reviewed" : status.replaceAll("_", " ")}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Apply</button><Link href="/sources" className={`${textLink} text-[15px]`}>Reset</Link></div>
    </Form>
    <SourceList sources={rows} />
    <Pagination summary={pageSummary(total, page)} href={(p) => withParams("/sources", query, { page: p })} />
  </>;
}
