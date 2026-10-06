"use client";
import { useActionState } from "react";
import { proposeOccupation, reviewOccupation } from "./actions";
import { classificationOptions } from "@/lib/labour/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
type Option = { id: string; label: string };
export function OccupationForm({ countries, documents, locale }: { countries: Option[]; documents: Option[]; locale: Locale }) {
  const [state, action, pending] = useActionState(proposeOccupation, {});
  const d = dictionaries[locale], e = d.editor, t = d.labourWorkspace.form;
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">{d.labourWorkspace.propose}</h2>
    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.intro}</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.name}><input name="name" required maxLength={200} className={control} /></Field>
      <Field label={t.scope} hint={t.scopeHint}><select name="country" className={control}><option value="">{t.international}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label={t.system}><select name="system" className={control}><option value="">{t.none}</option>{classificationOptions(locale).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label={t.code}><input name="code" maxLength={50} className={control} /></Field>
    </div>
    <Field label={e.evidenceDocument}><select name="document" required className={control}><option value="">{e.chooseDocument}</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    <Field label={t.excerpt}><textarea name="excerpt" required maxLength={500} rows={3} className={control} /></Field>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length} className={buttonPrimary}>{pending ? e.saving : e.saveProposal}</button>
  </form></Card>;
}
export function OccupationReviewForm({ id, locale }: { id: string; locale: Locale }) {
  return <ReviewPanel action={reviewOccupation} hidden={{ id }} locale={locale} checks={dictionaries[locale].labourWorkspace.form.checks} />;
}
