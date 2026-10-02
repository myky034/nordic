import Link from "next/link";
import Form from "next/form";
import { getSource, searchSources } from "@/lib/registry/queries";
import { canonicalSourceUrl, countryName, countrySlugs, registryFilters, sourceStatusLabels, sourceStatuses, tiers, verificationLabel } from "@/lib/registry/domain";
import { pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { savedState } from "@/lib/workspace/saved";
import { EmptyState, Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { SaveButton } from "@/components/save-button";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";
import { hostLabel } from "../source-list";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { SourceDetails } from "./source-details";

// Sources as a table; a row opens the source in the slide-over Inspector
// (?source=<id>) so the list, its filters and its page stay where they were.
// /sources/[id] remains the shareable page of a source.
export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const query = await searchParams;
  const filters = registryFilters(query);
  const q = searchParam(query);
  const page = pageParam(query);
  const openId = typeof query.source === "string" ? query.source : null;
  // getSource() rejects anything that is not a UUID, so a junk ?source= opens nothing.
  const [{ rows, total }, open] = await Promise.all([searchSources(query, page), openId ? getSource(openId) : Promise.resolve(null)]);
  const save = open ? await savedState("source", open.id) : null;
  const here = (change: Record<string, string | number | null>) => withParams("/sources", query, change);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
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
    <DataTable label="Nguồn" minWidth="52rem" columns={[{ label: "Tên nguồn" }, { label: "Mức độ" }, { label: "Xác minh" }, { label: "Quốc gia" }, { label: "Tên miền" }]}
      empty={!rows.length && <EmptyState>Không có nguồn nào khớp lựa chọn này. Phạm vi quốc gia không được suy đoán từ các URL ban đầu.</EmptyState>}>
      {rows.map((s) => <DataRow key={s.id} href={here({ source: s.id })} selected={s.id === open?.id} title={<span className="block min-w-[14rem]">{s.name}</span>}>
        <Cell className="whitespace-nowrap"><TierBadge tier={s.sourceTier} /></Cell>
        {/* Short label here; the Inspector shows the full verification wording. */}
        <Cell className="whitespace-nowrap"><SourceStatusBadge status={s.status}>{sourceStatusLabels[s.status as keyof typeof sourceStatusLabels] ?? s.status}</SourceStatusBadge></Cell>
        <Cell className="whitespace-nowrap">{s.country ? countryName(s.country.slug, s.country.name) : <span className="text-ink-3">Chưa gán</span>}</Cell>
        <Cell className="whitespace-nowrap">{hostLabel(canonicalSourceUrl(s.canonicalUrl)) ?? <span className="text-ink-3">Cần xác minh URL</span>}</Cell>
      </DataRow>)}
    </DataTable>
    <Pagination summary={pageSummary(total, page)} href={(p) => here({ page: p, source: null })} />
    {open && <Inspector title={open.name} subtitle={hostLabel(canonicalSourceUrl(open.canonicalUrl)) ?? undefined} closeHref={here({ source: null })}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TierBadge tier={open.sourceTier} />
        <SourceStatusBadge status={open.status}>{verificationLabel(open.status, open.lastVerifiedAt)}</SourceStatusBadge>
        <span className="ml-auto flex items-center gap-3">
          {save && <SaveButton kind="source" id={open.id} signedIn={save.signedIn} initialSaved={save.saved} />}
        </span>
      </div>
      <SourceDetails source={open} compact internal={internal} />
      <p className="mt-6 px-1 text-[14px]"><Link href={`/sources/${open.id}`} className={textLink}>Mở trang riêng của nguồn này</Link> <span className="text-ink-3">(để chia sẻ liên kết)</span></p>
    </Inspector>}
  </>;
}
