import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { Disclosure, Section } from "@/components/ui";

// Slice 9: crawler-extracted text is internal working material (decision:
// stored privately, never republished — AGENTS.md Section 8). RLS on
// document_texts returns a row only to facts.propose / facts.review /
// documents.ingest holders, so for everyone else this renders nothing.
export async function InternalText({ documentId }: { documentId: string }) {
  const client = await createClient();
  const { data: user } = await client.auth.getUser();
  if (!user.user) return null;
  const { data, error } = await client.from("document_texts").select("text,extractor,extracted_at").eq("document_id", documentId).maybeSingle();
  if (error) { logAccessError("document_text_read"); return null; }
  if (!data) return null;
  return <Section title="Văn bản trích (nội bộ)" description="Chỉ biên tập viên thấy. Dùng để đối chiếu khi nhập hoặc kiểm tra lại thông tin; không phải bản sao công khai của nguồn.">
    <Disclosure summary={`${data.text.length.toLocaleString("vi-VN")} ký tự · ${data.extractor} · ${new Date(data.extracted_at).toISOString().slice(0, 10)}`}>
      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-fill/40 p-4 font-sans text-[14px] leading-relaxed text-ink-2">{data.text}</pre>
    </Disclosure>
  </Section>;
}
