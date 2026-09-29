"use client";
import { useActionState } from "react";
import { proposeFact, resolveSourceChange, reviewFact } from "./actions";
import { deadlineTypes } from "@/lib/education/domain";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
export function ProposalForm({documents,countries,selected,entities=[],metrics=[]}:{documents:{id:string;title:string|null}[];countries:{id:string;name:string}[];selected:string;entities?:{value:string;label:string}[];metrics?:{id:string;label:string;unit_hint:string|null}[]}) {
 const [state,action,pending]=useActionState(proposeFact,{});
 return <Card><form action={action} className="space-y-5">
 <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">Thêm thông tin đề xuất</h2>
 <p className="mt-2 text-[15px] leading-relaxed text-ink-2">Mở tài liệu gốc, chọn một câu có thông tin cụ thể và chép một đoạn ngắn hỗ trợ câu đó. Nếu chưa tìm được, bạn có thể quay lại sau; không cần điền nội dung phỏng đoán.</p></div>
 <Field label="Tài liệu"><select name="document" defaultValue={selected} required className={control}><option value="">Chọn tài liệu</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title ?? d.id}</option>)}</select></Field>
 {[
 ["topic","Chủ đề: bài viết đang nói về lĩnh vực gì?",100],
 ["subject","Đối tượng: thông tin nói về ai hoặc điều gì?",200],
 ["predicate","Thuộc tính: điều gì được nêu về đối tượng?",200],
 ["value","Nội dung / giá trị: nguồn thực sự khẳng định điều gì?",2000],
 ].map(([name,label,max])=><Field key={String(name)} label={label}><textarea name={String(name)} required maxLength={Number(max)} rows={name==="value"?3:1} className={control}/></Field>)}
 <div className="grid gap-5 sm:grid-cols-2">
 <Field label="Đơn vị (nếu có)"><input name="unit" maxLength={100} className={control}/></Field>
 <Field label="Quốc gia (nếu xác định được)"><select name="country" className={control}><option value="">Chưa xác định / không áp dụng</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
 </div>
 <Field label="Gắn với trường/chương trình/quy định nhập cư/nghề (học phí, deadline, điều kiện, lương…)"><select name="entity" className={control}><option value="">Không gắn</option>{entities.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></Field>
 <Field label="Loại deadline (chỉ khi thông tin là hạn nộp hồ sơ)"><select name="deadlineType" className={control}><option value="">Không phải deadline / nguồn không nêu</option>{Object.entries(deadlineTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
 <Field label="Chỉ số so sánh (nếu thông tin là giá trị của một chỉ số)" hint="Dùng để xếp giá trị vào bảng so sánh quốc gia. Bắt buộc có quốc gia. Chỉ chọn khi đúng định nghĩa của chỉ số."><select name="metric" className={control}><option value="">Không gắn</option>{metrics.map(m=><option key={m.id} value={m.id}>{m.label}{m.unit_hint?` (${m.unit_hint})`:""}</option>)}</select></Field>
 <Field label="Kỳ số liệu (chỉ với số liệu thống kê)" hint="Kỳ mà con số mô tả, ví dụ 2024, 2024-Q2, 2024-H1, 2024-09. Bắt buộc có quốc gia khi gắn với một nghề."><input name="referencePeriod" maxLength={7} pattern="[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?" placeholder="2024" className={control}/></Field>
 <div className="grid gap-5 sm:grid-cols-2"><Field label="Từ ngày (chỉ khi nguồn nêu)"><input type="date" name="from" className={control}/></Field><Field label="Đến ngày (chỉ khi nguồn nêu)"><input type="date" name="until" className={control}/></Field></div>
 <Field label="Trích đoạn bằng chứng (nguyên văn, tối đa 500 ký tự)" hint="URL và ngày thu thập lấy từ tài liệu đã chọn. Chỉ dùng trích đoạn được phép sử dụng; không dán toàn bài."><textarea name="excerpt" required maxLength={500} rows={3} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending || !documents.length} className={buttonPrimary}>{pending?"Đang lưu…":"Lưu đề xuất"}</button>
 </form></Card>;
}
export function ReviewForm({id,ai}:{id:string;ai:boolean}) {
 return <ReviewPanel action={reviewFact} hidden={{fact:id}} checks={[
  "Trích đoạn có nguyên văn trên trang gốc (dùng Ctrl/Cmd+F).",
  "Giá trị khớp trích đoạn: đúng số, đơn vị và điều kiện đi kèm (“ít nhất”, “mỗi tháng”, “từ ngày…”).",
  "Không có thông tin nguồn không nêu, ví dụ đơn vị tiền tệ hay ngày hiệu lực tự thêm.",
  ...(ai?["Mức “mô hình tự đánh giá” không phải căn cứ để duyệt."]:[]),
 ]}/>;
}
// Conflicts are marked only between claims that already passed evidence review
// (facts_conflict_requires_review, 2026-09-23). Both stay public and are shown
// as conflicting; nothing is averaged or chosen (AGENTS.md 1.4).
export function ConflictForm({id,others}:{id:string;others:{id:string;label:string}[]}) {
 const [state,action,pending]=useActionState(reviewFact,{});
 return <form action={action} className="space-y-4 rounded-2xl bg-fill/50 p-4 sm:p-5">
 <input type="hidden" name="fact" value={id}/><input type="hidden" name="decision" value="conflicted"/>
 <p className="text-[15px] leading-relaxed text-ink-2">Dùng khi một thông tin đã duyệt khác nói điều trái ngược. Cả hai vẫn hiển thị và được đánh dấu mâu thuẫn; hệ thống không tự chọn bên đúng.</p>
 <Field label="Mâu thuẫn với thông tin"><select name="related" required className={control}><option value="">Chọn thông tin</option>{others.filter(o=>o.id!==id).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
 <Field label="Ghi chú đối chiếu" hint="Bắt buộc. Hai nguồn nói gì khác nhau?"><textarea name="note" required maxLength={1000} rows={2} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending} className={buttonPrimary}>{pending?"Đang lưu…":"Đánh dấu mâu thuẫn"}</button>
 </form>;
}
// Slice 9: a reviewer compares the claim with the NEW page version, then
// either confirms it still holds or withdraws it. Never decided automatically.
export function SourceChangeForm({id}:{id:string}) {
 const [state,action,pending]=useActionState(resolveSourceChange,{});
 return <form action={action} className="space-y-4 rounded-xl bg-fill/40 p-4">
 <input type="hidden" name="fact" value={id}/>
 <Field label="Kết quả đối chiếu với phiên bản mới"><select name="decision" className={control}><option value="revalidated">Vẫn khớp — giữ thông tin</option><option value="rejected">Không còn đúng — từ chối</option></select></Field>
 <Field label="Ghi chú đối chiếu" hint="Ví dụ: câu trích vẫn có trong phiên bản mới, mục 2."><textarea name="note" required maxLength={1000} rows={2} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending} className={buttonPrimary}>{pending?"Đang lưu…":"Ghi nhận"}</button>
 </form>;
}
