import { getDictionary, getLocale } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { ConflictForm, ProposalForm, ReviewForm, SourceChangeForm } from "./forms";
import { ItemStepper, SplitList, SplitPager, SplitRow, SplitView } from "@/components/review/split-view";
import { selectItem } from "@/lib/review/selection";
import { SamePageFacts } from "@/components/review/same-page-facts";
import type { Sibling } from "@/lib/review/siblings";
import { VisibilityNote } from "@/components/review/visibility-note";
import { ReviewSteps } from "@/components/review/review-steps";
import { DecisionHistory } from "@/components/review/decision-history";
import { factName } from "@/lib/review/history";
import { permissionName } from "@/lib/rbac/labels";
import { publicIds } from "@/lib/review/public-check";
import { factBlockers, visibilityOf } from "@/lib/review/visibility";
import { uuidPattern } from "@/lib/documents/domain";
import { likePattern } from "@/lib/education/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { Badge, Disclosure, EmptyState, NoAccess, PageHeader, SearchInput, Section, Segmented } from "@/components/ui";
import { textLink } from "@/components/ui/styles";

// "source_changed" is not a status: it is the Slice 9 queue of published
// claims whose evidence page changed (facts.source_changed_at is set).
const statusValues = ["proposed", "source_changed", "reviewed", "conflicted", "rejected"] as const;

