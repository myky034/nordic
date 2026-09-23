import { connection } from "next/server";
import { listCountries } from "@/lib/registry/queries";
import { Badge, countLabel, EmptyState, List, ListRow, PageHeader } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import Link from "next/link";

export default async function CountriesPage() {
  // Database reads belong to request time, not production build time.
  await connection();
  const countries = await listCountries();
  return <>
    <PageHeader eyebrow="Country explorer" title="Start with a country"
      description="Five countries in our initial research scope. Profiles fill in only as evidence is reviewed; nothing is inferred." />
    {!countries.length ? <EmptyState>No countries have been registered yet.</EmptyState>
      : <List label="Countries">{countries.map((country) => <ListRow key={country.id} href={`/countries/${country.slug}`} title={country.name}
          badges={<Badge>{country.status.replaceAll("_", " ")}</Badge>}
          trailing={countLabel(country._count.sources, "source")} />)}</List>}
    <p className="mt-6 px-1 text-[15px]"><Link href="/sources" className={textLink}>Browse all registered sources</Link></p>
  </>;
}
