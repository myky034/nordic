"use client";
import { useActionState } from "react";
import { proposeRule, reviewRule } from "./actions";
import { ruleTypes } from "@/lib/immigration/domain";
import { Card, Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type Option = { id: string; label: string };
export function RuleForm({ countries, documents }: { countries: Option[]; documents: Option[] }) {
  const [state, action, pending] = useActionState(proposeRule, {});
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">Đề xuất quy định nhập cư</h2>
    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Chỉ nhập tên và loại quy định như trang chính thức ghi. Điều kiện cụ thể (mức tài chính, thời hạn, thời gian xử lý…) nhập thành “thông tin” riêng ở Thông tin & bằng chứng. Không viết tóm tắt hay lời khuyên.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Quốc gia"><select name="country" required className={control}><option value="">Chọn quốc gia</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label="Loại quy định"><select name="ruleType" required defaultValue="other" className={control}>{Object.entries(ruleTypes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
    </div>
    <Field label="Tên chính thức (theo trang của cơ quan)"><input name="title" required maxLength={300} className={control} /></Field>
    <Field label="Trang chính thức của quy định" hint="Phải cùng domain với nguồn T1 của tài liệu."><input name="officialUrl" type="url" required maxLength={2048} placeholder="https://" className={control} /></Field>
    <Field label="Tài liệu bằng chứng (chỉ tài liệu từ nguồn T1)"><select name="document" required className={control}><option value="">Chọn tài liệu</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    <Field label="Trích đoạn nguyên văn nêu tên quy định (tối đa 500 ký tự)"><textarea name="excerpt" required maxLength={500} rows={3} className={control} /></Field>
    {!documents.length && <p className="text-[15px] text-caution">Chưa có tài liệu nào từ nguồn T1. Hãy nhập tài liệu từ cơ quan di trú trước.</p>}
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu đề xuất"}</button>
  </form></Card>;
}
export function RuleReviewForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(reviewRule, {});
  return <form action={action} className="space-y-4 rounded-xl bg-fill/40 p-4">
    <input type="hidden" name="id" value={id} />
    <Field label="Quyết định"><select name="decision" className={control}><option value="reviewed">Đã kiểm tra bằng chứng trên trang chính thức</option><option value="rejected">Không chấp nhận</option></select></Field>
    <Field label="Lý do / ghi chú kiểm tra"><textarea name="note" required maxLength={1000} rows={2} className={control} /></Field>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : "Ghi nhận quyết định"}</button>
  </form>;
}
