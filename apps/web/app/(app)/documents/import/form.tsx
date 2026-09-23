"use client";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { importDocument } from "./actions";
import { FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSecondary, control } from "@/components/ui/styles";

export function ImportForm({ sources }: { sources: { id: string; name: string; url: string; blocked: boolean }[] }) {
  const [state, action, pending] = useActionState(importDocument, {});
  const [preview, setPreview] = useState<Record<string,string> | null>(null);
  const [hash, setHash] = useState("");
  const [dates, setDates] = useState({ retrievedAt:"",publishedAt:"",sourceUpdatedAt:"" });
  const [error, setError] = useState(""); const [hashing, setHashing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const input = control;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (preview) { setSubmitted(true); startTransition(() => action(data)); return; }
    const file = (form.elements.namedItem("sourceFile") as HTMLInputElement).files?.[0];
    if (!file || file.size === 0 || file.size > 10*1024*1024) { setError("Chọn file nguồn có nội dung, tối đa 10 MiB."); return; }
    setError(""); setHashing(true);
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const value = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2,"0")).join("");
      const date = (id: string) => { const raw = (form.elements.namedItem(id) as HTMLInputElement).value; return raw ? new Date(raw).toISOString() : ""; };
      const normalized = { retrievedAt:date("retrievedLocal"),publishedAt:date("publishedLocal"),sourceUpdatedAt:date("updatedLocal") };
      setDates(normalized); setHash(value);
      setPreview({ "Nguồn": sources.find((s) => s.id === data.get("sourceId"))?.name ?? "", "URL": String(data.get("url")), "Tiêu đề": String(data.get("title") || "Chưa có"), "Trích đoạn": String(data.get("excerpt") || "Không có"), "Ngày thu thập (UTC)": normalized.retrievedAt, "SHA-256": value });
    } catch { setError("Không đọc được file hoặc ngày giờ. Hãy kiểm tra lại."); }
    finally { setHashing(false); }
  }
  return <form onSubmit={submit} className="space-y-5">
    <input type="hidden" name="contentHash" value={hash} />
    {Object.entries(dates).map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <fieldset hidden={!!preview} disabled={pending || hashing} className="space-y-5">
      <label className="block text-[13px] font-medium text-ink-2">Nguồn<select name="sourceId" required className={input}><option value="">Chọn nguồn đã đăng ký</option>{sources.map((s) => <option key={s.id} value={s.id} disabled={s.blocked}>{s.name} — {s.url}{s.blocked ? " (đang bị chặn)" : ""}</option>)}</select></label>
      <label className="block text-[13px] font-medium text-ink-2">URL tài liệu<input name="url" type="url" required maxLength={2048} className={input} /></label>
      <label className="block text-[13px] font-medium text-ink-2">Tiêu đề (nếu biết)<input name="title" maxLength={300} className={input} /></label>
      <label className="block text-[13px] font-medium text-ink-2">Loại tài liệu<select name="documentType" className={input}><option value="webpage">Trang web</option><option value="pdf">PDF</option><option value="text">Văn bản</option><option value="unknown">Chưa biết</option></select></label>
      <label className="block text-[13px] font-medium text-ink-2">Trích đoạn được phép sử dụng (tối đa 500 ký tự)<textarea name="excerpt" maxLength={500} rows={4} className={input} /></label>
      <label className="block text-[13px] font-medium text-ink-2">Ngày giờ thu thập (giờ địa phương)<input id="retrievedLocal" type="datetime-local" required className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-[13px] font-medium text-ink-2">Ngày xuất bản (nếu biết)<input id="publishedLocal" type="datetime-local" className={input} /></label><label className="block text-[13px] font-medium text-ink-2">Ngày cập nhật nguồn (nếu biết)<input id="updatedLocal" type="datetime-local" className={input} /></label></div>
      <label className="block text-[13px] font-medium text-ink-2">File nội dung nguồn (tối đa 10 MiB)<input id="sourceFile" type="file" required className={input} /></label>
      <p className="text-[13px] text-ink-3">Dùng file gốc bạn đã thu thập hợp lệ. Hệ thống không tải URL hay xác minh nội dung file.</p>
    </fieldset>
    {preview && <section><h2 className="text-[22px] font-semibold tracking-[-0.015em]">Xem trước</h2><dl className="mt-4 overflow-hidden rounded-xl ring-1 ring-hairline [&>div+div]:border-t [&>div+div]:border-hairline">{Object.entries(preview).map(([key,value]) => <div key={key} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]"><dt className="text-[15px] text-ink-2">{key}</dt><dd className="whitespace-pre-wrap break-all text-[15px]">{value}</dd></div>)}</dl><p className="mt-4 text-[15px] text-ink-2">Thao tác này lưu metadata/trích đoạn công khai. Không tự xác minh hoặc trích xuất facts.</p></section>}
    <FormMessage error={error || (submitted && !pending ? state.error : undefined)} />
    <FormMessage message={submitted && !pending ? state.message : undefined} />
    {submitted && !pending && state.documentId && <Link className="block text-[15px] text-accent hover:underline" href={`/documents/${state.documentId}`}>Xem tài liệu →</Link>}
    <div className="flex gap-4">{preview && <button type="button" disabled={pending} onClick={() => { setPreview(null); setHash(""); setSubmitted(false); }} className={buttonSecondary}>Chỉnh sửa</button>}<button disabled={pending || hashing || !sources.some((s) => !s.blocked)} className={buttonPrimary}>{pending ? "Đang nhập…" : hashing ? "Đang đọc file…" : preview ? "Xác nhận nhập" : "Xem trước"}</button></div>
  </form>;
}
