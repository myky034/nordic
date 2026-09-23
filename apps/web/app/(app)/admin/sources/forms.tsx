"use client";
import { useActionState } from "react";
import { saveSource } from "./actions";
import { tiers, sourceStatuses, crawlPolicies } from "@/lib/registry/domain";
import type { ActionState } from "@/lib/rbac/messages";
type SourceRow = {
  id: string; name: string; canonicalUrl: string; countryId: string | null; sourceTier: string | null;
  sourceType: string | null; topics: string[]; language: string | null; authorityNotes: string | null;
  status: string; crawlPolicy: string; crawlEnabled: boolean; crawlFrequency: string | null; notes: string | null;
};
const input = "mt-2 w-full rounded-lg border border-zinc-300 bg-transparent p-3 dark:border-zinc-700";
const label = "block text-sm";
function Result({ state }: { state: ActionState }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}{state.message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>}</>;
}
export function SourceForm({ source, countries }: { source?: SourceRow; countries: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveSource, {});
  return <form action={action} className="space-y-4 rounded-2xl border p-5">
    <h3 className="text-lg font-medium">{source ? source.name : "Thêm nguồn mới"}</h3>
    <input type="hidden" name="id" value={source?.id ?? ""} />
    <fieldset disabled={pending} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
      <label className={label}>Tên nguồn<input className={input} name="name" required maxLength={200} defaultValue={source?.name} /></label>
      <label className={label}>Canonical URL<input className={input} name="canonicalUrl" type="url" required maxLength={2048} defaultValue={source?.canonicalUrl} /></label>
      <label className={label}>Quốc gia<select className={input} name="countryId" defaultValue={source?.countryId ?? ""}><option value="">Chưa gán</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className={label}>Source tier<select className={input} name="sourceTier" defaultValue={source?.sourceTier ?? ""}><option value="">Chưa phân loại</option>{Object.entries(tiers).map(([t, l]) => <option key={t} value={t}>{t} · {l}</option>)}</select></label>
      <label className={label}>Source type<input className={input} name="sourceType" maxLength={100} defaultValue={source?.sourceType ?? ""} placeholder="government, university, community…" /></label>
      <label className={label}>Ngôn ngữ<input className={input} name="language" maxLength={20} defaultValue={source?.language ?? ""} placeholder="en, sv, da…" /></label>
      <label className="sm:col-span-2 block text-sm">Chủ đề (phân tách bằng dấu phẩy)<input className={input} name="topics" defaultValue={source?.topics.join(", ") ?? ""} placeholder="immigration, education, labour_market" /></label>
      <label className={label}>Trạng thái xác minh<select className={input} name="status" defaultValue={source?.status ?? "needs_verification"}>{sourceStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      <label className={label}>Crawl policy<select className={input} name="crawlPolicy" defaultValue={source?.crawlPolicy ?? "not_reviewed"}>{crawlPolicies.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
      <label className="sm:col-span-2 block text-sm">Authority notes (bắt buộc nếu status = verified — mô tả cách bạn xác minh)<textarea className={input} name="authorityNotes" maxLength={2000} rows={2} defaultValue={source?.authorityNotes ?? ""} /></label>
      <label className={label}>Crawl frequency<input className={input} name="crawlFrequency" maxLength={50} defaultValue={source?.crawlFrequency ?? ""} placeholder="weekly, monthly…" /></label>
      <label className="flex items-center gap-3 self-end pb-3 text-sm"><input type="checkbox" name="crawlEnabled" defaultChecked={source?.crawlEnabled} /> Bật crawl (cần policy=approved và status=verified)</label>
      <label className="sm:col-span-2 block text-sm">Ghi chú nội bộ<textarea className={input} name="notes" maxLength={2000} rows={2} defaultValue={source?.notes ?? ""} /></label>
      <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white sm:col-span-2 dark:bg-zinc-100 dark:text-zinc-900">{pending ? "Đang lưu…" : source ? "Lưu thay đổi" : "Tạo nguồn"}</button>
    </fieldset>
    <Result state={state} />
  </form>;
}
