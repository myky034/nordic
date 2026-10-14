"use client";
import { useActionState, useState } from "react";
import { proposeFact, resolveSourceChange, reviewFact, setFactType } from "./actions";
import { deadlineOptions } from "@/lib/education/domain";
import { valuePeriodLabel, valuePeriods } from "@/lib/compare/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
/** A fact type as the proposal form needs it (labels already in the editor's language). */
export type FormFactType={id:string;label:string;definition:string;value_kind:string;applies_to:string;unit_hint:string|null;min_value:number|string|null;max_value:number|string|null};
export function ProposalForm({documents,countries,selected,entities=[],metrics=[],locale}:{documents:{id:string;title:string|null}[];countries:{id:string;name:string}[];selected:string;entities?:{value:string;label:string}[];metrics?:FormFactType[];locale:Locale}) {
 const [state,action,pending]=useActionState(proposeFact,{});
 const d=dictionaries[locale], t=d.factsWorkspace.form, e=d.editor;
 // L3a: the type list follows the linked item ("programme:<id>" → programme
 // types; nothing linked → country types), and the structured fields follow
 // the chosen type's value kind. The database checks the same rules again.
 const [entity,setEntity]=useState("");
 const [typeId,setTypeId]=useState("");
 const kind=entity ? entity.split(":")[0] : "country";
 const types=metrics.filter(m=>m.applies_to===kind);
 const type=types.find(m=>m.id===typeId);
 return <Card><form action={action} className="space-y-5">
 <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">{d.factsWorkspace.addProposal}</h2>
 <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.intro}</p></div>
 <Field label={t.document}><select name="document" defaultValue={selected} required className={control}><option value="">{e.chooseDocument}</option>{documents.map(d=><option key={d.id} value={d.id}>{d.title ?? d.id}</option>)}</select></Field>
 {[
 ["topic",t.topic,100],
 ["subject",t.subject,200],
 ["predicate",t.predicate,200],
 ["value",t.value,2000],
 ].map(([name,label,max])=><Field key={String(name)} label={label}><textarea name={String(name)} required maxLength={Number(max)} rows={name==="value"?3:1} className={control}/></Field>)}
 <div className="grid gap-5 sm:grid-cols-2">
 <Field label={t.unit}><input name="unit" maxLength={100} className={control}/></Field>
 <Field label={t.country}><select name="country" className={control}><option value="">{t.noCountry}</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
 </div>
 <Field label={t.entity}><select name="entity" value={entity} onChange={ev=>{setEntity(ev.target.value);setTypeId("");}} className={control}><option value="">{e.notLinked}</option>{entities.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></Field>
 <Field label={t.deadlineType}><select name="deadlineType" className={control}><option value="">{t.notDeadline}</option>{deadlineOptions(locale).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
 <Field label={t.metric} hint={t.metricHint}><select name="factType" value={type?.id ?? ""} onChange={ev=>setTypeId(ev.target.value)} className={control}><option value="">{t.noType}</option>{types.map(m=><option key={m.id} value={m.id}>{m.label}{m.unit_hint?` (${m.unit_hint})`:""}</option>)}</select></Field>
 {type&&<StructuredFields type={type} locale={locale}/>}
 <Field label={t.period} hint={t.periodHint}><input name="referencePeriod" maxLength={7} pattern="[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?" placeholder="2024" className={control}/></Field>
 <div className="grid gap-5 sm:grid-cols-2"><Field label={t.from}><input type="date" name="from" className={control}/></Field><Field label={t.until}><input type="date" name="until" className={control}/></Field></div>
 <Field label={e.excerpt} hint={t.excerptHint}><textarea name="excerpt" required maxLength={500} rows={3} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending || !documents.length} className={buttonPrimary}>{pending?e.saving:e.saveProposal}</button>
 </form></Card>;
}
type StructuredDefaults={value_number?:number|string|null;value_currency?:string|null;value_period?:string|null;value_date?:string|null};
/**
 * The structured fields for a chosen type (L3a). L4 Q1: all optional — the
 * fact needs only its verbatim value; a number is entered only when the
 * excerpt writes it in digits. The database checks completeness and the excerpt.
 */
function StructuredFields({type,locale,defaults={}}:{type:FormFactType;locale:Locale;defaults?:StructuredDefaults}) {
 const t=dictionaries[locale].factsWorkspace.form;
 return <div className="space-y-4 rounded-xl bg-fill/50 p-4">
  <p className="text-[14px] leading-relaxed text-ink-2"><span className="font-medium text-ink">{t.typeDefinition}:</span> {type.definition}</p>
  {(type.value_kind==="money"||type.value_kind==="number")&&<div className="grid gap-5 sm:grid-cols-3">
   <Field label={t.valueNumber} hint={type.value_kind==="number"&&(type.min_value!==null||type.max_value!==null)?`${t.range(String(type.min_value ?? "…"),String(type.max_value ?? "…"))}. ${t.valueNumberHint}`:t.valueNumberHint}><input name="valueNumber" inputMode="decimal" pattern="[0-9]+([.,][0-9]+)?" defaultValue={defaults.value_number==null?"":String(defaults.value_number)} className={control}/></Field>
   {type.value_kind==="money"&&<>
    <Field label={t.valueCurrency} hint={t.valueCurrencyHint}><input name="valueCurrency" pattern="[A-Za-z]{3}" maxLength={3} defaultValue={defaults.value_currency ?? (/^[A-Z]{3}$/.test(type.unit_hint ?? "")?type.unit_hint ?? "":"")} className={`${control} uppercase`}/></Field>
    <Field label={t.valuePeriod}><select name="valuePeriod" defaultValue={defaults.value_period ?? ""} className={control}><option value="">{t.choosePeriod}</option>{valuePeriods.map(p=><option key={p} value={p}>{valuePeriodLabel(p, locale)}</option>)}</select></Field>
   </>}
  </div>}
  {type.value_kind==="date"&&<Field label={t.valueDate} hint={t.valueDateHint}><input type="date" name="valueDate" defaultValue={defaults.value_date ?? ""} className={control}/></Field>}
  {type.value_kind==="text"&&<p className="text-[13px] text-ink-3">{t.textType}</p>}
 </div>;
}
/**
 * L4 Q3: a reviewer sets, changes or removes the type of a proposed fact
 * before deciding. Only types that fit what the fact is linked to are listed
 * (lib/facts/domain.ts factTypeKindsFor); the database checks again.
 */
