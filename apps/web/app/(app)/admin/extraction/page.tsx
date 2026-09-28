import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { itemOutcomes, requestStatuses, runStatuses } from "@/lib/extraction/domain";
import { Badge, Card, Disclosure, EmptyState, List, ListRow, NoAccess, Notice, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { AccountForm } from "./forms";

type Request = { id: string; document_id: string; status: string; note: string | null; created_at: string; documents: { title: string | null; canonical_url: string } | null };
type Item = { id: string; outcome: string; reason: string | null; fact_id: string | null; candidate: { subject?: string; predicate?: string; value?: string } };
type Run = { id: string; trigger: string; provider: string; model: string; prompt_version: string; status: string; started_at: string; note: string | null;
  input_tokens: number; output_tokens: number; counts: Record<string, number> | null; extraction_items: Item[] };
const when = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);

export default async function ExtractionAdminPage() {
  const { client, permissions } = await accessContext();
  const editor = permissions.includes("facts.propose") || permissions.includes("facts.review");
  const admin = permissions.includes("roles.manage");
  if (!editor && !admin) return <NoAccess title="Không có quyền xem trích xuất AI">Cần facts.propose hoặc facts.review.</NoAccess>;
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
  return <>
    <PageHeader eyebrow="Quản trị" title="Trích xuất AI"
      description="AI chỉ đọc tài liệu được biên tập viên yêu cầu và chỉ tạo đề xuất. Mỗi đề xuất được kiểm tra: đoạn trích phải có nguyên văn trong trang, mọi con số phải có trong đoạn trích."
      actions={<Link href="/facts/workspace" className={`${textLink} text-[15px]`}>Hàng chờ duyệt</Link>} />
    {!account && <Notice tone="caution" title="Chưa cấu hình tài khoản AI">Worker sẽ không chạy cho tới khi quản trị viên chọn tài khoản đứng tên các đề xuất AI.</Notice>}
    {admin && <Section title="Tài khoản AI"><Card><AccountForm current={account?.ai_user_id ?? null} /></Card></Section>}
    <Section title="Yêu cầu đang mở" description="Được xử lý ở lần chạy tới (GitHub Actions, tối đa 5 tài liệu mỗi lần).">
      {open.length ? <List>{open.map((r) => <ListRow key={r.id} href={`/documents/${r.document_id}`} title={r.documents?.title ?? r.documents?.canonical_url ?? r.document_id}
        badges={<Badge tone={requestStatuses[r.status]?.tone ?? "neutral"}>{requestStatuses[r.status]?.label ?? r.status}</Badge>} meta={`Yêu cầu ${when(r.created_at)}`} />)}</List>
        : <EmptyState>Không có yêu cầu nào đang chờ. Mở một tài liệu do crawler lấy và bấm “Yêu cầu trích xuất bằng AI”.</EmptyState>}
    </Section>
    <Section title="10 lần chạy gần nhất">
      {runs.length ? <List>{runs.map((r) => {
        const st = runStatuses[r.status] ?? runStatuses.failed;
        const summary = Object.entries(r.counts ?? {}).map(([k, n]) => `${itemOutcomes[k]?.label ?? k}: ${n}`).join(" · ");
        return <ListRow key={r.id} title={when(r.started_at)} badges={<><Badge tone={st.tone}>{st.label}</Badge><Badge>{r.trigger}</Badge><Badge>{r.model}</Badge></>}
          subtitle={summary || r.note || "Không có tài liệu nào"} meta={`${r.provider} · prompt ${r.prompt_version} · ${r.input_tokens.toLocaleString("vi-VN")} token vào / ${r.output_tokens.toLocaleString("vi-VN")} token ra`}>
          {r.extraction_items.length > 0 && <Disclosure small summary={`Chi tiết ${r.extraction_items.length} ứng viên`}>
            <List>{r.extraction_items.map((i) => <ListRow key={i.id} title={<span className="text-[14px] font-normal">{i.candidate.subject ?? "?"} — {i.candidate.predicate ?? "?"}: {i.candidate.value ?? "?"}</span>}
              badges={<Badge tone={itemOutcomes[i.outcome]?.tone ?? "neutral"}>{itemOutcomes[i.outcome]?.label ?? i.outcome}</Badge>} subtitle={i.reason ?? undefined} />)}</List>
          </Disclosure>}
        </ListRow>;
      })}</List> : <EmptyState>Chưa có lần chạy nào.</EmptyState>}
    </Section>
  </>;
}
