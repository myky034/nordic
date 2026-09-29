"use client";
import { useActionState } from "react";
import { proposeProgramme, proposeUniversity, reviewEducation } from "./actions";
import { degreeTypes } from "@/lib/education/domain";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
type Option = { id: string; label: string };
function EvidenceFields({ documents }: { documents: Option[] }) {
  return <>
    <Field label="Tài liệu bằng chứng"><select name="document" required className={control}><option value="">Chọn tài liệu</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    <Field label="Trích đoạn chứng minh mục này tồn tại (nguyên văn, tối đa 500 ký tự)" hint="URL nguồn và ngày thu thập lấy từ tài liệu đã chọn. Không dán toàn bài.">
      <textarea name="excerpt" required maxLength={500} rows={3} className={control} />
    </Field>
  </>;
}

export function UniversityForm({ countries, documents }: { countries: Option[]; documents: Option[] }) {
  const [state, action, pending] = useActionState(proposeUniversity, {});
  return <Card><form action={action} className="space-y-5">
    <h2 className="text-[22px] font-semibold tracking-[-0.015em]">Đề xuất trường đại học</h2>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Quốc gia"><select name="country" required className={control}><option value="">Chọn quốc gia</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label="Tên chính thức (theo nguồn)"><input name="name" required maxLength={300} className={control} /></Field>
    </div>
    <Field label="Website chính thức"><input name="officialUrl" type="url" required maxLength={2048} placeholder="https://" className={control} /></Field>
    <EvidenceFields documents={documents} />
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu đề xuất"}</button>
  </form></Card>;
}

export function ProgrammeForm({ universities, documents }: { universities: Option[]; documents: Option[] }) {
  const [state, action, pending] = useActionState(proposeProgramme, {});
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">Đề xuất chương trình học</h2>
    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Chỉ nhập thông tin nhận diện. Học phí, deadline, thời lượng, học bổng là “thông tin” riêng có bằng chứng, nhập ở trang Thông tin & bằng chứng.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Trường"><select name="university" required className={control}><option value="">Chọn trường</option>{universities.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
      <Field label="Bậc học"><select name="degree" required defaultValue="unknown" className={control}>{Object.entries(degreeTypes).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
    </div>
    <Field label="Tên chương trình (theo nguồn)"><input name="name" required maxLength={300} className={control} /></Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Ngành (nếu nguồn nêu)"><input name="field" maxLength={200} className={control} /></Field>
      <Field label="Ngôn ngữ giảng dạy (nếu nguồn nêu)"><input name="language" maxLength={100} className={control} /></Field>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Trang chương trình chính thức"><input name="officialUrl" type="url" required maxLength={2048} placeholder="https://" className={control} /></Field>
      <Field label="Trang nộp hồ sơ (nếu có)"><input name="applicationUrl" type="url" maxLength={2048} placeholder="https://" className={control} /></Field>
    </div>
    <EvidenceFields documents={documents} />
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length || !universities.length} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu đề xuất"}</button>
  </form></Card>;
}

export function EducationReviewForm({ kind, id }: { kind: "university" | "programme"; id: string }) {
  // Education review proves only that the entity EXISTS (Slice 5, Option A);
  // tuition and deadlines are separate facts with their own review.
  return <ReviewPanel action={reviewEducation} hidden={{ kind, id }} checks={kind === "university" ? [
    "Trang nguồn thật sự hiển thị trường này (mở trang trên trình duyệt, không chỉ dựa vào dữ liệu ẩn).",
    "Tên chính thức đúng như nguồn ghi.",
    "Website chính thức mở ra đúng trường đó.",
  ] : [
    "Trang nguồn thật sự nêu chương trình này của đúng trường này.",
    "Tên, bậc học, ngành, ngôn ngữ giảng dạy đúng như nguồn; mục nào nguồn không nêu thì để trống.",
    "Trang chương trình chính thức mở ra đúng chương trình.",
  ]} />;
}
