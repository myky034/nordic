"use client";
import { useActionState } from "react";
import { proposeOccupation, reviewOccupation } from "./actions";
import { classificationSystems } from "@/lib/labour/domain";
import { Card, Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type Option = { id: string; label: string };
export function OccupationForm({ countries, documents }: { countries: Option[]; documents: Option[] }) {
  const [state, action, pending] = useActionState(proposeOccupation, {});
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">Đề xuất nghề</h2>
    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Chỉ nhập tên nghề (và mã phân loại nếu nguồn ghi rõ). Lương, nhu cầu tuyển dụng… nhập thành “thông tin” riêng ở Thông tin & bằng chứng, kèm quốc gia và kỳ số liệu.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Tên nghề (theo nguồn)"><input name="name" required maxLength={200} className={control} /></Field>
      <Field label="Phạm vi" hint="Để trống nếu định nghĩa nghề không riêng cho một quốc gia (ví dụ ISCO/ESCO)."><select name="country" className={control}><option value="">Quốc tế / không riêng quốc gia</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label="Hệ phân loại (nếu nguồn nêu)"><select name="system" className={control}><option value="">Không có</option>{Object.entries(classificationSystems).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Mã phân loại (chỉ khi nguồn nêu)"><input name="code" maxLength={50} className={control} /></Field>
    </div>
    <Field label="Tài liệu bằng chứng"><select name="document" required className={control}><option value="">Chọn tài liệu</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    <Field label="Trích đoạn nguyên văn nêu tên nghề (tối đa 500 ký tự)"><textarea name="excerpt" required maxLength={500} rows={3} className={control} /></Field>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu đề xuất"}</button>
  </form></Card>;
}
export function OccupationReviewForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewOccupation, {});
  return <form action={action} className="space-y-4 rounded-xl bg-fill/40 p-4">
    <input type="hidden" name="id" value={id} />
    <Field label="Quyết định"><select name="decision" className={control}><option value="reviewed">Đã kiểm tra bằng chứng</option><option value="rejected">Không chấp nhận</option></select></Field>
    <Field label="Lý do / ghi chú kiểm tra"><textarea name="note" required maxLength={1000} rows={2} className={control} /></Field>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : "Ghi nhận quyết định"}</button>
  </form>;
}
