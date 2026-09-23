import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { countrySlugs } from "@/lib/registry/domain";
import { likePattern, programmeFilters } from "@/lib/education/domain";
import { universityListSelect, type UniversityRow } from "@/lib/education/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { EmptyState, Field, List, ListRow, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";
import { hostLabel } from "../source-list";

export default async function UniversitiesPage({ searchParams }: PageProps<"/universities">) {
  const params = await searchParams;
  const { country } = programmeFilters(params);
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  let query = client.from("universities").select(universityListSelect, { count: "exact" }).eq("status", "reviewed");
  if (country) query = query.eq("countries.slug", country);
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/universities", params, { page: null }));
  if (error) { logAccessError("public_universities"); throw new Error("Không tải được danh sách trường."); }
  const universities = (data ?? []) as unknown as UniversityRow[];
  return <>
    <PageHeader eyebrow="Education" title="Universities"
      description="Each university is listed only after an operator reviewed a source document showing it exists. Inclusion is not a ranking or recommendation." />
    <Form action="/universities" className={filterBar}>
      <div className="sm:col-span-2"><Field label="Search"><div className="mt-1.5"><SearchInput defaultValue={q} placeholder="University name" /></div></Field></div>
      <Field label="Country"><select name="country" defaultValue={country} className={control}><option value="">All countries</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{slug[0].toUpperCase() + slug.slice(1)}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Apply</button><Link href="/universities" className={`${textLink} text-[15px]`}>Reset</Link></div>
    </Form>
    {universities.length
      ? <List label="Universities">{universities.map((u) => <ListRow key={u.id} href={`/universities/${u.id}`} title={u.name}
          subtitle={`${u.countries.name} · ${hostLabel(u.official_url) ?? u.official_url}`} />)}</List>
      : <EmptyState>No reviewed universities for this selection yet. None are generated or inferred.</EmptyState>}
    <Pagination summary={pageSummary(count ?? universities.length, page)} href={(p) => withParams("/universities", params, { page: p })} />
  </>;
}
