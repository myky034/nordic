"use client";
import { useActionState } from "react";
import { saveMetric } from "./actions";
import { metricCategories } from "@/lib/compare/domain";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type Metric = { id: string; key: string; label: string; description: string; unit_hint: string | null; category: string; active: boolean };
// Key and category are locked after creation (the database refuses changes),
// so they are read-only here to avoid a confusing round-trip error.
export function MetricForm({ metric }: { metric?: Metric }) {
  const [state, action, pending] = useActionState(saveMetric, {});
  return <form action={action} className="space-y-5">
    <input type="hidden" name="id" value={metric?.id ?? ""} />
    {metric && <><input type="hidden" name="key" value={metric.key} /><input type="hidden" name="category" value={metric.category} /></>}
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Key (không đổi được sau khi tạo)" hint="Chữ thường, số, dấu gạch dưới. Ví dụ: living_cost_student_month.">
        <input name={metric ? undefined : "key"} defaultValue={metric?.key} disabled={!!metric} required pattern="[a-z][a-z0-9_]{1,59}" maxLength={60} className={control} />
      </Field>
      <Field label="Nhóm (không đổi được sau khi tạo)">
        <select name={metric ? undefined : "category"} defaultValue={metric?.category ?? ""} disabled={!!metric} required className={control}>
          <option value="">Chọn nhóm</option>{Object.entries(metricCategories).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>
      <Field label="Tên hiển thị"><input name="label" defaultValue={metric?.label} required maxLength={200} className={control} /></Field>
      <Field label="Đơn vị gợi ý (nếu có)" hint="Chỉ là gợi ý; mỗi giá trị vẫn ghi đơn vị của nguồn."><input name="unit" defaultValue={metric?.unit_hint ?? ""} maxLength={50} placeholder="EUR/tháng" className={control} /></Field>
    </div>
    <Field label="Định nghĩa: đo chính xác điều gì?" hint="Viết đủ rõ để hai người nhập độc lập chọn cùng một con số từ nguồn (ví dụ: sinh viên độc thân, không gồm học phí).">
      <textarea name="description" defaultValue={metric?.description} required maxLength={1000} rows={3} className={control} />
    </Field>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="active" defaultChecked={metric?.active ?? true} className="h-4 w-4 accent-[var(--accent)]" /> Đang dùng (bỏ chọn để ngừng nhận giá trị mới; giá trị cũ được giữ)</label>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : metric ? "Lưu thay đổi" : "Tạo chỉ số"}</button>
  </form>;
}
