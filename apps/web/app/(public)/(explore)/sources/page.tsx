import Link from "next/link";
import { listSources } from "@/lib/registry/queries";
import { countrySlugs, registryFilters, sourceStatuses, tiers } from "@/lib/registry/domain";
import { SourceList } from "../source-list";

export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const query = await searchParams;
  const filters = registryFilters(query);
  const sources = await listSources(query);
  const selectClass = "mt-2 w-full rounded-xl border border-zinc-300 bg-background p-3 text-sm dark:border-zinc-700";
  return <>
    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Evidence starts here</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Source registry</h1>
    <p className="mt-4 max-w-2xl leading-7 text-zinc-500">Discover where research begins. Registration and source tier do not verify a source’s claims. Unreviewed details remain unknown.</p>
    <form className="my-8 grid items-end gap-4 rounded-2xl bg-zinc-50 p-5 sm:grid-cols-2 lg:grid-cols-4 dark:bg-zinc-900" action="/sources">
      <label className="text-sm">Country<select name="country" defaultValue={filters.country} className={selectClass}><option value="">All countries</option><option value="unassigned">Not assigned</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{slug[0].toUpperCase() + slug.slice(1)}</option>)}</select></label>
      <label className="text-sm">Source tier<select name="tier" defaultValue={filters.tier} className={selectClass}><option value="">All tiers</option><option value="unknown">Unclassified</option>{Object.entries(tiers).map(([tier, label]) => <option key={tier} value={tier}>{tier} · {label}</option>)}</select></label>
      <label className="text-sm">Review status<select name="status" defaultValue={filters.status} className={selectClass}><option value="">All statuses</option>{sourceStatuses.map((status) => <option key={status} value={status}>{status === "verified" ? "Registry metadata reviewed" : status.replaceAll("_", " ")}</option>)}</select></label>
      <div className="flex items-center gap-4"><button className="rounded-xl bg-zinc-900 px-5 py-3 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">Apply filters</button><Link href="/sources" className="text-sm underline">Reset</Link></div>
    </form>
    <p className="text-sm text-zinc-500">{sources.length > 100 ? "Showing the first 100 sources. Narrow your filters to see fewer results." : `${sources.length} sources`}</p>
    <SourceList sources={sources.slice(0, 100)} />
  </>;
}
