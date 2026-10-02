import Link from "next/link";
import { Badge, Disclosure, ExternalLink, Quote } from "@/components/ui";
import { ReviewBadge, TierBadge } from "@/components/ui/badges";
import { statuses, topicLabel, validity, validityShort } from "./domain";
import { deadlineLabel } from "../education/domain";
import { isOfficialTier } from "../immigration/domain";
import { isOfficialStatisticsTier } from "../labour/domain";
import { confidenceLabel } from "../extraction/domain";
export type FactRow = {
 id:string; document_id:string; topic:string; subject:string; predicate:string; value:string;
 unit:string|null; status:string; programme_id?:string|null; deadline_type?:string|null; immigration_rule_id?:string|null; occupation_id?:string|null; reference_period?:string|null; metric_id?:string|null; source_changed_at?:string|null; source_changed_document_id?:string|null; origin?:string; ai_model?:string|null; ai_confidence?:number|string|null; comparison_metrics?:{label:string}|null; valid_from:string|null; valid_until:string|null; reviewed_at:string|null;
 evidence:{source_url:string;excerpt:string;retrieved_at:string};
 documents:{title:string|null;sources:{name:string;source_tier:string|null;status?:string}};
};
export const factSelect = "id,document_id,programme_id,deadline_type,immigration_rule_id,occupation_id,reference_period,metric_id,source_changed_at,source_changed_document_id,origin,ai_model,ai_confidence,comparison_metrics(label),topic,subject,predicate,value,unit,status,valid_from,valid_until,reviewed_at,evidence(source_url,excerpt,retrieved_at),documents!facts_document_id_fkey(title,sources(name,source_tier,status))";
const day=(value:string|null)=>value?new Date(value).toISOString().slice(0,10):"chưa có";
// One claim = one card: the value is the headline, status and source are
// badges, the supporting excerpt is quoted, dates sit in a quiet meta grid.
// `internal`: also show operational labels (AI origin and model, the
// "reviewed" badge) — editors only, see seesInternalDetails() in lib/rbac/ui.ts.
export function FactCard({fact, internal=false}:{fact:FactRow; internal?:boolean}) {
 if(!internal) return <PublicFactCard fact={fact}/>;
 const e=fact.evidence;
 return <article className="rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{topicLabel(fact.topic)}</p>
     {/* Public pages list only reviewed or conflicted facts, so "reviewed" says
         nothing to a visitor; a conflict (or any other state) is always shown. */}
     {(internal||fact.status!=="reviewed")&&<ReviewBadge status={fact.status}>{statuses[fact.status]}</ReviewBadge>}
   </div>
   {/* Slice 10a: AI origin. Editors only since 2026-10-02 (owner decision, PROJECT_SPEC Decision Log). */}
   {internal&&fact.origin==="ai"&&<p className="mt-2 flex flex-wrap gap-2"><Badge tone="accent">{fact.status==="proposed"?"Đề xuất bởi AI":"Trích bởi AI, đã qua người duyệt"}{fact.ai_model?` · ${fact.ai_model}`:""}</Badge>{fact.status==="proposed"&&confidenceLabel(fact.ai_confidence)&&<Badge>{confidenceLabel(fact.ai_confidence)}</Badge>}</p>}
   <h3 className="mt-2 text-[17px] font-medium leading-snug text-ink-2">{fact.subject} — {fact.predicate}</h3>
   <p className="mt-1 whitespace-pre-wrap break-words text-[22px] font-semibold leading-snug tracking-[-0.01em] text-ink">{fact.value}{fact.unit ? " "+fact.unit : ""}</p>
   <FactBadges fact={fact}/>
   <FactNotes fact={fact}/>
   <div className="mt-5"><Quote>{e.excerpt}</Quote></div>
   <dl className="mt-5 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
     {/* Each value appears once under its label; unknown dates are said, not hidden (AGENTS.md 12). */}
     <div><dt className="text-ink-3">Nguồn</dt><dd className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] text-ink">{fact.documents.sources.name}<TierBadge tier={fact.documents.sources.source_tier}/></dd></div>
     <div><dt className="text-ink-3">Hiệu lực</dt><dd className="mt-0.5 text-[15px] text-ink">{validity(fact.valid_from,fact.valid_until)}<span className="block text-[13px] text-ink-3">{fact.valid_from||fact.valid_until?`Nguồn ghi: từ ${fact.valid_from ?? "không nêu"} đến ${fact.valid_until ?? "không nêu"}`:"Nguồn không nêu thời hạn áp dụng"}</span></dd></div>
     <div><dt className="text-ink-3">Ngày lấy trang nguồn</dt><dd className="mt-0.5 text-[15px] text-ink">{day(e.retrieved_at)}</dd></div>
     <div><dt className="text-ink-3">Ngày duyệt bằng chứng</dt><dd className="mt-0.5 text-[15px] text-ink">{fact.reviewed_at?day(fact.reviewed_at):"Chưa duyệt"}</dd></div>
   </dl>
   <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-hairline pt-4 text-[15px]">
     <ExternalLink href={e.source_url}>Mở trang gốc</ExternalLink>
     <Link className="text-accent hover:underline underline-offset-4" href={`/documents/${fact.document_id}`}>Tài liệu và các phiên bản</Link>
     <RelatedLinks fact={fact}/>
   </div>
   <p className="mt-3 text-[13px] text-ink-3">Thông tin nghiên cứu; không phải tư vấn pháp lý.</p>
 </article>;
}

