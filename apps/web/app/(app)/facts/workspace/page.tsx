import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { ProposalForm, ReviewForm } from "./forms";
import { uuidPattern } from "@/lib/documents/domain";
import { likePattern } from "@/lib/education/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, SearchInput, Section, Segmented } from "@/components/ui";
import { textLink } from "@/components/ui/styles";

const tabs = [["proposed", "Chờ duyệt"], ["reviewed", "Đã duyệt"], ["conflicted", "Mâu thuẫn"], ["rejected", "Từ chối"]] as const;
const statusValues = tabs.map(([value]) => value);

export default async function Page({searchParams}:PageProps<"/facts/workspace">) {
 await requireAuth();
 const {client,permissions}=await accessContext();
 const propose=permissions.includes("facts.propose"), review=permissions.includes("facts.review");
 if(!propose&&!review) return <NoAccess title="Bạn chưa có quyền biên tập thông tin" back="/facts" backLabel="Xem thông tin công khai">Nhờ quản trị viên cấp facts.propose hoặc facts.review tại Người dùng & phân quyền.</NoAccess>;
 const params=await searchParams;
 const selected=typeof params.document==="string" && uuidPattern.test(params.document)?params.document:"";
 // Review queue first: the default tab is "proposed", one status per page of 25.
 const status=choiceParam(params,"status",statusValues,"proposed");
 const q=searchParam(params);
 const page=pageParam(params);
 const {from,to}=pageWindow(page);
 let list=client.from("facts").select(factSelect,{count:"exact"}).eq("status",status);
 if(q) list=list.ilike("subject",likePattern(q));
 const counts=statusValues.map(s=>client.from("facts").select("id",{count:"exact",head:true}).eq("status",s));
 const results=await Promise.all([
 list.order("created_at",{ascending:false}).range(from,to),
 client.from("documents").select("id,title").order("created_at",{ascending:false}).limit(100),
 client.from("countries").select("id,name").order("name"),
 client.from("fact_reviews").select("id,fact_id,decision,note,created_at,related_fact_id").order("created_at",{ascending:false}).limit(20),
 // Slice 5/6a: draft or reviewed (never rejected) entities a fact can describe.
 client.from("programmes").select("id,name,universities!programmes_university_id_fkey(name)").neq("status","rejected").order("created_at",{ascending:false}).limit(100),
 client.from("universities").select("id,name").neq("status","rejected").order("created_at",{ascending:false}).limit(100),
 client.from("immigration_rules").select("id,title,countries(name)").neq("status","rejected").order("created_at",{ascending:false}).limit(100),
 // Only reviewed/conflicted claims can be paired as a conflict (2026-09-23 fix).
 client.from("facts").select("id,subject").in("status",["reviewed","conflicted"]).order("created_at",{ascending:false}).limit(200),
 ...counts,
 ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/facts/workspace", params, { page: null }));
 if(results.some(r=>r.error)){logAccessError("facts_workspace");throw new Error("Không tải được dữ liệu biên tập.");}
 const facts=(results[0].data ?? []) as unknown as FactRow[];
 const documents=results[1].data as {id:string;title:string|null}[];
 const reviews=results[3].data as {id:string;fact_id:string;decision:string;note:string;created_at:string;related_fact_id:string|null}[];
 const entities=[
   ...(results[4].data as unknown as {id:string;name:string;universities:{name:string}}[]).map(p=>({value:`programme:${p.id}`,label:`Chương trình: ${p.name} · ${p.universities.name}`})),
   ...(results[5].data as {id:string;name:string}[]).map(u=>({value:`university:${u.id}`,label:`Trường: ${u.name}`})),
   ...(results[6].data as unknown as {id:string;title:string;countries:{name:string}}[]).map(r=>({value:`immigration_rule:${r.id}`,label:`Quy định nhập cư: ${r.title} · ${r.countries.name}`})),
 ];
 const conflictCandidates=results[7].data as {id:string;subject:string}[];
 const tabCounts=results.slice(8).map(r=>r.count ?? 0);
 // A document deep-link must remain usable even when it is outside the recent list.
 if(selected&&!documents.some(d=>d.id===selected)){
   const extra=await client.from("documents").select("id,title").eq("id",selected).maybeSingle();
   if(extra.error){logAccessError("facts_selected_document");throw new Error("Không tải được tài liệu đã chọn.");}
   if(extra.data) documents.unshift(extra.data);
 }
 return <>
 <PageHeader eyebrow="Workspace" title="Thông tin & bằng chứng" description="Nhập thủ công từ nguồn. Duyệt bằng chứng không đồng nghĩa xác minh hiệu lực." actions={<Link className={`${textLink} text-[15px]`} href="/facts">Xem trang công khai</Link>}/>
 {/* Collapsed by default so the queue is visible; opened when arriving from a document. */}
 {propose&&<Disclosure open={!!selected} summary="Thêm thông tin đề xuất"><ProposalForm documents={documents} countries={results[2].data as {id:string;name:string}[]} selected={selected} entities={entities}/></Disclosure>}
 <Section title="Đề xuất">
 <Segmented label="Lọc theo trạng thái" items={tabs.map(([value,label],i)=>({href:withParams("/facts/workspace",{q},{status:value==="proposed"?null:value}),label,count:tabCounts[i],active:status===value}))}/>
 <form action="/facts/workspace" className="mb-5">{status!=="proposed"&&<input type="hidden" name="status" value={status}/>}<SearchInput defaultValue={q} placeholder="Tìm theo đối tượng"/></form>
 {facts.length?<div className="space-y-4">{facts.map(f=><div key={f.id} className="space-y-2"><FactCard fact={f}/>{review&&f.status!=="rejected"&&(f.status==="proposed"||conflictCandidates.length>1)&&<div className="px-1"><Disclosure small summary={f.status==="proposed"?"Duyệt đề xuất này":"Đánh dấu mâu thuẫn"}><ReviewForm id={f.id} status={f.status} others={conflictCandidates}/></Disclosure></div>}</div>)}</div>
  :<EmptyState>{status==="proposed"?"Không có đề xuất nào đang chờ duyệt.":"Không có mục nào trong nhóm này."}{q?` (tìm “${q}”)`:""}</EmptyState>}
 <Pagination summary={pageSummary(results[0].count ?? facts.length,page)} href={p=>withParams("/facts/workspace",params,{page:p})}/>
 </Section>
 <Section>
 <Disclosure summary="20 quyết định gần nhất">
 {reviews.length?<List>{reviews.map(r=><ListRow key={r.id} title={r.decision} meta={new Date(r.created_at).toISOString().replace("T"," ").slice(0,16)} subtitle={r.note}>
   <p className="break-all text-[13px] text-ink-3">Thông tin: {r.fact_id}{r.related_fact_id&&<><br/>Mâu thuẫn với: {r.related_fact_id}</>}</p>
 </ListRow>)}</List>:<EmptyState>Chưa có quyết định nào.</EmptyState>}
 </Disclosure>
 </Section>
 </>;
}
