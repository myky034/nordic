"use client";
import { useActionState } from "react";
import { proposeRule, reviewRule } from "./actions";
import { ruleTypeOptions } from "@/lib/immigration/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
type Option = { id: string; label: string };
export function RuleForm({ countries, documents, locale }: { countries: Option[]; documents: Option[]; locale: Locale }) {
  const [state, action, pending] = useActionState(proposeRule, {});
  const d = dictionaries[locale], e = d.editor, t = d.immigrationWorkspace.form;
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">{d.immigrationWorkspace.propose}</h2>
    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.intro}</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={d.common.country}><select name="country" required className={control}><option value="">{e.chooseCountry}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label={t.ruleType}><select name="ruleType" required defaultValue="other" className={control}>{ruleTypeOptions(locale).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
    </div>
    <Field label={t.name}><input name="title" required maxLength={300} className={control} /></Field>
    <Field label={t.officialPage} hint={t.officialPageHint}><input name="officialUrl" type="url" required maxLength={2048} placeholder="https://" className={control} /></Field>
    <Field label={t.document}><select name="document" required className={control}><option value="">{e.chooseDocument}</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    <Field label={t.excerpt}><textarea name="excerpt" required maxLength={500} rows={3} className={control} /></Field>
    {!documents.length && <p className="text-[15px] text-caution">{t.noT1Documents}</p>}
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length} className={buttonPrimary}>{pending ? e.saving : e.saveProposal}</button>
  </form></Card>;
}
export function RuleReviewForm({ id, locale }: { id: string; locale: Locale }) {
  return <ReviewPanel action={reviewRule} hidden={{ id }} locale={locale} checks={dictionaries[locale].immigrationWorkspace.form.checks} />;
}
