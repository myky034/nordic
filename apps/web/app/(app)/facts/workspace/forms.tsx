"use client";
import { useActionState } from "react";
import { proposeFact, reviewFact } from "./actions";
import { deadlineTypes } from "@/lib/education/domain";
import { Card, Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
export function ProposalForm({documents,countries,selected,entities=[]}:{documents:{id:string;title:string|null}[];countries:{id:string;name:string}[];selected:string;entities?:{value:string;label:string}[]}) {
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
 <Field label="Gắn với trường/chương trình/quy định nhập cư (học phí, deadline, điều kiện…)"><select name="entity" className={control}><option value="">Không gắn</option>{entities.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></Field>
 <Field label="Loại deadline (chỉ khi thông tin là hạn nộp hồ sơ)"><select name="deadlineType" className={control}><option value="">Không phải deadline / nguồn không nêu</option>{Object.entries(deadlineTypes).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
 <div className="grid gap-5 sm:grid-cols-2"><Field label="Từ ngày (chỉ khi nguồn nêu)"><input type="date" name="from" className={control}/></Field><Field label="Đến ngày (chỉ khi nguồn nêu)"><input type="date" name="until" className={control}/></Field></div>
 <Field label="Trích đoạn bằng chứng (nguyên văn, tối đa 500 ký tự)" hint="URL và ngày thu thập lấy từ tài liệu đã chọn. Chỉ dùng trích đoạn được phép sử dụng; không dán toàn bài."><textarea name="excerpt" required maxLength={500} rows={3} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending || !documents.length} className={buttonPrimary}>{pending?"Đang lưu…":"Lưu đề xuất"}</button>
 </form></Card>;
}
export function ReviewForm({id,status,others}:{id:string;status:string;others:{id:string;subject:string}[]}) {
 const [state,action,pending]=useActionState(reviewFact,{});
 return <form action={action} className="space-y-4 rounded-xl bg-fill/40 p-4">
 <input type="hidden" name="fact" value={id}/>
 <div className="grid gap-4 sm:grid-cols-2">
 <Field label="Quyết định"><select name="decision" className={control}>{status==="proposed"&&<><option value="reviewed">Đã kiểm tra bằng chứng</option><option value="rejected">Không chấp nhận</option></>}<option value="conflicted">Đánh dấu mâu thuẫn với thông tin khác</option></select></Field>
 <Field label="Thông tin đối chiếu (bắt buộc khi có mâu thuẫn)"><select name="related" className={control}><option value="">Chọn khi đánh dấu mâu thuẫn</option>{others.filter(o=>o.id!==id).map(o=><option key={o.id} value={o.id}>{o.subject} · {o.id.slice(0,8)}</option>)}</select></Field>
 </div>
 <Field label="Lý do / ghi chú kiểm tra"><textarea name="note" required maxLength={1000} rows={2} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending} className={buttonPrimary}>{pending?"Đang lưu…":"Ghi nhận quyết định"}</button>
 </form>;
}
