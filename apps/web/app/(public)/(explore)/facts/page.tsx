import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { logAccessError } from "@/lib/rbac/access";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { canOpenFactsWorkspace, seesInternalDetails } from "@/lib/rbac/ui";
import { countryName, countrySlugs } from "@/lib/registry/domain";
import { likePattern } from "@/lib/education/domain";
import { otherGroup, questionGroups, readQuestionGroup, topicFilter } from "@/lib/countries/overview";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { EmptyState, Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { buttonPrimary, buttonSecondary, control, textLink } from "@/components/ui/styles";

export default async function Page({ searchParams }: PageProps<"/facts">) {
  const query = await searchParams;
  const q = searchParam(query);
  const country = typeof query.country === "string" && countrySlugs.some((s) => s === query.country) ? query.country : "";
  const group = readQuestionGroup(query.group);
  const page = pageParam(query);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  // Explicit public statuses even for editors: the public page never shows drafts.
  let request = client.from("facts").select(country ? `${factSelect},countries!inner(slug)` : factSelect, { count: "exact" })
    .in("status", ["reviewed", "conflicted"]);
  if (country) request = request.eq("countries.slug", country);
  if (q) request = request.ilike("subject", likePattern(q));
  // Same visitor-question groups as the country page (lib/countries/overview.ts).
  if (group) {
    const f = topicFilter(group);
    request = "in" in f ? request.in("topic", f.in) : request.not("topic", "in", `(${f.notIn.join(",")})`);
  }
  const { data, error, count } = await request.order("created_at", { ascending: false }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/facts", query, { page: null }));
  if (error) { logAccessError("public_facts"); throw new Error("Không tải được thông tin."); }
  const facts = (data ?? []) as unknown as FactRow[];
  const canEdit = canOpenFactsWorkspace(await viewerPermissions());
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  return <>
    <PageHeader eyebrow="Bằng chứng" title="Thông tin có bằng chứng"
      description="Mọi thông tin đã công khai, mỗi thông tin kèm trích đoạn và nguồn. Luôn kiểm tra nguồn và hiệu lực; mâu thuẫn giữa các nguồn không được tự động giải quyết."
      actions={canEdit ? <Link href="/facts/workspace" className={buttonSecondary}>Biên tập thông tin</Link> : undefined} />
    <Form action="/facts" className={filterBar}>
      <div className="sm:col-span-2"><Field label="Tìm theo đối tượng"><div className="mt-1.5"><SearchInput defaultValue={q} placeholder="Ví dụ: residence permit" /></div></Field></div>
      <Field label="Quốc gia"><select name="country" defaultValue={country} className={control}><option value="">Tất cả</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{countryName(slug, slug)}</option>)}</select></Field>
      <Field label="Chủ đề"><select name="group" defaultValue={group ?? ""} className={control}><option value="">Tất cả</option>{[...questionGroups, otherGroup].map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Lọc</button><Link href="/facts" className={`${textLink} text-[15px]`}>Bỏ lọc</Link></div>
    </Form>
    {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} internal={internal} />)}</div>
      : <EmptyState>Chưa có thông tin được công bố{q || country || group ? " cho lựa chọn này" : ""}.</EmptyState>}
    <Pagination summary={pageSummary(count ?? facts.length, page)} href={(p) => withParams("/facts", query, { page: p })} />
  </>;
}
