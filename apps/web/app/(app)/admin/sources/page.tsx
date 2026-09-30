import Link from "next/link";
import { accessContext } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { listCountries, searchSources, sourceStatusCounts } from "@/lib/registry/queries";
import { crawlPolicyLabels, dateLabel, verificationLabel, type crawlPolicies } from "@/lib/registry/domain";
import { uuidPattern } from "@/lib/documents/domain";
import { selectItem } from "@/lib/review/selection";
import { choiceParam, pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { Badge, EmptyState, ExternalLink, NoAccess, PageHeader, SearchInput, Section, Segmented } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { SplitList, SplitPager, SplitRow, SplitView } from "@/components/review/split-view";
import { SourceForm } from "./forms";

// "Needs verification" first: that is the work queue for an operator.
const tabs = [["needs_verification", "Cần xác minh"], ["review_required", "Cần xem lại"], ["verified", "Đã xác minh"], ["all", "Tất cả"]] as const;
const host = (url: string) => { try { return new URL(url).host; } catch { return url; } };

// Split view (components/review/split-view.tsx), like the review queue: the
// list stays in view, one source is edited on the right. ?source=<id> selects
// a source, ?new=1 opens the "new source" form in the same pane.
export default async function AdminSourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  const { permissions } = await accessContext();
  if (!permissions.includes("sources.manage")) {
    return <NoAccess title="Không có quyền quản lý nguồn">{`Cần quyền “${permissionName("sources.manage")}”. Nhờ quản trị viên cấp ở trang Người dùng & phân quyền.`}</NoAccess>;
  }
  const params = await searchParams;
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "needs_verification");
  const q = searchParam(params);
  const page = pageParam(params);
  const creating = params.new === "1";
  const [{ rows, total }, countries, counts] = await Promise.all([
    searchSources({ q, status: status === "all" ? "" : status }, page),
    listCountries(),
    sourceStatusCounts(),
  ]);
  const countOf = (s: string) => s === "all" ? counts.reduce((n, c) => n + c._count._all, 0) : counts.find((c) => c.status === s)?._count._all ?? 0;
  const requested = typeof params.source === "string" && uuidPattern.test(params.source) ? params.source : undefined;
  // After saving, a source may move to another tab (e.g. to "Đã xác minh"); the
  // first remaining one then opens, like the review queue.
  const selection = selectItem(rows.map((r) => r.id), requested);
  const current = creating ? null : selection.index >= 0 ? rows[selection.index] : null;
  const base = withParams("/admin/sources", params, { source: null, new: null });

  return <>
    <PageHeader eyebrow="Quản trị" title="Nguồn (Source Registry)"
      description="Đăng ký, phân loại và xác minh các trang web mà Nordic lấy thông tin. Mọi thay đổi được ghi nhật ký. Đăng ký một nguồn không có nghĩa là nội dung của nó đã được kiểm chứng."
      actions={<><Link href="/sources" className={`${textLink} text-[15px]`}>Xem trang công khai</Link>
        <Link href={withParams("/admin/sources", params, { new: "1", source: null })} scroll={false} className={buttonPrimary}>Thêm nguồn mới</Link></>} />
    <Section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Trạng thái" items={tabs.map(([value, label]) => ({ href: withParams("/admin/sources", { q }, { status: value === "needs_verification" ? null : value }), label, count: countOf(value), active: status === value }))} />
        <form action="/admin/sources" className="mb-5 w-full sm:w-72">{status !== "needs_verification" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder="Tìm theo tên hoặc URL" /></form>
      </div>
      {rows.length || creating ? <SplitView detailKey={creating ? "new" : current?.id} paneScroll={false} detailOnMobile={creating || !!requested} backHref={base}
        list={rows.length ? <SplitList label="Danh sách nguồn" footer={<SplitPager summary={pageSummary(total, page)} href={(p) => withParams("/admin/sources", params, { page: p, source: null, new: null })} />}>
          {rows.map((s) => <SplitRow key={s.id} href={withParams("/admin/sources", params, { source: s.id, new: null })} selected={s.id === current?.id} explicit={!!requested}
            title={s.name} subtitle={`${host(s.canonicalUrl)} · ${s.country?.name ?? "Chưa gán quốc gia"}`}
            badges={<><TierBadge tier={s.sourceTier} /><SourceStatusBadge status={s.status}>{verificationLabel(s.status, s.lastVerifiedAt)}</SourceStatusBadge>{s.crawlEnabled && <Badge tone="accent">Đang crawl</Badge>}</>} />)}
        </SplitList> : <p className="p-5 text-[15px] text-ink-2">Không có nguồn nào trong nhóm này.</p>}
        detail={creating
          ? <><h2 className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">Thêm nguồn mới</h2><SourceForm countries={countries} /></>
          : current && <>
            <div className="mb-4 px-1">
              <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{current.name}</h2>
              <p className="mt-1 text-[15px]"><ExternalLink href={current.canonicalUrl} quiet>{current.canonicalUrl}</ExternalLink></p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TierBadge tier={current.sourceTier} />
                <SourceStatusBadge status={current.status}>{verificationLabel(current.status, current.lastVerifiedAt)}</SourceStatusBadge>
                <Badge>{`Crawl: ${crawlPolicyLabels[current.crawlPolicy as (typeof crawlPolicies)[number]] ?? current.crawlPolicy}${current.crawlEnabled ? " · đang bật" : ""}`}</Badge>
                <span className="text-[13px] text-ink-3">Xác minh gần nhất: {dateLabel(current.lastVerifiedAt)}</span>
              </div>
            </div>
            <SourceForm source={current} countries={countries} />
          </>} />
        : <EmptyState>Không có nguồn nào trong nhóm này.{q ? ` (tìm “${q}”)` : ""}</EmptyState>}
    </Section>
  </>;
}