// Warnings a reader must not miss, on both card variants: unofficial
// statistics or immigration sources, and a changed evidence page.
function FactNotes({fact}:{fact:FactRow}) {
 return <>
   {fact.occupation_id&&!isOfficialStatisticsTier(fact.documents.sources.source_tier)&&<p role="note" className="mt-4 rounded-xl bg-caution/[0.08] px-4 py-3 text-[15px] text-caution">Không phải số liệu thống kê chính thức (nguồn không thuộc T1/T2). Chỉ tham khảo.</p>}
   {fact.immigration_rule_id&&!isOfficialTier(fact.documents.sources.source_tier)&&<p role="note" className="mt-4 rounded-xl bg-caution/[0.08] px-4 py-3 text-[15px] text-caution">Không phải nguồn chính thức (T1). Chỉ tham khảo; kiểm tra lại trên trang của cơ quan di trú.</p>}
   {/* Slice 9: the crawler saw a newer version of the evidence page. The claim
       stays visible (Slice 9 decision, Section 21) but must not look current. */}
   {fact.source_changed_at&&<p role="note" className="mt-4 rounded-xl bg-caution/[0.08] px-4 py-3 text-[15px] text-caution">Trang nguồn đã thay đổi từ {day(fact.source_changed_at)}; thông tin này có thể đã cũ và đang chờ kiểm tra lại.{fact.source_changed_document_id&&<> <Link className="underline underline-offset-4" href={`/documents/${fact.source_changed_document_id}`}>Xem phiên bản mới</Link></>}</p>}
 </>;
}
function FactBadges({fact}:{fact:FactRow}) {
 if(!(deadlineLabel(fact.deadline_type)||fact.reference_period||fact.comparison_metrics)) return null;
 return <p className="mt-2 flex flex-wrap gap-2">{fact.comparison_metrics&&<Badge>Chỉ số: {fact.comparison_metrics.label}</Badge>}{deadlineLabel(fact.deadline_type)&&<Badge>Hạn nộp: {deadlineLabel(fact.deadline_type)}</Badge>}{fact.reference_period&&<Badge tone="accent">Kỳ số liệu: {fact.reference_period}</Badge>}</p>;
}
function RelatedLinks({fact}:{fact:FactRow}) {
 return <>
     {fact.immigration_rule_id&&<Link className="text-accent hover:underline underline-offset-4" href={`/immigration/${fact.immigration_rule_id}`}>Quy định nhập cư liên quan</Link>}
     {fact.occupation_id&&<Link className="text-accent hover:underline underline-offset-4" href={`/occupations/${fact.occupation_id}`}>Nghề liên quan</Link>}
     {fact.programme_id&&<Link className="text-accent hover:underline underline-offset-4" href={`/programmes/${fact.programme_id}`}>Chương trình liên quan</Link>}
 </>;
}

/**
 * The visitor's card (owner, 2026-10-02): the answer first — what it is about
 * and the value — then ONE line with the source (a link to the original page),
 * the retrieval date and the validity status, which AGENTS.md §1.5/§12/§23
 * require to stay visible. The excerpt, full dates and document links are one
 * click away under "Xem bằng chứng" (a native <details>, no client JS).
 * Warnings (unofficial source, changed page, conflict) are never folded away.
 */
function PublicFactCard({fact}:{fact:FactRow}) {
 const e=fact.evidence;
 return <article className="rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{fact.comparison_metrics?.label ?? topicLabel(fact.topic)}</p>
     {fact.status!=="reviewed"&&<ReviewBadge status={fact.status}>{statuses[fact.status]}</ReviewBadge>}
   </div>
   <h3 className="mt-1.5 text-[15px] leading-snug text-ink-2">{fact.subject} — {fact.predicate}</h3>
   <p className="mt-1 whitespace-pre-wrap break-words text-[20px] font-semibold leading-snug tracking-[-0.01em] text-ink">{fact.value}{fact.unit ? " "+fact.unit : ""}</p>
   <FactBadges fact={fact}/>
   <FactNotes fact={fact}/>
   <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-3">
     <span>Nguồn:</span><ExternalLink quiet href={e.source_url} className="text-ink-2">{fact.documents.sources.name}</ExternalLink>
     <TierBadge tier={fact.documents.sources.source_tier}/>
     <span aria-hidden="true">·</span><span>lấy trang {day(e.retrieved_at)}</span>
     <span aria-hidden="true">·</span><span>{validityShort(fact.valid_from,fact.valid_until)}</span>
   </p>
   <Disclosure small summary="Xem bằng chứng" className="mt-3">
     <Quote>{e.excerpt}</Quote>
     <dl className="mt-4 grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
       <div><dt className="text-ink-3">Hiệu lực</dt><dd className="mt-0.5 text-[14px] text-ink">{validity(fact.valid_from,fact.valid_until)}<span className="block text-[13px] text-ink-3">{fact.valid_from||fact.valid_until?`Nguồn ghi: từ ${fact.valid_from ?? "không nêu"} đến ${fact.valid_until ?? "không nêu"}`:"Nguồn không nêu thời hạn áp dụng"}</span></dd></div>
       <div><dt className="text-ink-3">Ngày lấy trang nguồn · ngày duyệt</dt><dd className="mt-0.5 text-[14px] text-ink">{day(e.retrieved_at)} · {fact.reviewed_at?day(fact.reviewed_at):"chưa duyệt"}</dd></div>
     </dl>
     <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
       <ExternalLink href={e.source_url}>Mở trang gốc</ExternalLink>
       <Link className="text-accent hover:underline underline-offset-4" href={`/documents/${fact.document_id}`}>Tài liệu và các phiên bản</Link>
       <RelatedLinks fact={fact}/>
     </div>
     <p className="mt-3 text-[12px] text-ink-3">Thông tin nghiên cứu; không phải tư vấn pháp lý.</p>
   </Disclosure>
 </article>;
}
