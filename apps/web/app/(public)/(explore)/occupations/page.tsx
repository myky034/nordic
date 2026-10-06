import Form from "next/form";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { likePattern } from "@/lib/education/domain";
import { classificationLabel } from "@/lib/labour/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { countryName } from "@/lib/registry/domain";
import { occupationListSelect, type OccupationListRow } from "@/lib/labour/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { Badge, EmptyState, List, ListRow, Notice, PageHeader, Pagination, SearchInput } from "@/components/ui";
import { buttonPrimary } from "@/components/ui/styles";

export default async function OccupationsPage({ searchParams }: PageProps<"/occupations">) {
  const params = await searchParams;
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  // Explicit "reviewed" filter so editors (who see drafts via RLS) get the public view.
  let query = client.from("occupations").select(occupationListSelect, { count: "exact" }).eq("status", "reviewed");
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/occupations", params, { page: null }));
  if (error) { logAccessError("public_occupations"); throw new Error("Không tải được danh sách nghề."); }
  const occupations = (data ?? []) as unknown as OccupationListRow[];
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.occupations, dict.common];
  return <>
    <PageHeader eyebrow={c.workVisa} title={t.title} description={t.description} />
    <div className="-mt-4 mb-8"><Notice tone="neutral">{t.note}</Notice></div>
    <Form action="/occupations" className="mb-6 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder={t.namePlaceholder} /></div>
      <button className={buttonPrimary}>{t.find}</button>
    </Form>
    {occupations.length
      ? <List label={t.title}>{occupations.map((o) => <ListRow key={o.id} href={`/occupations/${o.id}`} title={o.name}
          badges={o.classification_code ? <Badge>{classificationLabel(o.classification_system, o.classification_code, locale)}</Badge> : undefined}
          subtitle={o.countries ? t.definitionFor(countryName(o.countries.slug, o.countries.name, locale)) : t.international} />)}</List>
      : <EmptyState>{q ? t.noMatch(q) : t.empty}</EmptyState>}
    <Pagination summary={pageSummary(count ?? occupations.length, page)} href={(p) => withParams("/occupations", params, { page: p })} locale={locale} />
  </>;
}
