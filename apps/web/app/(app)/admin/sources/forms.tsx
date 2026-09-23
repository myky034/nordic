"use client";
import { useActionState } from "react";
import { saveSource } from "./actions";
import { tiers, sourceStatuses, crawlPolicies } from "@/lib/registry/domain";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type SourceRow = {
  id: string; name: string; canonicalUrl: string; countryId: string | null; sourceTier: string | null;
  sourceType: string | null; topics: string[]; language: string | null; authorityNotes: string | null;
  status: string; crawlPolicy: string; crawlEnabled: boolean; crawlFrequency: string | null; notes: string | null;
};
// Used twice: inside a Card for "new source", and inside a list row's
// disclosure for editing, so it carries no border of its own (no card-in-card).
export function SourceForm({ source, countries }: { source?: SourceRow; countries: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveSource, {});
  return <form action={action} className="space-y-5">
    {!source && <h2 className="text-[22px] font-semibold tracking-[-0.015em]">Thêm nguồn mới</h2>}
    <input type="hidden" name="id" value={source?.id ?? ""} />
    <fieldset disabled={pending} className="grid gap-5 disabled:opacity-60 sm:grid-cols-2">
      <Field label="Tên nguồn"><input className={control} name="name" required maxLength={200} defaultValue={source?.name} /></Field>
      <Field label="Canonical URL"><input className={control} name="canonicalUrl" type="url" required maxLength={2048} defaultValue={source?.canonicalUrl} /></Field>
      <Field label="Quốc gia"><select className={control} name="countryId" defaultValue={source?.countryId ?? ""}><option value="">Chưa gán</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Source tier"><select className={control} name="sourceTier" defaultValue={source?.sourceTier ?? ""}><option value="">Chưa phân loại</option>{Object.entries(tiers).map(([t, l]) => <option key={t} value={t}>{t} · {l}</option>)}</select></Field>
      <Field label="Source type"><input className={control} name="sourceType" maxLength={100} defaultValue={source?.sourceType ?? ""} placeholder="government, university, community…" /></Field>
      <Field label="Ngôn ngữ"><input className={control} name="language" maxLength={20} defaultValue={source?.language ?? ""} placeholder="en, sv, da…" /></Field>
      <Field className="sm:col-span-2" label="Chủ đề (phân tách bằng dấu phẩy)"><input className={control} name="topics" defaultValue={source?.topics.join(", ") ?? ""} placeholder="immigration, education, labour_market" /></Field>
      <Field label="Trạng thái xác minh"><select className={control} name="status" defaultValue={source?.status ?? "needs_verification"}>{sourceStatuses.map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
      <Field label="Crawl policy"><select className={control} name="crawlPolicy" defaultValue={source?.crawlPolicy ?? "not_reviewed"}>{crawlPolicies.map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
      <Field className="sm:col-span-2" label="Authority notes" hint="Bắt buộc nếu status = verified — mô tả cách bạn xác minh."><textarea className={control} name="authorityNotes" maxLength={2000} rows={2} defaultValue={source?.authorityNotes ?? ""} /></Field>
      <Field label="Crawl frequency"><input className={control} name="crawlFrequency" maxLength={50} defaultValue={source?.crawlFrequency ?? ""} placeholder="weekly, monthly…" /></Field>
      <label className="flex items-center gap-3 self-end pb-3 text-[15px]"><input type="checkbox" name="crawlEnabled" defaultChecked={source?.crawlEnabled} className="h-4 w-4 accent-[var(--accent)]" /> Bật crawl (cần policy=approved và status=verified)</label>
      {/* Only this box (or first switching to verified) stamps a new "last verified" date. */}
      {source?.status === "verified" && <label className="flex items-center gap-3 text-[15px] sm:col-span-2"><input type="checkbox" name="reverify" className="h-4 w-4 accent-[var(--accent)]" /> Tôi vừa xác minh lại nguồn này hôm nay (cập nhật ngày xác minh; bắt buộc khi đổi URL hoặc tier)</label>}
      <Field className="sm:col-span-2" label="Ghi chú nội bộ"><textarea className={control} name="notes" maxLength={2000} rows={2} defaultValue={source?.notes ?? ""} /></Field>
      <div className="sm:col-span-2"><button className={buttonPrimary}>{pending ? "Đang lưu…" : source ? "Lưu thay đổi" : "Tạo nguồn"}</button></div>
    </fieldset>
    <FormMessage error={state.error} message={state.message} />
  </form>;
}
