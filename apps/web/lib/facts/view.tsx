import Link from "next/link";
import { Badge, ExternalLink, Quote } from "@/components/ui";
import { ReviewBadge, TierBadge } from "@/components/ui/badges";
import { statuses, validity } from "./domain";
import { deadlineLabel } from "../education/domain";
import { isOfficialTier } from "../immigration/domain";
import { isOfficialStatisticsTier } from "../labour/domain";
export type FactRow = {
 id:string; document_id:string; topic:string; subject:string; predicate:string; value:string;
 unit:string|null; status:string; programme_id?:string|null; deadline_type?:string|null; immigration_rule_id?:string|null; occupation_id?:string|null; reference_period?:string|null; metric_id?:string|null; source_changed_at?:string|null; source_changed_document_id?:string|null; comparison_metrics?:{label:string}|null; valid_from:string|null; valid_until:string|null; reviewed_at:string|null;
 evidence:{source_url:string;excerpt:string;retrieved_at:string};
 documents:{title:string|null;sources:{name:string;source_tier:string|null}};
};
export const factSelect = "id,document_id,programme_id,deadline_type,immigration_rule_id,occupation_id,reference_period,metric_id,source_changed_at,source_changed_document_id,comparison_metrics(label),topic,subject,predicate,value,unit,status,valid_from,valid_until,reviewed_at,evidence(source_url,excerpt,retrieved_at),documents!facts_document_id_fkey(title,sources(name,source_tier))";
const day=(value:string|null)=>value?new Date(value).toISOString().slice(0,10):"chưa có";
// One claim = one card: the value is the headline, status and source are
// badges, the supporting excerpt is quoted, dates sit in a quiet meta grid.
export function FactCard({fact}:{fact:FactRow}) {
 const e=fact.evidence;
 return <article className="rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{fact.topic}</p>
     <ReviewBadge status={fact.status}>{statuses[fact.status]}</ReviewBadge>
   </div>
   <h3 className="mt-2 text-[17px] font-medium leading-snug text-ink-2">{fact.subject} — {fact.predicate}</h3>
   <p className="mt-1 whitespace-pre-wrap break-words text-[22px] font-semibold leading-snug tracking-[-0.01em] text-ink">{fact.value}{fact.unit ? " "+fact.unit : ""}</p>
   {(deadlineLabel(fact.deadline_type)||fact.reference_period||fact.comparison_metrics)&&<p className="mt-2 flex flex-wrap gap-2">{fact.comparison_metrics&&<Badge>Chỉ số: {fact.comparison_metrics.label}</Badge>}{deadlineLabel(fact.deadline_type)&&<Badge>Loại deadline: {deadlineLabel(fact.deadline_type)}</Badge>}{fact.reference_period&&<Badge tone="accent">Kỳ số liệu: {fact.reference_period}</Badge>}</p>}
   {fact.occupation_id&&!isOfficialStatisticsTier(fact.documents.sources.source_tier)&&<p role="note" className="mt-4 rounded-xl bg-caution/[0.08] px-4 py-3 text-[15px] text-caution">Không phải số liệu thống kê chính thức (nguồn không thuộc T1/T2). Chỉ tham khảo.</p>}
   {fact.immigration_rule_id&&!isOfficialTier(fact.documents.sources.source_tier)&&<p role="note" className="mt-4 rounded-xl bg-caution/[0.08] px-4 py-3 text-[15px] text-caution">Không phải nguồn chính thức (T1). Chỉ tham khảo; kiểm tra lại trên trang của cơ quan di trú.</p>}
   {/* Slice 9: the crawler saw a newer version of the evidence page. The claim
       stays visible (Slice 9 decision, Section 21) but must not look current. */}
   {fact.source_changed_at&&<p role="note" className="mt-4 rounded-xl bg-caution/[0.08] px-4 py-3 text-[15px] text-caution">Trang nguồn đã thay đổi từ {day(fact.source_changed_at)}; thông tin này có thể đã cũ và đang chờ kiểm tra lại.{fact.source_changed_document_id&&<> <Link className="underline underline-offset-4" href={`/documents/${fact.source_changed_document_id}`}>Xem phiên bản mới</Link></>}</p>}
   <div className="mt-5"><Quote>{e.excerpt}</Quote></div>
   <dl className="mt-5 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
     <div><dt className="text-ink-3">Nguồn</dt><dd className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] text-ink">Nguồn: {fact.documents.sources.name} <span className="sr-only">· Tier: {fact.documents.sources.source_tier ?? "chưa phân loại"}</span><TierBadge tier={fact.documents.sources.source_tier}/></dd></div>
     <div><dt className="text-ink-3">Hiệu lực</dt><dd className="mt-0.5 text-[15px] text-ink">{validity(fact.valid_from,fact.valid_until)} · Từ: {fact.valid_from ?? "chưa biết"} · Đến: {fact.valid_until ?? "chưa biết"}</dd></div>
     <div><dt className="text-ink-3">Thu thập</dt><dd className="mt-0.5 text-[15px] text-ink">Thu thập: {day(e.retrieved_at)}</dd></div>
     <div><dt className="text-ink-3">Duyệt bằng chứng</dt><dd className="mt-0.5 text-[15px] text-ink">Ngày duyệt bằng chứng: {day(fact.reviewed_at)}. Chưa xác minh hiệu lực hiện tại.</dd></div>
   </dl>
   <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline pt-4 text-[15px]">
     <ExternalLink href={e.source_url}>Mở nguồn gốc</ExternalLink>
     <Link className="text-accent hover:underline underline-offset-4" href={`/documents/${fact.document_id}`}>Tài liệu và phiên bản bằng chứng</Link>
     {fact.immigration_rule_id&&<Link className="text-accent hover:underline underline-offset-4" href={`/immigration/${fact.immigration_rule_id}`}>Quy định nhập cư liên quan</Link>}
     {fact.occupation_id&&<Link className="text-accent hover:underline underline-offset-4" href={`/occupations/${fact.occupation_id}`}>Nghề liên quan</Link>}
     {fact.programme_id&&<Link className="text-accent hover:underline underline-offset-4" href={`/programmes/${fact.programme_id}`}>Chương trình liên quan</Link>}
   </div>
   <p className="mt-3 text-[13px] text-ink-3">Thông tin nghiên cứu; không phải tư vấn pháp lý.</p>
 </article>;
}