export function FactTypeForm({fact,types,currentLabel,adjustments=[],locale}:{fact:{id:string}&StructuredDefaults&{fact_type_id?:string|null};types:FormFactType[];currentLabel:string|null;adjustments?:string[];locale:Locale}) {
 const [state,action,pending]=useActionState(setFactType,{});
 const d=dictionaries[locale], t=d.factsWorkspace.form, e=d.editor;
 const [typeId,setTypeId]=useState(fact.fact_type_id ?? "");
 const type=types.find(m=>m.id===typeId);
 const same=typeId===(fact.fact_type_id ?? "");
 return <form action={action} className="space-y-4 rounded-2xl bg-fill/50 p-4 sm:p-5">
 <input type="hidden" name="fact" value={fact.id}/>
 <div><h3 className="text-[17px] font-semibold">{t.typeSection}</h3>
 <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t.typeIntro}</p>
 <p className="mt-1 text-[13px] text-ink-3">{currentLabel?t.typeNow(currentLabel):t.typeNone}</p></div>
 {adjustments.length>0&&<div className="rounded-xl bg-caution/[0.08] p-3 text-[14px] leading-relaxed text-ink-2"><p className="font-medium text-ink">{t.aiAdjusted}</p>
  <ul className="mt-1 list-disc pl-5">{adjustments.map(a=><li key={a}>{a}</li>)}</ul></div>}
 <Field label={t.metric}><select name="factType" value={typeId} onChange={ev=>setTypeId(ev.target.value)} className={control}><option value="">{t.noType}</option>{types.map(m=><option key={m.id} value={m.id}>{m.label}{m.unit_hint?` (${m.unit_hint})`:""}</option>)}</select></Field>
 {/* Remount on type change so a previous type's values never carry over. */}
 {type&&<StructuredFields key={type.id} type={type} locale={locale} defaults={same?fact:{}}/>}
 <Field label={t.typeNote}><input name="note" maxLength={1000} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending} className={buttonPrimary}>{pending?e.saving:t.saveType}</button>
 </form>;
}
export function ReviewForm({id,ai,locale}:{id:string;ai:boolean;locale:Locale}) {
 const t=dictionaries[locale].factsWorkspace.form;
 return <ReviewPanel action={reviewFact} hidden={{fact:id}} locale={locale} checks={[...t.checks, ...(ai?[t.aiCheck]:[])]}/>;
}
// Conflicts are marked only between claims that already passed evidence review
// (facts_conflict_requires_review, 2026-09-23). Both stay public and are shown
// as conflicting; nothing is averaged or chosen (AGENTS.md 1.4).
export function ConflictForm({id,others,locale}:{id:string;others:{id:string;label:string}[];locale:Locale}) {
 const [state,action,pending]=useActionState(reviewFact,{});
 const t=dictionaries[locale].factsWorkspace.form, e=dictionaries[locale].editor;
 return <form action={action} className="space-y-4 rounded-2xl bg-fill/50 p-4 sm:p-5">
 <input type="hidden" name="fact" value={id}/><input type="hidden" name="decision" value="conflicted"/>
 <p className="text-[15px] leading-relaxed text-ink-2">{t.conflictIntro}</p>
 <Field label={t.conflictWith}><select name="related" required className={control}><option value="">{t.chooseFact}</option>{others.filter(o=>o.id!==id).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>
 <Field label={t.compareNote} hint={t.conflictNoteHint}><textarea name="note" required maxLength={1000} rows={2} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending} className={buttonPrimary}>{pending?e.saving:t.markConflict}</button>
 </form>;
}
// Slice 9: a reviewer compares the claim with the NEW page version, then
// either confirms it still holds or withdraws it. Never decided automatically.
export function SourceChangeForm({id,locale}:{id:string;locale:Locale}) {
 const [state,action,pending]=useActionState(resolveSourceChange,{});
 const t=dictionaries[locale].factsWorkspace.form, e=dictionaries[locale].editor;
 return <form action={action} className="space-y-4 rounded-xl bg-fill/40 p-4">
 <input type="hidden" name="fact" value={id}/>
 <Field label={t.changeResult}><select name="decision" className={control}><option value="revalidated">{t.stillMatches}</option><option value="rejected">{t.noLongerTrue}</option></select></Field>
 <Field label={t.compareNote} hint={t.changeNoteHint}><textarea name="note" required maxLength={1000} rows={2} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending} className={buttonPrimary}>{pending?e.saving:t.record}</button>
 </form>;
}
