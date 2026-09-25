import Form from "next/form";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { likePattern } from "@/lib/education/domain";
import { classificationLabel } from "@/lib/labour/domain";
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
  return <>
    <PageHeader eyebrow="Labour market" title="Occupations"
      description="Occupations whose definition was reviewed against a source. Salary, demand and other figures appear on each occupation only with evidence, a country and a reference period." />
    <div className="-mt-4 mb-8"><Notice tone="neutral">Figures describe a past reference period. They are research information, not a forecast, a salary offer or career advice.</Notice></div>
    <Form action="/occupations" className="mb-6 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder="Search occupations" /></div>
      <button className={buttonPrimary}>Search</button>
    </Form>
    {occupations.length
      ? <List label="Occupations">{occupations.map((o) => <ListRow key={o.id} href={`/occupations/${o.id}`} title={o.name}
          badges={o.classification_code ? <Badge>{classificationLabel(o.classification_system, o.classification_code)}</Badge> : undefined}
          subtitle={o.countries ? `Defined for ${o.countries.name}` : "International definition"} />)}</List>
      : <EmptyState>{q ? `No reviewed occupations match “${q}”.` : "No reviewed occupations yet. Occupations are entered from source documents by operators — none are generated."}</EmptyState>}
    <Pagination summary={pageSummary(count ?? occupations.length, page)} href={(p) => withParams("/occupations", params, { page: p })} />
  </>;
}
