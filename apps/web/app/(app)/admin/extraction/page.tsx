import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { itemOutcomes, reasonLabel, requestStatuses, runStatuses } from "@/lib/extraction/domain";
import { triggerLabel } from "@/lib/runs";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { Badge, Card, EmptyState, List, ListRow, NoAccess, Notice, PageHeader, Segmented } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { textLink } from "@/components/ui/styles";
import { AccountForm } from "./forms";

type Request = { id: string; document_id: string; status: string; note: string | null; created_at: string; documents: { title: string | null; canonical_url: string } | null };
type Item = { id: string; outcome: string; reason: string | null; fact_id: string | null; candidate: { subject?: string; predicate?: string; value?: string } };
type Run = { id: string; trigger: string; provider: string; model: string; prompt_version: string; status: string; started_at: string; note: string | null;
  input_tokens: number; output_tokens: number; counts: Record<string, number> | null; extraction_items: Item[] };
const when = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);
const n = (v: number) => v.toLocaleString("vi-VN");

// Tabs (?tab=requests|runs|settings): open requests and runs are tables; a run
// opens in the slide-over Inspector (?run=) with every candidate and, for a
// refused one, the reason explained in Vietnamese. Settings (the AI account)
// is for administrators only.
export default async function ExtractionAdminPage({ searchParams }: PageProps<"/admin/extraction">) {
  const { client, permissions } = await accessContext();
  const editor = permissions.includes("facts.propose") || permissions.includes("facts.review");
  const admin = permissions.includes("roles.manage");
  if (!editor && !admin) return <NoAccess title="Không có quyền xem trích xuất AI">{`Cần quyền “${permissionName("facts.propose")}” hoặc “${permissionName("facts.review")}”.`}</NoAccess>;
  const params = await searchParams;
  const tab = params.tab === "runs" ? "runs" : params.tab === "settings" && admin ? "settings" : "requests";
  const results = await Promise.all([
    client.from("extraction_settings").select("ai_user_id,updated_at").maybeSingle(),
    client.from("extraction_requests").select("id,document_id,status,note,created_at,documents(title,canonical_url)").in("status", ["pending", "running"]).order("created_at"),
    client.from("extraction_runs").select("id,trigger,provider,model,prompt_version,status,started_at,note,input_tokens,output_tokens,counts,extraction_items(id,outcome,reason,fact_id,candidate)")
      .order("started_at", { ascending: false }).limit(10),
  ]);
  if (results.some((r) => r.error)) { logAccessError("extraction_admin"); throw new Error("Không tải được dữ liệu trích xuất."); }
  const account = results[0].data as { ai_user_id: string; updated_at: string } | null;
  const open = (results[1].data ?? []) as unknown as Request[];
  const runs = (results[2].data ?? []) as unknown as Run[];
  const here = (change: Record<string, string | null>) => withParams("/admin/extraction", params, change);
  const selectedRun = typeof params.run === "string" && uuidPattern.test(params.run) ? runs.find((r) => r.id === params.run) : undefined;

  let body: React.ReactNode;
  if (tab === "requests") {
    body = <DataTable label="Yêu cầu đang mở" minWidth="40rem" columns={[{ label: "Tài liệu" }, { label: "Trạng thái" }, { label: "Yêu cầu lúc (UTC)" }]}
      empty={!open.length && <EmptyState>Không có yêu cầu nào đang chờ. Mở một tài liệu do crawler lấy và bấm “Yêu cầu trích xuất bằng AI”.</EmptyState>}>
      {open.map((r) => <DataRow key={r.id} href={`/documents/${r.document_id}`} title={r.documents?.title ?? r.documents?.canonical_url ?? "Tài liệu chưa có tiêu đề"}>
        <Cell><Badge tone={requestStatuses[r.status]?.tone ?? "neutral"}>{requestStatuses[r.status]?.label ?? r.status}</Badge></Cell>
        <Cell className="whitespace-nowrap tabular-nums">{when(r.created_at)}</Cell>
      </DataRow>)}
    </DataTable>;
  } else if (tab === "runs") {
    body = <DataTable label="Lần chạy" minWidth="52rem" columns={[{ label: "Bắt đầu (UTC)" }, { label: "Trạng thái" }, { label: "Cách chạy" }, { label: "Kết quả" }, { label: "Mô hình" }]}
      empty={!runs.length && <EmptyState>Chưa có lần chạy nào.</EmptyState>}>
      {runs.map((r) => {
        const st = runStatuses[r.status] ?? runStatuses.failed;
        const summary = Object.entries(r.counts ?? {}).map(([k, c]) => `${itemOutcomes[k]?.label ?? k}: ${c}`).join(" · ");
        return <DataRow key={r.id} href={here({ run: r.id })} selected={r.id === selectedRun?.id} title={<span className="tabular-nums">{when(r.started_at)}</span>}>
          <Cell><Badge tone={st.tone}>{st.label}</Badge></Cell>
          <Cell>{triggerLabel(r.trigger)}</Cell>
          <Cell className="max-w-72 truncate">{summary || r.note || "Không có tài liệu nào"}</Cell>
          <Cell className="whitespace-nowrap">{r.model}</Cell>
        </DataRow>;
      })}
    </DataTable>;
  } else {
    body = <Card><AccountForm current={account?.ai_user_id ?? null} /></Card>;
  }

  let panel: React.ReactNode = null;
  if (tab === "runs" && selectedRun) {
    const r = selectedRun;
    const st = runStatuses[r.status] ?? runStatuses.failed;
    panel = <Inspector title={`Lần chạy ${when(r.started_at)} UTC`} subtitle={`${st.label} · ${triggerLabel(r.trigger)}`} closeHref={here({ run: null })}>
      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
        <dt className="text-ink-3">Mô hình</dt><dd className="text-ink">{r.model}</dd>
        <dt className="text-ink-3">Nhà cung cấp</dt><dd className="break-all text-ink">{r.provider}</dd>
        <dt className="text-ink-3">Phiên bản prompt</dt><dd className="text-ink">{r.prompt_version}</dd>
        <dt className="text-ink-3">Token vào / ra</dt><dd className="tabular-nums text-ink">{n(r.input_tokens)} / {n(r.output_tokens)}</dd>
      </dl>
      {r.note && <p className="mb-4 text-[15px] text-ink-2">{r.note}</p>}
      {r.extraction_items.length ? <List label="Gợi ý của AI">{r.extraction_items.map((i) => <ListRow key={i.id}
        title={<span className="text-[14px] font-normal">{i.candidate.subject ?? "?"} — {i.candidate.predicate ?? "?"}: {i.candidate.value ?? "?"}</span>}
        badges={<Badge tone={itemOutcomes[i.outcome]?.tone ?? "neutral"}>{itemOutcomes[i.outcome]?.label ?? i.outcome}</Badge>}
        subtitle={reasonLabel(i.reason) ?? undefined} meta={i.reason && reasonLabel(i.reason) !== i.reason ? i.reason : undefined} />)}</List>
        : <EmptyState>Lần chạy này không có gợi ý nào.</EmptyState>}
    </Inspector>;
  }

  return <>
    <PageHeader eyebrow="Quản trị" title="Trích xuất AI"
      description="AI chỉ đọc những tài liệu được biên tập viên yêu cầu, và chỉ tạo đề xuất để người duyệt. Mỗi gợi ý được kiểm tra tự động: câu trích phải có nguyên văn trong trang, mọi con số phải có trong câu trích."
      actions={<Link href="/facts/workspace" className={`${textLink} text-[15px]`}>Hàng chờ duyệt</Link>} />
    {!account && <div className="mb-6"><Notice tone="caution" title="Chưa chọn tài khoản AI">AI sẽ không chạy cho tới khi quản trị viên chọn tài khoản đứng tên các đề xuất của AI{admin ? " (tab Cài đặt)" : ""}.</Notice></div>}
    <Segmented label="Phần" items={[
      { href: withParams("/admin/extraction", {}, {}), label: "Yêu cầu đang mở", count: open.length, active: tab === "requests" },
      { href: withParams("/admin/extraction", {}, { tab: "runs" }), label: "Lần chạy", active: tab === "runs" },
      ...(admin ? [{ href: withParams("/admin/extraction", {}, { tab: "settings" }), label: "Cài đặt", active: tab === "settings" }] : []),
    ]} />
    {tab === "requests" && <p className="mb-3 px-1 text-[13px] text-ink-3">Yêu cầu được xử lý ở lần chạy tới (hằng ngày theo lịch, tối đa 5 tài liệu mỗi lần). Bấm một dòng để mở tài liệu.</p>}
    <div className="mt-1">{body}</div>
    {panel}
  </>;
}
