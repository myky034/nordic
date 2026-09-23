"use client";
import Link from "next/link";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { importDocument } from "./actions";

export function ImportForm({ sources }: { sources: { id: string; name: string; url: string; blocked: boolean }[] }) {
  const [state, action, pending] = useActionState(importDocument, {});
  const [preview, setPreview] = useState<Record<string,string> | null>(null);
  const [hash, setHash] = useState("");
  const [dates, setDates] = useState({ retrievedAt:"",publishedAt:"",sourceUpdatedAt:"" });
  const [error, setError] = useState(""); const [hashing, setHashing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const input = "mt-2 w-full rounded-lg border border-zinc-300 bg-transparent p-3 dark:border-zinc-700";
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
  return <form onSubmit={submit} className="mt-8 space-y-5">
    <input type="hidden" name="contentHash" value={hash} />
    {Object.entries(dates).map(([key,value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <fieldset hidden={!!preview} disabled={pending || hashing} className="space-y-5">
      <label className="block text-sm">Nguồn<select name="sourceId" required className={input}><option value="">Chọn nguồn đã đăng ký</option>{sources.map((s) => <option key={s.id} value={s.id} disabled={s.blocked}>{s.name} — {s.url}{s.blocked ? " (đang bị chặn)" : ""}</option>)}</select></label>
      <label className="block text-sm">URL tài liệu<input name="url" type="url" required maxLength={2048} className={input} /></label>
      <label className="block text-sm">Tiêu đề (nếu biết)<input name="title" maxLength={300} className={input} /></label>
      <label className="block text-sm">Loại tài liệu<select name="documentType" className={input}><option value="webpage">Trang web</option><option value="pdf">PDF</option><option value="text">Văn bản</option><option value="unknown">Chưa biết</option></select></label>
      <label className="block text-sm">Trích đoạn được phép sử dụng (tối đa 500 ký tự)<textarea name="excerpt" maxLength={500} rows={4} className={input} /></label>
      <label className="block text-sm">Ngày giờ thu thập (giờ địa phương)<input id="retrievedLocal" type="datetime-local" required className={input} /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Ngày xuất bản (nếu biết)<input id="publishedLocal" type="datetime-local" className={input} /></label><label className="text-sm">Ngày cập nhật nguồn (nếu biết)<input id="updatedLocal" type="datetime-local" className={input} /></label></div>
      <label className="block text-sm">File nội dung nguồn (tối đa 10 MiB)<input id="sourceFile" type="file" required className={input} /></label>
      <p className="text-sm text-zinc-500">Dùng file gốc bạn đã thu thập hợp lệ. Hệ thống không tải URL hay xác minh nội dung file.</p>
    </fieldset>
    {preview && <section className="rounded-2xl border p-5"><h2 className="text-xl font-medium">Xem trước</h2><dl className="mt-4 space-y-4">{Object.entries(preview).map(([key,value]) => <div key={key}><dt className="text-sm text-zinc-500">{key}</dt><dd className="mt-1 whitespace-pre-wrap break-all text-sm">{value}</dd></div>)}</dl><p className="mt-5 text-sm">Thao tác này lưu metadata/trích đoạn công khai. Không tự xác minh hoặc trích xuất facts.</p></section>}
    {error && <p role="alert" className="text-red-600">{error}</p>}{submitted && !pending && state.error && <p role="alert" className="text-red-600">{state.error}</p>}
    {submitted && !pending && state.message && <p role="status" className="text-emerald-700 dark:text-emerald-300">{state.message}</p>}
    {submitted && !pending && state.documentId && <Link className="block underline" href={`/documents/${state.documentId}`}>Xem tài liệu →</Link>}
    <div className="flex gap-4">{preview && <button type="button" disabled={pending} onClick={() => { setPreview(null); setHash(""); setSubmitted(false); }} className="rounded-lg border px-5 py-3">Chỉnh sửa</button>}<button disabled={pending || hashing || !sources.some((s) => !s.blocked)} className="rounded-lg bg-zinc-900 px-5 py-3 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">{pending ? "Đang nhập…" : hashing ? "Đang đọc file…" : preview ? "Xác nhận nhập" : "Xem trước"}</button></div>
  </form>;
}
