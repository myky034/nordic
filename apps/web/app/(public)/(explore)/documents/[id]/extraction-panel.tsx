import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { requestStatuses } from "@/lib/extraction/domain";
import { Badge, List, ListRow, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { CancelExtractionForm, RequestExtractionForm } from "./extraction-forms";

type Request = { id: string; status: string; note: string | null; created_at: string; finished_at: string | null; truncated: boolean };
const when = (v: string | null) => (v ? new Date(v).toISOString().replace("T", " ").slice(0, 16) : "");

// Slice 10a: shown only to editors who can propose, and only for documents
// with stored crawler text (the only text ever sent to a model).
export async function ExtractionPanel({ documentId }: { documentId: string }) {
  const client = await createClient();
  const { data: user } = await client.auth.getUser();
  if (!user.user) return null;
  const perms = await client.rpc("my_permissions");
  if (perms.error) { logAccessError("extraction_panel_permissions"); return null; }
  if (!(perms.data as { key: string }[]).some((p) => p.key === "facts.propose")) return null;
  const [text, requests] = await Promise.all([
    client.from("document_texts").select("document_id").eq("document_id", documentId).maybeSingle(),
    client.from("extraction_requests").select("id,status,note,created_at,finished_at,truncated").eq("document_id", documentId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (text.error || requests.error) { logAccessError("extraction_panel"); return null; }
  if (!text.data) return null;
  const rows = requests.data as Request[];
  const open = rows.find((r) => r.status === "pending" || r.status === "running");
  return <Section title="Trích xuất bằng AI" description="AI đọc văn bản nội bộ và tạo ĐỀ XUẤT. Mỗi đề xuất phải có đoạn trích nguyên văn từ trang; người duyệt quyết định. Không có gì được công bố tự động.">
    <div className="mb-4 flex flex-wrap items-center gap-4">
      {open ? <p className="text-[15px] text-ink-2">Đã có yêu cầu {open.status === "pending" ? "đang chờ" : "đang xử lý"}.</p> : <RequestExtractionForm document={documentId} />}
      <Link href="/facts/workspace" className={`${textLink} text-[15px]`}>Hàng chờ duyệt</Link>
      <Link href="/admin/extraction" className={`${textLink} text-[15px]`}>Nhật ký trích xuất</Link>
    </div>
    {rows.length > 0 && <List>{rows.map((r) => {
      const st = requestStatuses[r.status] ?? requestStatuses.failed;
      return <ListRow key={r.id} title={`Yêu cầu ${when(r.created_at)}`} badges={<><Badge tone={st.tone}>{st.label}</Badge>{r.truncated && <Badge tone="caution">Văn bản bị cắt</Badge>}</>}
        subtitle={r.note ?? undefined} meta={r.finished_at ? `Xong ${when(r.finished_at)}` : undefined}>
        {r.status === "pending" && <CancelExtractionForm document={documentId} request={r.id} />}
      </ListRow>;
    })}</List>}
  </Section>;
}
