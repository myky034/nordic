import Link from "next/link";
import { connection } from "next/server";
import { listCountries } from "@/lib/registry/queries";

export default async function CountriesPage() {
  // Database reads belong to request time, not production build time.
  await connection();
  const countries = await listCountries();
  return <>
    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Country explorer</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Start with a country</h1>
    <p className="mt-4 max-w-2xl leading-7 text-zinc-500">Five countries in our initial research scope. Profiles are awaiting evidence; no study, work or immigration claims have been added yet.</p>
    {!countries.length ? <p className="mt-10">No countries have been registered yet.</p> : <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{countries.map((country) => <Link href={`/countries/${country.slug}`} key={country.id} className="rounded-2xl border border-zinc-200 p-7 transition hover:bg-zinc-50 focus-visible:outline-2 dark:border-zinc-800 dark:hover:bg-zinc-900"><h2 className="text-xl font-medium">{country.name}</h2><p className="mt-3 text-sm text-zinc-500">{country.status.replaceAll("_", " ")}</p><p className="mt-6 text-sm">{country._count.sources} linked sources <span aria-hidden="true">→</span></p></Link>)}</div>}
    <Link href="/sources" className="mt-8 inline-block text-sm underline underline-offset-4">Browse all registered sources</Link>
  </>;
}
