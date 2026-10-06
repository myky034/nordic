"use client";
import { useActionState } from "react";
import { proposeProgramme, proposeUniversity, reviewEducation } from "./actions";
import { degreeOptions } from "@/lib/education/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Card, Field, FormMessage } from "@/components/ui";
import { ReviewPanel } from "@/components/review/review-panel";
import { buttonPrimary, control } from "@/components/ui/styles";
type Option = { id: string; label: string };
function EvidenceFields({ documents, locale }: { documents: Option[]; locale: Locale }) {
  const e = dictionaries[locale].editor, t = dictionaries[locale].educationWorkspace.form;
  return <>
    <Field label={e.evidenceDocument}><select name="document" required className={control}><option value="">{e.chooseDocument}</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}</select></Field>
    <Field label={t.excerpt} hint={t.excerptHint}>
      <textarea name="excerpt" required maxLength={500} rows={3} className={control} />
    </Field>
  </>;
}

export function UniversityForm({ countries, documents, locale }: { countries: Option[]; documents: Option[]; locale: Locale }) {
  const [state, action, pending] = useActionState(proposeUniversity, {});
  const d = dictionaries[locale], e = d.editor;
  return <Card><form action={action} className="space-y-5">
    <h2 className="text-[22px] font-semibold tracking-[-0.015em]">{d.educationWorkspace.proposeUniversity}</h2>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={d.common.country}><select name="country" required className={control}><option value="">{e.chooseCountry}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
      <Field label={e.nameFromSource}><input name="name" required maxLength={300} className={control} /></Field>
    </div>
    <Field label={e.officialWebsite}><input name="officialUrl" type="url" required maxLength={2048} placeholder="https://" className={control} /></Field>
    <EvidenceFields documents={documents} locale={locale} />
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length} className={buttonPrimary}>{pending ? e.saving : e.saveProposal}</button>
  </form></Card>;
}

export function ProgrammeForm({ universities, documents, locale }: { universities: Option[]; documents: Option[]; locale: Locale }) {
  const [state, action, pending] = useActionState(proposeProgramme, {});
  const d = dictionaries[locale], e = d.editor, t = d.educationWorkspace.form;
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">{d.educationWorkspace.proposeProgramme}</h2>
    <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.programmeIntro}</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.university}><select name="university" required className={control}><option value="">{t.chooseUniversity}</option>{universities.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
      <Field label={t.degree}><select name="degree" required defaultValue="unknown" className={control}>{degreeOptions(locale).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
    </div>
    <Field label={t.programmeName}><input name="name" required maxLength={300} className={control} /></Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.field}><input name="field" maxLength={200} className={control} /></Field>
      <Field label={t.language}><input name="language" maxLength={100} className={control} /></Field>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.programmePage}><input name="officialUrl" type="url" required maxLength={2048} placeholder="https://" className={control} /></Field>
      <Field label={t.applicationPage}><input name="applicationUrl" type="url" maxLength={2048} placeholder="https://" className={control} /></Field>
    </div>
    <EvidenceFields documents={documents} locale={locale} />
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending || !documents.length || !universities.length} className={buttonPrimary}>{pending ? e.saving : e.saveProposal}</button>
  </form></Card>;
}

export function EducationReviewForm({ kind, id, locale }: { kind: "university" | "programme"; id: string; locale: Locale }) {
  // Education review proves only that the entity EXISTS (Slice 5, Option A);
  // tuition and deadlines are separate facts with their own review.
  const t = dictionaries[locale].educationWorkspace.form;
  return <ReviewPanel action={reviewEducation} hidden={{ kind, id }} locale={locale} checks={kind === "university" ? t.universityChecks : t.programmeChecks} />;
}
