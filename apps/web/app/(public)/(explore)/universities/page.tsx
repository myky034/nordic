import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { countryName, countrySlugs } from "@/lib/registry/domain";
import { likePattern, programmeFilters } from "@/lib/education/domain";
import { universityListSelect, type UniversityRow } from "@/lib/education/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { Chevron, EmptyState, Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { TierBadge } from "@/components/ui/badges";
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
    <PageHeader eyebrow="Du học" title="Trường đại học"
      description="Mỗi trường chỉ xuất hiện sau khi được đối chiếu với một tài liệu nguồn chứng minh trường đó tồn tại. Có mặt trong danh sách không phải là xếp hạng hay lời khuyên." />
    <Form action="/universities" className={filterBar}>
      <div className="sm:col-span-2"><Field label="Tìm kiếm"><div className="mt-1.5"><SearchInput defaultValue={q} placeholder="Tên trường" /></div></Field></div>
      <Field label="Quốc gia"><select name="country" defaultValue={country} className={control}><option value="">Tất cả quốc gia</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{countryName(slug, slug)}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Lọc</button><Link href="/universities" className={`${textLink} text-[15px]`}>Bỏ lọc</Link></div>
    </Form>
    {/* Card grid (pattern 5 in /dev/preview/patterns): a visitor scans and picks. */}
    {universities.length
      ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{universities.map((u) => <Link key={u.id} href={`/universities/${u.id}`}
          className="group flex flex-col rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{countryName(u.countries.slug, u.countries.name)}</p>
          <h2 className="mt-1 text-[18px] font-semibold leading-snug text-ink">{u.name}</h2>
          <p className="mt-2 truncate text-[14px] text-ink-2">{hostLabel(u.official_url) ?? u.official_url}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[14px]">
            <span className="flex items-center gap-2 text-[12px] text-ink-3">Nguồn <TierBadge tier={u.documents.sources.source_tier} /></span>
            <span className="inline-flex items-center gap-1 font-medium text-accent">Xem chi tiết<Chevron className="text-accent transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>)}</div>
      : <EmptyState>Chưa có trường nào đã duyệt cho lựa chọn này. Không có trường nào được tự tạo hay suy đoán.</EmptyState>}
    <Pagination summary={pageSummary(count ?? universities.length, page)} href={(p) => withParams("/universities", params, { page: p })} />
  </>;
}
