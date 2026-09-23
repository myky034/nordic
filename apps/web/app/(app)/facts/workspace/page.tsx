import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { ProposalForm, ReviewForm } from "./forms";
import { uuidPattern } from "@/lib/documents/domain";
export default async function Page({searchParams}:PageProps<"/facts/workspace">) {
 await requireAuth();
 const {client,permissions}=await accessContext();
 const propose=permissions.includes("facts.propose"), review=permissions.includes("facts.review");
 if(!propose&&!review) return <section><h1>Bạn chưa có quyền biên tập thông tin</h1><p>Nhờ quản trị viên cấp facts.propose hoặc facts.review tại Người dùng & phân quyền.</p><Link href="/facts">Xem thông tin công khai</Link></section>;
 const params=await searchParams;
 const selected=typeof params.document==="string" && uuidPattern.test(params.document)?params.document:"";
 const results=await Promise.all([
 client.from("facts").select(factSelect).order("created_at",{ascending:false}).limit(100),
 client.from("documents").select("id,title").order("created_at",{ascending:false}).limit(100),
 client.from("countries").select("id,name").order("name"),
 client.from("fact_reviews").select("id,fact_id,decision,note,created_at,related_fact_id").order("created_at",{ascending:false}).limit(100),
 ]);
 if(results.some(r=>r.error)){logAccessError("facts_workspace");throw new Error("Không tải được dữ liệu biên tập.");}
 const facts=results[0].data as unknown as FactRow[];
 const documents=results[1].data!;
 // A document deep-link must remain usable even when it is outside the recent list.
 if(selected&&!documents.some(d=>d.id===selected)){
   const extra=await client.from("documents").select("id,title").eq("id",selected).maybeSingle();
   if(extra.error){logAccessError("facts_selected_document");throw new Error("Không tải được tài liệu đã chọn.");}
   if(extra.data) documents.unshift(extra.data);
 }
 return <div className="mx-auto max-w-4xl space-y-8"><header><h1 className="text-3xl font-semibold">Thông tin & bằng chứng</h1><p className="mt-3">Nhập thủ công từ nguồn. Duyệt bằng chứng không đồng nghĩa xác minh hiệu lực.</p><Link className="underline" href="/facts">Xem trang công khai</Link></header>
 {propose&&<ProposalForm documents={documents} countries={results[2].data!} selected={selected}/>}
 <h2 className="text-2xl">100 đề xuất gần nhất</h2>
 {!facts.length&&<p>Chưa có đề xuất. Hãy mở nguồn gốc của tài liệu và tìm một câu có thể đối chiếu trực tiếp.</p>}
 {facts.map(f=><section key={f.id}><FactCard fact={f}/>{review&&f.status!=="rejected"&&<ReviewForm id={f.id} status={f.status} others={facts.filter(o=>o.status!=="rejected")}/>}</section>)}
 <section><h2 className="text-xl">100 quyết định gần nhất</h2>{results[3].data!.map(r=><details key={r.id} className="mt-3 rounded-lg border p-4"><summary>{r.created_at} · {r.decision}</summary><p className="break-all">Thông tin: {r.fact_id}</p><p>{r.note}</p>{r.related_fact_id&&<p className="break-all">Mâu thuẫn với: {r.related_fact_id}</p>}</details>)}</section>
 </div>;
}
