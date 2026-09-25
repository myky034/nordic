import Link from "next/link";
import Form from "next/form";
import { createPublicClient } from "@/lib/supabase/public";
import { logAccessError } from "@/lib/rbac/access";
import { searchParam } from "@/lib/pagination";
import { groupHits, hitHref, seeAllHref, type SearchHit } from "@/lib/search/domain";
import { EmptyState, List, ListRow, PageHeader, SearchInput, Section } from "@/components/ui";
import { buttonPrimary, textLink } from "@/components/ui/styles";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const q = searchParam(await searchParams);
  let groups: ReturnType<typeof groupHits> = [];
  if (q) {
    // Anonymous client: results are the public view even for signed-in editors.
    const { data, error } = await createPublicClient().rpc("search_public", { p_query: q, p_per_type: 5 });
    if (error) { logAccessError("public_search"); throw new Error("Không tìm kiếm được. Hãy thử lại."); }
    groups = groupHits((data ?? []) as SearchHit[]);
  }
  return <>
    <PageHeader eyebrow="Search" title="Search Nordic"
      description="Searches reviewed, public records only: countries, programmes, universities, immigration rules, occupations, facts, sources and documents." />
    <Form action="/search" className="mb-10 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder="Try “Stockholm”, “work permit”, “malmo”…" /></div>
      <button className={buttonPrimary}>Search</button>
    </Form>
    {!q ? <EmptyState>Type a word or phrase. Accents are optional: “goteborg” finds “Göteborg”. Use quotes for an exact phrase and a minus sign to exclude a word.</EmptyState>
      : !groups.length ? <EmptyState title={`No public results for “${q}”`}>Nothing reviewed matches yet. Records appear here only after review against a source — nothing is generated to fill the gap.</EmptyState>
      : groups.map((g) => {
        const all = seeAllHref(g.type, q);
        return <Section key={g.type} title={<>{g.label} <span className="text-[15px] font-normal text-ink-3">{g.total}</span></>}
          actions={all && g.total > g.hits.length ? <Link href={all} className={`${textLink} text-[15px]`}>See all</Link> : undefined}>
          <List label={g.label}>{g.hits.map((h) => {
            const href = hitHref(h);
            return <ListRow key={`${h.entity_type}-${h.id}`} href={href ?? undefined} title={h.title} subtitle={h.subtitle ?? undefined} />;
          })}</List>
        </Section>;
      })}
  </>;
}
