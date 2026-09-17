import Link from "next/link";
import { notFound } from "next/navigation";
import { getCountry } from "@/lib/registry/queries";
import { SourceList } from "../../source-list";

export default async function CountryPage({ params }: PageProps<"/countries/[slug]">) {
  const { slug } = await params;
  const country = await getCountry(slug);
  if (!country) notFound();
  return <>
    <Link href="/countries" className="text-sm text-zinc-500">← All countries</Link>
    <h1 className="mt-6 text-4xl font-semibold tracking-tight">{country.name}</h1>
    <p className="mt-3 text-zinc-500">Research status: {country.status.replaceAll("_", " ")}</p>
    <div className="my-8 rounded-2xl bg-zinc-50 p-6 text-sm leading-7 dark:bg-zinc-900">Country profile data is not available yet. Education, living costs, labour-market and immigration information will appear only when supported by evidence.</div>
    <h2 className="mb-3 text-2xl font-medium">Linked sources</h2>
    <SourceList sources={country.sources.map((source) => ({ ...source, country: { name: country.name, slug: country.slug } }))} />
    <Link href="/sources" className="mt-6 inline-block text-sm underline">Browse the full source registry</Link>
  </>;
}
