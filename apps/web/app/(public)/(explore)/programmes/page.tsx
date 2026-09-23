import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { countrySlugs } from "@/lib/registry/domain";
import { degreeLabel, degreeTypes, likePattern, programmeFilters } from "@/lib/education/domain";
import { programmeListSelect, type ProgrammeListRow } from "@/lib/education/view";
import { Badge, EmptyState, Field, List, ListRow, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";

export default async function ProgrammesPage({ searchParams }: PageProps<"/programmes">) {
  const params = await searchParams;
  const filters = programmeFilters(params);
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  // Public read path: Supabase client + RLS, plus explicit "reviewed" filters so
  // editors (who can see drafts through RLS) still get the public view here.
  let query = client.from("programmes").select(programmeListSelect, { count: "exact" })
    .eq("status", "reviewed").eq("universities.status", "reviewed");
  if (filters.country) query = query.eq("universities.countries.slug", filters.country);
  if (filters.degree) query = query.eq("degree_type", filters.degree);
  if (filters.university) query = query.eq("university_id", filters.university);
  if (filters.field) query = query.ilike("field", likePattern(filters.field));
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/programmes", params, { page: null }));
  if (error) { logAccessError("public_programmes"); throw new Error("Không tải được danh sách chương trình."); }
  const programmes = (data ?? []) as unknown as ProgrammeListRow[];
  return <>
    <PageHeader eyebrow="Education" title="Programmes"
      description="Only programmes whose existence was reviewed against a source document appear here. Tuition and deadlines are shown on each programme only when an evidence-backed fact exists." />
    {/* next/form: a GET form that updates search params with client-side navigation (no full page reload). */}
    <Form action="/programmes" className={filterBar}>
      <div className="sm:col-span-2 lg:col-span-4"><SearchInput defaultValue={q} placeholder="Search programme names" /></div>
      <Field label="Country"><select name="country" defaultValue={filters.country} className={control}><option value="">All countries</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{slug[0].toUpperCase() + slug.slice(1)}</option>)}</select></Field>
      <Field label="Degree"><select name="degree" defaultValue={filters.degree} className={control}><option value="">All degrees</option>{Object.entries(degreeTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Field contains"><input name="field" defaultValue={filters.field} maxLength={100} placeholder="e.g. computer" className={control} /></Field>
      {filters.university && <input type="hidden" name="university" value={filters.university} />}
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Apply</button><Link href="/programmes" className={`${textLink} text-[15px]`}>Reset</Link></div>
    </Form>
    {programmes.length
      ? <List label="Programmes">{programmes.map((p) => <ListRow key={p.id} href={`/programmes/${p.id}`} title={p.name}
          badges={<Badge tone="accent">{degreeLabel(p.degree_type)}</Badge>}
          subtitle={`${p.universities.name} · ${p.universities.countries.name} · ${p.field ?? "Field not stated"} · ${p.language ?? "Language not stated"}`} />)}</List>
      : <EmptyState>No reviewed programmes match this selection yet. Programmes are entered from source documents by operators — none are generated or inferred.</EmptyState>}
    <Pagination summary={pageSummary(count ?? programmes.length, page)} href={(p) => withParams("/programmes", params, { page: p })} />
  </>;
}