export default async function Page({searchParams}:PageProps<"/facts/workspace">) {
 await requireAuth();
 const {client,permissions}=await accessContext();
 const propose=permissions.includes("facts.propose"), review=permissions.includes("facts.review");
 const [locale,dict]=[await getLocale(),await getDictionary()];
 const t=dict.factsWorkspace, e=dict.editor;
 if(!propose&&!review) return <NoAccess title={t.noAccessTitle} back="/facts" backLabel={t.seePublic}>{e.noAccessHelp(permissionName("facts.propose", locale),permissionName("facts.review", locale))}</NoAccess>;
 const params=await searchParams;
 const selected=typeof params.document==="string" && uuidPattern.test(params.document)?params.document:"";
 // Review queue first: the default tab is "proposed", one status per page of 25.
 const status=choiceParam(params,"status",statusValues,"proposed");
 const q=searchParam(params);
 const page=pageParam(params);
 const {from,to}=pageWindow(page);
 let list=client.from("facts").select(factSelect,{count:"exact"});
 list=status==="source_changed"?list.not("source_changed_at","is",null):list.eq("status",status);
 if(q) list=list.ilike("subject",likePattern(q));
 const counts=statusValues.map(s=>{const c=client.from("facts").select("id",{count:"exact",head:true});return s==="source_changed"?c.not("source_changed_at","is",null):c.eq("status",s);});
 const results=await Promise.all([
 list.order("created_at",{ascending:false}).range(from,to),
 client.from("documents").select("id,title").order("created_at",{ascending:false}).limit(100),
 client.from("countries").select("id,name").order("name"),
 // Two foreign keys point at facts, so each embed names its constraint.
 client.from("fact_reviews").select("id,decision,note,created_at,fact:facts!fact_reviews_fact_id_fkey(subject,predicate),related:facts!fact_reviews_related_fact_id_fkey(subject,predicate)").order("created_at",{ascending:false}).limit(20),
 // Slice 5/6a: draft or reviewed (never rejected) entities a fact can describe.
 client.from("programmes").select("id,name,universities!programmes_university_id_fkey(name)").neq("status","rejected").order("created_at",{ascending:false}).limit(100),
 client.from("universities").select("id,name").neq("status","rejected").order("created_at",{ascending:false}).limit(100),
 client.from("immigration_rules").select("id,title,countries(name)").neq("status","rejected").order("created_at",{ascending:false}).limit(100),
 client.from("occupations").select("id,name,countries(name)").neq("status","rejected").order("name").limit(200),
 client.from("comparison_metrics").select("id,label,unit_hint").eq("active",true).order("label"),
 // Only reviewed/conflicted claims can be paired as a conflict (2026-09-23 fix).
 client.from("facts").select("id,subject,predicate,value").in("status",["reviewed","conflicted"]).order("created_at",{ascending:false}).limit(200),
 ...counts,
 ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/facts/workspace", params, { page: null }));
 if(results.some(r=>r.error)){logAccessError("facts_workspace");throw new Error("Không tải được dữ liệu biên tập.");}
 const facts=(results[0].data ?? []) as unknown as FactRow[];
 const documents=results[1].data as {id:string;title:string|null}[];
 type Named={subject:string;predicate:string}|null;
 const reviews=results[3].data as unknown as {id:string;decision:string;note:string;created_at:string;fact:Named;related:Named}[];
 const entities=[
   ...(results[4].data as unknown as {id:string;name:string;universities:{name:string}}[]).map(p=>({value:`programme:${p.id}`,label:`${t.entity.programme}: ${p.name} · ${p.universities.name}`})),
   ...(results[5].data as {id:string;name:string}[]).map(u=>({value:`university:${u.id}`,label:`${t.entity.university}: ${u.name}`})),
   ...(results[6].data as unknown as {id:string;title:string;countries:{name:string}}[]).map(r=>({value:`immigration_rule:${r.id}`,label:`${t.entity.rule}: ${r.title} · ${r.countries.name}`})),
   ...(results[7].data as unknown as {id:string;name:string;countries:{name:string}|null}[]).map(o=>({value:`occupation:${o.id}`,label:`${t.entity.occupation}: ${o.name} · ${o.countries?.name ?? e.international}`})),
 ];
 const metrics=results[8].data as {id:string;label:string;unit_hint:string|null}[];
 // Readable choices: "subject — predicate: value", not an id prefix.
 const conflictCandidates=(results[9].data as {id:string;subject:string;predicate:string;value:string}[])
   .map(c=>({id:c.id,label:`${c.subject} — ${c.predicate}: ${c.value.length>60?c.value.slice(0,60)+"…":c.value}`}));
 const tabCounts=results.slice(10).map(r=>r.count ?? 0);
 // A document deep-link must remain usable even when it is outside the recent list.
 if(selected&&!documents.some(d=>d.id===selected)){
   const extra=await client.from("documents").select("id,title").eq("id",selected).maybeSingle();
   if(extra.error){logAccessError("facts_selected_document");throw new Error("Không tải được tài liệu đã chọn.");}
   if(extra.data) documents.unshift(extra.data);
 }
 // Split view selection (?fact=…); falls back to the first item on this page.
 const requested=typeof params.fact==="string"&&uuidPattern.test(params.fact)?params.fact:undefined;
 const selection=selectItem(facts.map(f=>f.id),requested);
 const current=selection.index>=0?facts[selection.index]:null;
 // Visibility: the database answers "is it public?" (anon client); linked
 // rules/occupations are loaded only to explain a "no" (lib/review/visibility.ts).
 const ruleIds=[...new Set(facts.flatMap(f=>f.immigration_rule_id?[f.immigration_rule_id]:[]))];
 const occupationIds=[...new Set(facts.flatMap(f=>f.occupation_id?[f.occupation_id]:[]))];
 const [linkedRules,linkedOccupations,visible,sameDocument]=await Promise.all([
   ruleIds.length?client.from("immigration_rules").select("id,status,documents!immigration_rules_document_id_fkey(sources(status,source_tier))").in("id",ruleIds):Promise.resolve({data:[],error:null}),
   occupationIds.length?client.from("occupations").select("id,status").in("id",occupationIds):Promise.resolve({data:[],error:null}),
   facts.some(f=>f.status==="reviewed"||f.status==="conflicted")?publicIds("facts",facts.map(f=>f.id)):Promise.resolve(new Set<string>()),
   // Other claims from the same evidence document, for the selected claim only
   // (lib/review/siblings.ts). Fetched in the same round as the lookups above,
   // since each Supabase round trip is slow.
   current?client.from("facts").select("id,subject,predicate,value,unit,status").eq("document_id",current.document_id).neq("id",current.id).order("created_at").limit(30):Promise.resolve({data:[],error:null}),
 ]);
 // Editors' RLS shows every status; a failure is shown, not hidden.
 if(sameDocument.error) logAccessError("facts_workspace_same_document");
 const siblings:Sibling[]|null=sameDocument.error?null:sameDocument.data as Sibling[];
 if(linkedRules.error||linkedOccupations.error){logAccessError("facts_workspace_links");throw new Error("Không tải được dữ liệu biên tập.");}
 const rules=new Map((linkedRules.data as unknown as {id:string;status:string;documents:{sources:{status:string;source_tier:string|null}}}[]).map(r=>[r.id,{status:r.status,source:r.documents.sources}]));
 const occupations=new Map((linkedOccupations.data as {id:string;status:string}[]).map(o=>[o.id,o]));
 const visibility=(f:FactRow)=>visibilityOf(f.id,f.status,visible,factBlockers({
   source:{status:f.documents.sources.status ?? "",source_tier:f.documents.sources.source_tier},
   rule:f.immigration_rule_id?rules.get(f.immigration_rule_id) ?? {status:"",source:{status:"",source_tier:null}}:null,
   occupation:f.occupation_id?occupations.get(f.occupation_id) ?? {status:""}:null,
 }));
 return <>
 <PageHeader eyebrow={e.eyebrow} title={t.title} description={t.description} actions={<Link className={`${textLink} text-[15px]`} href="/facts">{e.viewPublic}</Link>}/>
 {review&&<ReviewSteps client={client} permissions={permissions} current="facts" locale={locale}/>}
 {/* Collapsed by default so the queue is visible; opened when arriving from a document. */}
 {propose&&<Disclosure open={!!selected} summary={t.addProposal}><ProposalForm locale={locale} documents={documents} countries={results[2].data as {id:string;name:string}[]} selected={selected} entities={entities} metrics={metrics}/></Disclosure>}
 <Section title={t.proposals}>
 <div className="flex flex-wrap items-center justify-between gap-3">
 <Segmented label={e.filterStatus} items={statusValues.map((value,i)=>({href:withParams("/facts/workspace",{q},{status:value==="proposed"?null:value}),label:t.tabs[value],count:tabCounts[i],active:status===value}))}/>
 <form action="/facts/workspace" className="mb-5 w-full sm:w-72">{status!=="proposed"&&<input type="hidden" name="status" value={status}/>}<SearchInput defaultValue={q} placeholder={t.searchPlaceholder}/></form>
 </div>
 {facts.length?<SplitView detailKey={current?.id} detailOnMobile={!!requested} backHref={withParams("/facts/workspace",params,{fact:null})}
   list={<SplitList label={t.listLabel} footer={<SplitPager locale={locale} summary={pageSummary(results[0].count ?? facts.length,page)} href={p=>withParams("/facts/workspace",params,{page:p,fact:null})}/>}>
     {facts.map(f=>{const v=visibility(f);return <SplitRow key={f.id} href={withParams("/facts/workspace",params,{fact:f.id})} selected={f.id===current?.id} explicit={!!requested}
       title={`${f.subject} — ${f.predicate}`} subtitle={`${f.value}${f.unit?" "+f.unit:""} · ${f.documents.sources.name}`}
       badges={(f.origin==="ai"||f.source_changed_at||v?.state==="hidden"||v?.state==="will_stay_hidden")?<>
         {f.origin==="ai"&&<Badge tone="accent">AI</Badge>}
         {f.source_changed_at&&<Badge tone="caution">{e.sourceChanged}</Badge>}
         {(v?.state==="hidden"||v?.state==="will_stay_hidden")&&<Badge tone="caution">{e.notPublic}</Badge>}
       </>:undefined}/>;})}
   </SplitList>}
   detail={current&&<>
     <ItemStepper locale={locale} index={selection.index} count={facts.length}
       prevHref={selection.prevId?withParams("/facts/workspace",params,{fact:selection.prevId}):null}
       nextHref={selection.nextId?withParams("/facts/workspace",params,{fact:selection.nextId}):null}/>
     <div className="space-y-4">
     <FactCard fact={current} internal locale={locale}/>
     <div className="space-y-3 px-1">
     <VisibilityNote visibility={visibility(current)} publicHref="/facts" locale={locale}/>
     <SamePageFacts current={current} others={siblings} locale={locale}/>
     {/* The decision sits right under the claim. After a decision the item leaves this tab and the next one opens (lib/review/selection.ts). */}
     {review&&current.status==="proposed"&&<ReviewForm key={current.id} id={current.id} ai={current.origin==="ai"} locale={locale}/>}
     {review&&current.source_changed_at&&<Disclosure small open={status==="source_changed"} summary={t.compareNewVersion}><SourceChangeForm key={current.id} id={current.id} locale={locale}/></Disclosure>}
     {review&&status!=="source_changed"&&(current.status==="reviewed"||current.status==="conflicted")&&conflictCandidates.length>1&&<Disclosure small summary={t.markConflict}><ConflictForm key={current.id} id={current.id} others={conflictCandidates} locale={locale}/></Disclosure>}
     </div></div>
   </>}/>
  :<EmptyState>{status==="proposed"?t.emptyProposed:status==="source_changed"?t.emptyChanged:e.emptyGroup}{q?e.searchSuffix(q):""}</EmptyState>}
 </Section>
 <Section>
 <DecisionHistory locale={locale} items={reviews.map(r=>({id:r.id,decision:r.decision,note:r.note,createdAt:r.created_at,title:factName(r.fact,locale),
   detail:r.related?t.conflictWith(factName(r.related,locale)):undefined}))}/>
 </Section>
 </>;
}
