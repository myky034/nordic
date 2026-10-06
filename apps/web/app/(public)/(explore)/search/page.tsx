import Link from "next/link";
import Form from "next/form";
import { createPublicClient } from "@/lib/supabase/public";
import { logAccessError } from "@/lib/rbac/access";
import { searchParam } from "@/lib/pagination";
import { groupHits, hitHref, searchGroupLabel, seeAllHref, type SearchEntity, type SearchHit } from "@/lib/search/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
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
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.search;
  return <>
    <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <Form action="/search" className="mb-10 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder={t.placeholder} /></div>
      <button className={buttonPrimary}>{t.submit}</button>
    </Form>
    {!q ? <EmptyState>{t.hint}</EmptyState>
      : !groups.length ? <EmptyState title={t.noResultsTitle(q)}>{t.noResults}</EmptyState>
      : groups.map((g) => {
        const all = seeAllHref(g.type, q);
        const label = searchGroupLabel(g.type as SearchEntity, locale);
        return <Section key={g.type} title={<>{label} <span className="text-[15px] font-normal text-ink-3">{g.total}</span></>}
          actions={all && g.total > g.hits.length ? <Link href={all} className={`${textLink} text-[15px]`}>{dict.common.seeAll}</Link> : undefined}>
          <List label={label}>{g.hits.map((h) => {
            const href = hitHref(h);
            return <ListRow key={`${h.entity_type}-${h.id}`} href={href ?? undefined} title={h.title} subtitle={h.subtitle ?? undefined} />;
          })}</List>
        </Section>;
      })}
  </>;
}
