import Link from "next/link";
import Form from "next/form";
import { searchSources } from "@/lib/registry/queries";
import { countryName, countrySlugs, registryFilters, sourceStatusLabels, sourceStatuses, tiers } from "@/lib/registry/domain";
import { pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";
import { SourceList } from "../source-list";

export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const query = await searchParams;
  const filters = registryFilters(query);
  const q = searchParam(query);
  const page = pageParam(query);
  const { rows, total } = await searchSources(query, page);
  return <>
    <PageHeader eyebrow="Bằng chứng" title="Nguồn"
      description="Các trang web mà Nordic lấy thông tin. Việc đăng ký và mức độ (tier) chỉ cho biết ai xuất bản nguồn, không chứng minh mọi câu trên đó đều đúng. Chi tiết chưa kiểm tra được ghi là chưa có." />
    <Form action="/sources" className={filterBar}>
      <div className="sm:col-span-2 lg:col-span-4"><SearchInput defaultValue={q} placeholder="Tên hoặc URL" /></div>
      <Field label="Quốc gia"><select name="country" defaultValue={filters.country} className={control}><option value="">Tất cả quốc gia</option><option value="unassigned">Chưa gán quốc gia</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{countryName(slug, slug)}</option>)}</select></Field>
      <Field label="Mức độ nguồn (tier)"><select name="tier" defaultValue={filters.tier} className={control}><option value="">Tất cả mức</option><option value="unknown">Chưa phân loại</option>{Object.entries(tiers).map(([tier, label]) => <option key={tier} value={tier}>{tier} · {label}</option>)}</select></Field>
      <Field label="Trạng thái xác minh"><select name="status" defaultValue={filters.status} className={control}><option value="">Tất cả trạng thái</option>{sourceStatuses.map((status) => <option key={status} value={status}>{sourceStatusLabels[status]}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Lọc</button><Link href="/sources" className={`${textLink} text-[15px]`}>Bỏ lọc</Link></div>
    </Form>
    <SourceList sources={rows} />
    <Pagination summary={pageSummary(total, page)} href={(p) => withParams("/sources", query, { page: p })} />
  </>;
}
