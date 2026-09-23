import Link from "next/link";
import { statuses, validity } from "./domain";
export type FactRow = {
 id:string; document_id:string; topic:string; subject:string; predicate:string; value:string;
 unit:string|null; status:string; valid_from:string|null; valid_until:string|null; reviewed_at:string|null;
 evidence:{source_url:string;excerpt:string;retrieved_at:string};
 documents:{title:string|null;sources:{name:string;source_tier:string|null}};
};
export const factSelect = "id,document_id,topic,subject,predicate,value,unit,status,valid_from,valid_until,reviewed_at,evidence(source_url,excerpt,retrieved_at),documents!facts_document_id_fkey(title,sources(name,source_tier))";
export function FactCard({fact}:{fact:FactRow}) {
 return <article className="space-y-3 rounded-2xl border p-6">
   <p className="text-sm text-zinc-500">{fact.topic} · {statuses[fact.status]}</p>
   <h2 className="text-xl font-medium">{fact.subject} — {fact.predicate}</h2>
   <p className="whitespace-pre-wrap">{fact.value}{fact.unit ? " "+fact.unit : ""}</p>
   <p className="text-sm">{validity(fact.valid_from,fact.valid_until)} · Từ: {fact.valid_from ?? "chưa biết"} · Đến: {fact.valid_until ?? "chưa biết"}</p>
   <p className="text-sm">Ngày duyệt bằng chứng: {fact.reviewed_at ? new Date(fact.reviewed_at).toISOString().slice(0,10) : "chưa có"}. Chưa xác minh hiệu lực hiện tại.</p>
   <p className="text-sm">Nguồn: {fact.documents.sources.name} · Tier: {fact.documents.sources.source_tier ?? "chưa phân loại"}</p>
   {[fact.evidence].map((e,i)=><div key={i}><blockquote className="whitespace-pre-wrap border-l-2 pl-4">{e.excerpt}</blockquote><p className="mt-2 text-sm">Thu thập: {new Date(e.retrieved_at).toISOString().slice(0,10)} · <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="underline">Mở nguồn gốc</a></p></div>)}
   <Link className="inline-block text-sm underline" href={`/documents/${fact.document_id}`}>Tài liệu và phiên bản bằng chứng</Link>
   <p className="text-xs text-zinc-500">Thông tin nghiên cứu; không phải tư vấn pháp lý.</p>
 </article>;
}
