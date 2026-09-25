import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { crawlOutcomes, crawlReadiness, runStatuses } from "@/lib/crawler/domain";
import { Badge, Card, Disclosure, EmptyState, List, ListRow, NoAccess, Notice, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { TargetForm } from "./forms";

type Source = { id: string; name: string; canonical_url: string; crawl_enabled: boolean; crawl_policy: string; status: string };
type Target = { id: string; source_id: string; url: string; kind: string; path_prefix: string | null; max_urls: number; content_selector: string | null; active: boolean };
type State = { source_id: string; url: string; last_status: number | null; last_outcome: string | null; last_fetched_at: string | null; last_document_id: string | null };
type Run = { id: string; trigger: string; status: string; started_at: string; finished_at: string | null; note: string | null; counts: Record<string, number> | null;
  crawler_run_items: { id: string; url: string; http_status: number | null; outcome: string; error_category: string | null; flagged_facts: number; document_id: string | null }[] };
const when = (v: string | null) => v ? new Date(v).toISOString().replace("T", " ").slice(0, 16) : "chưa bao giờ";

export default async function CrawlerAdminPage() {
  const { client, permissions } = await accessContext();
  if (!permissions.includes("crawler.manage")) return <NoAccess title="Không có quyền quản lý crawler">Cần quyền crawler.manage. Nhờ quản trị viên cấp tại Người dùng & phân quyền.</NoAccess>;
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
  const bySource = sources.filter((s) => targets.some((t) => t.source_id === s.id));
  return <>
    <PageHeader eyebrow="Quản trị" title="Crawler"
      description="Crawler chỉ lấy các URL đăng ký ở đây, của nguồn đã verified, crawl policy approved và đã bật crawl. Chạy theo lịch hằng tuần (GitHub Actions) hoặc chạy tay."
      actions={<Link href="/admin/sources" className={`${textLink} text-[15px]`}>Source Registry</Link>} />
    <Notice tone="neutral">Crawler tôn trọng robots.txt, mỗi domain một request mỗi lần, nghỉ vài giây giữa các request, và không đi theo link. Văn bản trích được lưu nội bộ, không hiển thị công khai.</Notice>

    <Section title="URL đã đăng ký">
      <div className="mb-4 px-1"><Disclosure summary="Đăng ký URL mới"><Card><TargetForm sources={sources.map((s) => ({ id: s.id, label: `${s.name} — ${s.canonical_url}` }))} /></Card></Disclosure></div>
      {bySource.length ? <div className="space-y-6">{bySource.map((s) => {
        const ready = crawlReadiness(s);
        return <div key={s.id}>
          <div className="mb-2 flex flex-wrap items-center gap-2 px-1"><h3 className="text-[17px] font-semibold">{s.name}</h3><Badge tone={ready.ready ? "positive" : "caution"}>{ready.reason}</Badge></div>
          <List>{targets.filter((t) => t.source_id === s.id).map((t) => {
            const st = states.find((x) => x.url === t.url && x.source_id === s.id);
            const o = st?.last_outcome ? crawlOutcomes[st.last_outcome] : null;
            return <ListRow key={t.id} title={<span className="break-all">{t.url}</span>}
              badges={<><Badge>{t.kind === "sitemap" ? `Sitemap${t.path_prefix ? ` ${t.path_prefix}` : ""}` : "Trang"}</Badge>{!t.active && <Badge tone="caution">Tắt</Badge>}{o && <Badge tone={o.tone}>{o.label}</Badge>}</>}
              meta={`Lần lấy gần nhất: ${when(st?.last_fetched_at ?? null)}${st?.last_status ? ` · HTTP ${st.last_status}` : ""}${t.content_selector ? ` · selector ${t.content_selector}` : ""}`}>
              <div className="flex flex-wrap gap-4">
                {st?.last_document_id && <Link href={`/documents/${st.last_document_id}`} className={`${textLink} text-[13px]`}>Tài liệu mới nhất</Link>}
                <Disclosure small summary="Sửa"><TargetForm sources={[]} target={t} /></Disclosure>
              </div>
            </ListRow>;
          })}</List>
        </div>;
      })}</div> : <EmptyState>Chưa đăng ký URL nào. Crawler sẽ không lấy gì cho tới khi có URL và nguồn được bật crawl.</EmptyState>}
    </Section>

    <Section title="10 lần chạy gần nhất">
      {runs.length ? <List>{runs.map((r) => {
        const st = runStatuses[r.status] ?? runStatuses.failed;
        const summary = Object.entries(r.counts ?? {}).map(([k, n]) => `${crawlOutcomes[k]?.label ?? k}: ${n}`).join(" · ");
        const flagged = r.crawler_run_items.reduce((a, i) => a + i.flagged_facts, 0);
        return <ListRow key={r.id} title={when(r.started_at)} badges={<><Badge tone={st.tone}>{st.label}</Badge><Badge>{r.trigger}</Badge>{flagged > 0 && <Badge tone="caution">{flagged} fact cần xem lại</Badge>}</>}
          subtitle={summary || r.note || "Không có URL nào được xử lý"}>
          <Disclosure small summary={`Chi tiết ${r.crawler_run_items.length} URL`}>
            <List>{r.crawler_run_items.map((i) => <ListRow key={i.id} title={<span className="break-all text-[14px] font-normal">{i.url}</span>}
              badges={<Badge tone={crawlOutcomes[i.outcome]?.tone ?? "neutral"}>{crawlOutcomes[i.outcome]?.label ?? i.outcome}</Badge>}
              meta={[i.http_status && `HTTP ${i.http_status}`, i.error_category, i.flagged_facts ? `${i.flagged_facts} fact bị gắn cờ` : null].filter(Boolean).join(" · ") || undefined} />)}</List>
          </Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>Chưa có lần chạy nào.</EmptyState>}
    </Section>
  </>;
}
