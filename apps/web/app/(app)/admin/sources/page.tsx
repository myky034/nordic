import Link from "next/link";
import { accessContext } from "@/lib/rbac/access";
import { listCountries, searchSources, sourceStatusCounts } from "@/lib/registry/queries";
import { verificationLabel } from "@/lib/registry/domain";
import { choiceParam, pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { Badge, Card, Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, SearchInput, Section, Segmented } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";
import { SourceForm } from "./forms";

// "Needs verification" first: that is the work queue for an operator.
const tabs = [["needs_verification", "Cần xác minh"], ["review_required", "Cần xem lại"], ["verified", "Đã xác minh"], ["all", "Tất cả"]] as const;

export default async function AdminSourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  const { permissions } = await accessContext();
  if (!permissions.includes("sources.manage")) {
    return <NoAccess title="Không có quyền quản lý Source Registry">Cần quyền sources.manage. Nhờ quản trị viên cấp tại Người dùng & phân quyền.</NoAccess>;
  }
  const params = await searchParams;
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "needs_verification");
  const q = searchParam(params);
  const page = pageParam(params);
  const [{ rows, total }, countries, counts] = await Promise.all([
    searchSources({ q, status: status === "all" ? "" : status }, page),
    listCountries(),
    sourceStatusCounts(),
  ]);
  const countOf = (s: string) => s === "all" ? counts.reduce((n, c) => n + c._count._all, 0) : counts.find((c) => c.status === s)?._count._all ?? 0;
  return <>
    <PageHeader eyebrow="Quản trị" title="Source Registry"
      description="Thêm/sửa nguồn và kiểm soát crawl. Mọi thay đổi được ghi nhật ký. Đăng ký nguồn không xác minh nội dung của nó."
      actions={<Link href="/sources" className={`${textLink} text-[15px]`}>Xem trang công khai</Link>} />
    <Disclosure summary="Thêm nguồn mới"><Card><SourceForm countries={countries} /></Card></Disclosure>
    <Section title="Nguồn">
      <Segmented label="Trạng thái" items={tabs.map(([value, label]) => ({ href: withParams("/admin/sources", { q }, { status: value === "needs_verification" ? null : value }), label, count: countOf(value), active: status === value }))} />
      <form action="/admin/sources" className="mb-5">{status !== "needs_verification" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder="Tìm theo tên hoặc URL" /></form>
      {rows.length ? <List>{rows.map((source) => <ListRow key={source.id} title={source.name}
        badges={<><TierBadge tier={source.sourceTier} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt)}</SourceStatusBadge>{source.crawlEnabled && <Badge tone="accent">Crawl on</Badge>}</>}
        subtitle={`${source.canonicalUrl} · ${source.country?.name ?? "Chưa gán quốc gia"} · policy ${source.crawlPolicy.replaceAll("_", " ")}`}>
        <Disclosure small summary="Chỉnh sửa"><SourceForm source={source} countries={countries} /></Disclosure>
      </ListRow>)}</List> : <EmptyState>Không có nguồn nào trong nhóm này.</EmptyState>}
      <Pagination summary={pageSummary(total, page)} href={(p) => withParams("/admin/sources", params, { page: p })} />
    </Section>
  </>;
}
