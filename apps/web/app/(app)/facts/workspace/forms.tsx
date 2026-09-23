"use client";
import { useActionState } from "react";
import { proposeFact, reviewFact } from "./actions";
const input="mt-2 w-full rounded-lg border bg-transparent p-3";
export function ProposalForm({documents,countries,selected}:{documents:{id:string;title:string|null}[];countries:{id:string;name:string}[];selected:string}) {
 const [state,action,pending]=useActionState(proposeFact,{});
 return <form action={action} className="space-y-4 rounded-2xl border p-6">
 <h2 className="text-xl font-medium">Thêm thông tin đề xuất</h2>
 <p className="text-sm text-zinc-500">Mở tài liệu gốc, chọn một câu có thông tin cụ thể và chép một đoạn ngắn hỗ trợ câu đó. Nếu chưa tìm được, bạn có thể quay lại sau; không cần điền nội dung phỏng đoán.</p>
 <label className="block">Tài liệu<select name="document" defaultValue={selected} required className={input}><option value="">Chọn tài liệu</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title ?? d.id}</option>)}</select></label>
 {[
 ["topic","Chủ đề: bài viết đang nói về lĩnh vực gì?",100],
 ["subject","Đối tượng: thông tin nói về ai hoặc điều gì?",200],
 ["predicate","Thuộc tính: điều gì được nêu về đối tượng?",200],
 ["value","Nội dung / giá trị: nguồn thực sự khẳng định điều gì?",2000],
 ].map(([name,label,max])=><label className="block" key={String(name)}>{label}<textarea name={String(name)} required maxLength={Number(max)} className={input}/></label>)}
 <label className="block">Đơn vị (nếu có)<input name="unit" maxLength={100} className={input}/></label>
 <label className="block">Quốc gia (nếu xác định được)<select name="country" className={input}><option value="">Chưa xác định / không áp dụng</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <div className="grid gap-4 sm:grid-cols-2"><label>Từ ngày (chỉ khi nguồn nêu)<input type="date" name="from" className={input}/></label><label>Đến ngày (chỉ khi nguồn nêu)<input type="date" name="until" className={input}/></label></div>
 <label className="block">Trích đoạn bằng chứng (nguyên văn, tối đa 500 ký tự)<textarea name="excerpt" required maxLength={500} className={input}/></label>
 <p className="text-sm">URL và ngày thu thập lấy từ tài liệu đã chọn. Chỉ dùng trích đoạn được phép sử dụng; không dán toàn bài.</p>
 <button disabled={pending || !documents.length} className="rounded-lg border px-5 py-3 disabled:opacity-50">{pending?"Đang lưu…":"Lưu đề xuất"}</button>
 {state.error&&<p role="alert">{state.error}</p>}{state.message&&<p role="status">{state.message}</p>}
 </form>;
}
export function ReviewForm({id,status,others}:{id:string;status:string;others:{id:string;subject:string}[]}) {
 const [state,action,pending]=useActionState(reviewFact,{});
 return <form action={action} className="mt-3 space-y-3 rounded-xl border p-4">
 <input type="hidden" name="fact" value={id}/>
 <label className="block">Quyết định<select name="decision" className={input}>{status==="proposed"&&<><option value="reviewed">Đã kiểm tra bằng chứng</option><option value="rejected">Không chấp nhận</option></>}<option value="conflicted">Đánh dấu mâu thuẫn với thông tin khác</option></select></label>
 <label className="block">Thông tin đối chiếu (bắt buộc khi có mâu thuẫn)<select name="related" className={input}><option value="">Chọn khi đánh dấu mâu thuẫn</option>{others.filter(o=>o.id!==id).map(o=><option key={o.id} value={o.id}>{o.subject} · {o.id.slice(0,8)}</option>)}</select></label>
 <label className="block">Lý do / ghi chú kiểm tra<textarea name="note" required maxLength={1000} className={input}/></label>
 <button disabled={pending} className="rounded-lg border px-4 py-2">{pending?"Đang lưu…":"Ghi nhận quyết định"}</button>
 {state.error&&<p role="alert">{state.error}</p>}{state.message&&<p role="status">{state.message}</p>}
 </form>;
}
