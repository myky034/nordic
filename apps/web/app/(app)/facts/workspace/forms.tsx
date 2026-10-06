"use client";
import { useActionState } from "react";
import { proposeFact, resolveSourceChange, reviewFact } from "./actions";
import { deadlineOptions } from "@/lib/education/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
export function ProposalForm({documents,countries,selected,entities=[],metrics=[],locale}:{documents:{id:string;title:string|null}[];countries:{id:string;name:string}[];selected:string;entities?:{value:string;label:string}[];metrics?:{id:string;label:string;unit_hint:string|null}[];locale:Locale}) {
 const [state,action,pending]=useActionState(proposeFact,{});
 const d=dictionaries[locale], t=d.factsWorkspace.form, e=d.editor;
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
 <Field label={t.entity}><select name="entity" className={control}><option value="">{e.notLinked}</option>{entities.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}</select></Field>
 <Field label={t.deadlineType}><select name="deadlineType" className={control}><option value="">{t.notDeadline}</option>{deadlineOptions(locale).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
 <Field label={t.metric} hint={t.metricHint}><select name="metric" className={control}><option value="">{e.notLinked}</option>{metrics.map(m=><option key={m.id} value={m.id}>{m.label}{m.unit_hint?` (${m.unit_hint})`:""}</option>)}</select></Field>
 <Field label={t.period} hint={t.periodHint}><input name="referencePeriod" maxLength={7} pattern="[0-9]{4}(-(Q[1-4]|H[12]|0[1-9]|1[0-2]))?" placeholder="2024" className={control}/></Field>
 <div className="grid gap-5 sm:grid-cols-2"><Field label={t.from}><input type="date" name="from" className={control}/></Field><Field label={t.until}><input type="date" name="until" className={control}/></Field></div>
 <Field label={e.excerpt} hint={t.excerptHint}><textarea name="excerpt" required maxLength={500} rows={3} className={control}/></Field>
 <FormMessage error={state.error} message={state.message}/>
 <button disabled={pending || !documents.length} className={buttonPrimary}>{pending?e.saving:e.saveProposal}</button>
 </form></Card>;
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
