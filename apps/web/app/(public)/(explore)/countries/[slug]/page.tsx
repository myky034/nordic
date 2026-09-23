import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountry } from "@/lib/registry/queries";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { logAccessError } from "@/lib/rbac/access";
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
    .order("topic", { ascending: true }).order("created_at", { ascending: false }).limit(100);
  if (error) { logAccessError("country_facts"); throw new Error("Không tải được thông tin của quốc gia này."); }
  const facts = data as unknown as FactRow[];
  return <>
    <Link href="/countries" className="text-sm text-zinc-500">← All countries</Link>
    <h1 className="mt-6 text-4xl font-semibold tracking-tight">{country.name}</h1>
    <p className="mt-3 text-zinc-500">Research status: {country.status.replaceAll("_", " ")}</p>
    <h2 className="mt-8 mb-3 text-2xl font-medium">Evidence-backed facts</h2>
    {facts.length ? <div className="space-y-6">{facts.map((f) => <FactCard key={f.id} fact={f} />)}</div>
      : <div className="rounded-2xl bg-zinc-50 p-6 text-sm leading-7 dark:bg-zinc-900">No evidence-backed facts for this country yet. Overview, cost of living, education, labour-market and immigration information will appear here only once reviewed through <Link href="/facts/workspace" className="underline">the facts workspace</Link> — never invented or inferred.</div>}
    <h2 className="mt-10 mb-3 text-2xl font-medium">Linked sources</h2>
    <SourceList sources={country.sources.map((source) => ({ ...source, country: { name: country.name, slug: country.slug } }))} />
    <Link href="/sources" className="mt-6 inline-block text-sm underline">Browse the full source registry</Link>
  </>;
}
