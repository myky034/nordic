import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { crawlOutcomes, crawlReadiness, runStatuses } from "@/lib/crawler/domain";
import { triggerLabel } from "@/lib/runs";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { Badge, EmptyState, List, ListRow, NoAccess, Notice, PageHeader, Segmented } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { TargetForm } from "./forms";

type Source = { id: string; name: string; canonical_url: string; crawl_enabled: boolean; crawl_policy: string; status: string };
type Target = { id: string; source_id: string; url: string; kind: string; path_prefix: string | null; max_urls: number; content_selector: string | null; active: boolean };
type State = { source_id: string; url: string; last_status: number | null; last_outcome: string | null; last_fetched_at: string | null; last_document_id: string | null };
type Run = { id: string; trigger: string; status: string; started_at: string; finished_at: string | null; note: string | null; counts: Record<string, number> | null;
  crawler_run_items: { id: string; url: string; http_status: number | null; outcome: string; error_category: string | null; flagged_facts: number; document_id: string | null }[] };
const when = (v: string | null) => v ? new Date(v).toISOString().replace("T", " ").slice(0, 16) : "chưa bao giờ";

// Two tabs (?tab=urls|runs), each a table; a row opens the slide-over
// Inspector (?target=, ?run=, or ?new=1 to register a URL), the same pattern
// as /admin/access.
export default async function CrawlerAdminPage({ searchParams }: PageProps<"/admin/crawler">) {
  const { client, permissions } = await accessContext();
  if (!permissions.includes("crawler.manage")) return <NoAccess title="Không có quyền quản lý crawler">{`Cần quyền “${permissionName("crawler.manage")}”. Nhờ quản trị viên cấp ở trang Người dùng & phân quyền.`}</NoAccess>;
  const params = await searchParams;
  const tab = params.tab === "runs" ? "runs" : "urls";
  const results = await Promise.all([
    client.from("sources").select("id,name,canonical_url,crawl_enabled,crawl_policy,status").order("name"),
    client.from("crawl_targets").select("id,source_id,url,kind,path_prefix,max_urls,content_selector,active").order("url"),
    client.from("crawl_url_states").select("source_id,url,last_status,last_outcome,last_fetched_at,last_document_id"),
    client.from("crawler_runs").select("id,trigger,status,started_at,finished_at,note,counts,crawler_run_items(id,url,http_status,outcome,error_category,flagged_facts,document_id)").order("started_at", { ascending: false }).limit(10),
  ]);
  if (results.some((r) => r.error)) { logAccessError("crawler_admin"); throw new Error("Không tải được dữ liệu crawler."); }
  const sources = results[0].data as Source[];
  const targets = results[1].data as Target[];
  const states = results[2].data as State[];
  const runs = results[3].data as unknown as Run[];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const stateOf = (t: Target) => states.find((x) => x.url === t.url && x.source_id === t.source_id);
  const here = (change: Record<string, string | null>) => withParams("/admin/crawler", params, change);
  const id = (k: string) => typeof params[k] === "string" && uuidPattern.test(params[k] as string) ? params[k] as string : undefined;

  let body: React.ReactNode;
  let panel: React.ReactNode = null;
  if (tab === "urls") {
    const sort = readSort(["source", "fetched"] as const, params.sort, params.dir, "source");
    const rows = sortRows(targets, (t) => sort.key === "source" ? sourceById.get(t.source_id)?.name : stateOf(t)?.last_fetched_at ?? null, sort.dir);
    const header = (key: "source" | "fetched", label: string) => ({ label, sorted: sort.key === key ? sort.dir : null, sortHref: here({ sort: key, dir: nextDir(sort, key) }) });
    body = <>
      <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", target: null })} className={buttonPrimary}>Đăng ký URL mới</Link></div>
      <DataTable label="URL theo dõi" minWidth="52rem" columns={[{ label: "URL" }, header("source", "Nguồn"), { label: "Loại" }, { label: "Lần gần nhất" }, header("fetched", "Lấy lúc")]}
        empty={!targets.length && <EmptyState>Chưa đăng ký URL nào. Crawler sẽ không lấy gì cho tới khi có URL và nguồn được bật crawl.</EmptyState>}>
        {rows.map((t) => {
          const s = sourceById.get(t.source_id);
          const ready = s ? crawlReadiness(s) : null;
          const st = stateOf(t);
          const o = st?.last_outcome ? crawlOutcomes[st.last_outcome] : null;
          return <DataRow key={t.id} href={here({ target: t.id, new: null })} selected={t.id === id("target")} title={<span className="break-all">{t.url}</span>}>
            <Cell>{s?.name ?? "—"}{ready && !ready.ready && <span className="block text-[12px] text-caution">{ready.reason}</span>}</Cell>
            <Cell><span className="flex flex-wrap gap-1.5"><Badge>{t.kind === "sitemap" ? "Sitemap" : "Trang"}</Badge>{!t.active && <Badge tone="caution">Tắt</Badge>}</span></Cell>
            <Cell>{o ? <Badge tone={o.tone}>{o.label}</Badge> : <span className="text-ink-3">—</span>}</Cell>
            <Cell className="whitespace-nowrap tabular-nums">{when(st?.last_fetched_at ?? null)}</Cell>
          </DataRow>;
        })}
      </DataTable>
    </>;
    const open = targets.find((t) => t.id === id("target"));
    if (params.new === "1") panel = <Inspector title="Đăng ký URL mới" closeHref={here({ new: null })}>
      <TargetForm sources={sources.map((s) => ({ id: s.id, label: `${s.name} — ${s.canonical_url}` }))} />
    </Inspector>;
    else if (open) {
      const s = sourceById.get(open.source_id);
      const st = stateOf(open);
      const ready = s ? crawlReadiness(s) : null;
      panel = <Inspector title={<span className="break-all">{open.url}</span>} subtitle={s?.name} closeHref={here({ target: null })}>
        <div className="mb-5 space-y-3">
          {ready && <Notice tone={ready.ready ? "positive" : "caution"}>{ready.reason}</Notice>}
          <p className="text-[15px] text-ink-2">Lần lấy gần nhất: {when(st?.last_fetched_at ?? null)}{st?.last_status ? ` · mã HTTP ${st.last_status}` : ""}
            {st?.last_document_id && <> · <Link href={`/documents/${st.last_document_id}`} className={textLink}>Tài liệu mới nhất</Link></>}</p>
        </div>
        <TargetForm sources={[]} target={open} />
      </Inspector>;
    }
  } else {
    const flaggedOf = (r: Run) => r.crawler_run_items.reduce((a, i) => a + i.flagged_facts, 0);
    body = <DataTable label="Lần chạy" minWidth="48rem" columns={[{ label: "Bắt đầu (UTC)" }, { label: "Trạng thái" }, { label: "Cách chạy" }, { label: "Kết quả" }, { label: "Cần xem lại", className: "text-right" }]}
      empty={!runs.length && <EmptyState>Chưa có lần chạy nào.</EmptyState>}>
      {runs.map((r) => {
        const st = runStatuses[r.status] ?? runStatuses.failed;
        const summary = Object.entries(r.counts ?? {}).map(([k, n]) => `${crawlOutcomes[k]?.label ?? k}: ${n}`).join(" · ");
        const flagged = flaggedOf(r);
        return <DataRow key={r.id} href={here({ run: r.id })} selected={r.id === id("run")} title={<span className="tabular-nums">{when(r.started_at)}</span>}>
          <Cell><Badge tone={st.tone}>{st.label}</Badge></Cell>
          <Cell>{triggerLabel(r.trigger)}</Cell>
          <Cell className="max-w-72 truncate">{summary || r.note || "Không có URL nào được xử lý"}</Cell>
          <Cell className="text-right tabular-nums">{flagged ? <Badge tone="caution">{flagged} thông tin</Badge> : "0"}</Cell>
        </DataRow>;
      })}
    </DataTable>;
    const open = runs.find((r) => r.id === id("run"));
    if (open) {
      const st = runStatuses[open.status] ?? runStatuses.failed;
      panel = <Inspector title={`Lần chạy ${when(open.started_at)} UTC`} subtitle={`${st.label} · ${triggerLabel(open.trigger)}`} closeHref={here({ run: null })}>
        {open.note && <p className="mb-4 text-[15px] text-ink-2">{open.note}</p>}
        <p className="mb-3 text-[13px] text-ink-3">“Thông tin cần xem lại”: trang nguồn của thông tin đã công bố vừa đổi; người duyệt xử lý ở tab “Nguồn đã đổi” của trang Thông tin & bằng chứng.</p>
        {open.crawler_run_items.length ? <List label="URL đã xử lý">{open.crawler_run_items.map((i) => <ListRow key={i.id} title={<span className="break-all text-[14px] font-normal">{i.url}</span>}
          href={i.document_id ? `/documents/${i.document_id}` : undefined}
          badges={<Badge tone={crawlOutcomes[i.outcome]?.tone ?? "neutral"}>{crawlOutcomes[i.outcome]?.label ?? i.outcome}</Badge>}
          meta={[i.http_status && `HTTP ${i.http_status}`, i.error_category, i.flagged_facts ? `${i.flagged_facts} thông tin cần xem lại` : null].filter(Boolean).join(" · ") || undefined} />)}</List>
          : <EmptyState>Lần chạy này không xử lý URL nào.</EmptyState>}
      </Inspector>;
    }
  }

  return <>
    <PageHeader eyebrow="Quản trị" title="Crawler"
      description="Crawler tự động lấy lại các trang đã đăng ký ở đây để phát hiện thay đổi. Chỉ lấy trang của nguồn đã xác minh, có chính sách “Được phép crawl” và đã bật crawl. Chạy hằng tuần theo lịch, hoặc chạy tay."
      actions={<Link href="/admin/sources" className={`${textLink} text-[15px]`}>Quản lý nguồn</Link>} />
    <div className="mb-6"><Notice tone="neutral">Crawler tôn trọng robots.txt, mỗi lần chỉ gửi một yêu cầu tới một trang web, nghỉ vài giây giữa các yêu cầu và không tự đi theo liên kết. Văn bản lấy được chỉ lưu nội bộ, không hiển thị công khai.</Notice></div>
    <Segmented label="Phần" items={[{ href: withParams("/admin/crawler", {}, {}), label: "URL theo dõi", count: targets.length, active: tab === "urls" },
      { href: withParams("/admin/crawler", {}, { tab: "runs" }), label: "Lần chạy", active: tab === "runs" }]} />
    <div className="mt-1">{body}</div>
    {panel}
  </>;
}
