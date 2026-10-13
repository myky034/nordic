"use client";
import { useActionState, useState } from "react";
import { proposeClassification, proposeProgramme, proposeUniversity, reviewClassification, reviewEducation } from "./actions";
import { sameSite } from "@/lib/taxonomy/domain";
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

export type ClassifiableProgramme = { id: string; label: string; url: string };
export type FieldOption = { id: string; code: string; level: number; label: string };
export type PathOption = { id: string; label: string; version: number; include: string; exclude: string | null };
export type DocumentOption = { id: string; label: string; url: string };

/**
 * Slice 11b: propose one classification. The document list follows the chosen
 * programme (same site, as the database requires), and a career path shows
 * its current criteria next to the excerpt, so the proposer quotes the
 * sentence that meets them.
 */
export function ClassificationForm({ programmes, fields, paths, documents, locale }: {
  programmes: ClassifiableProgramme[]; fields: FieldOption[]; paths: PathOption[]; documents: DocumentOption[]; locale: Locale;
}) {
  const [state, action, pending] = useActionState(proposeClassification, {});
  const [programme, setProgramme] = useState("");
  const [dimension, setDimension] = useState<"field" | "path">("field");
  const [pathId, setPathId] = useState("");
  const d = dictionaries[locale], e = d.editor, t = d.classification;
  const chosen = programmes.find((p) => p.id === programme);
  const docs = chosen ? documents.filter((doc) => sameSite(doc.url, chosen.url)) : [];
  const path = paths.find((p) => p.id === pathId);
  // ISCED-F broad fields as option groups; narrow and detailed levels indented.
  const broad = fields.filter((f) => f.level === 1);
  return <Card><form action={action} className="space-y-5">
    <div><h2 className="text-[22px] font-semibold tracking-[-0.015em]">{t.propose}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t.intro}</p></div>
    {!programmes.length ? <p className="text-[15px] text-ink-2">{t.noProgrammes}</p> : <>
      <Field label={t.programme}>
        <select name="programme" required value={programme} onChange={(ev) => setProgramme(ev.target.value)} className={control}>
          <option value="">{t.chooseProgramme}</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Field>
      <fieldset>
        <legend className="text-[13px] font-medium text-ink-2">{t.dimension}</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {(["field", "path"] as const).map((v) => <label key={v} className="flex items-center gap-2 text-[15px]">
            <input type="radio" name="dimension" value={v} checked={dimension === v} onChange={() => setDimension(v)} className="h-4 w-4 accent-accent" />{t.dimensions[v]}
          </label>)}
        </div>
      </fieldset>
      {dimension === "field"
        ? <Field label={t.field}><select name="field" required className={control}><option value="">{t.chooseField}</option>
          {broad.map((b) => <optgroup key={b.id} label={b.label}>{fields.filter((f) => f.code.startsWith(b.code)).map((f) =>
            <option key={f.id} value={f.id}>{"\u00a0\u00a0".repeat(f.level - 1)}{f.label}</option>)}</optgroup>)}
        </select></Field>
        : <>
          <Field label={t.path}><select name="path" required value={pathId} onChange={(ev) => setPathId(ev.target.value)} className={control}>
            <option value="">{t.choosePath}</option>{paths.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select></Field>
          {path && <div className="rounded-xl bg-fill/50 p-4 text-[14px] leading-relaxed">
            <p className="font-semibold text-ink">{t.criteria(path.version)}</p>
            <p className="mt-2 text-[13px] font-medium text-ink-3">{t.include}</p><p className="whitespace-pre-wrap text-ink-2">{path.include}</p>
            {path.exclude && <><p className="mt-2 text-[13px] font-medium text-ink-3">{t.exclude}</p><p className="whitespace-pre-wrap text-ink-2">{path.exclude}</p></>}
          </div>}
        </>}
      <Field label={e.evidenceDocument} hint={t.documentHint}>
        <select name="document" required className={control} disabled={!chosen}><option value="">{e.chooseDocument}</option>{docs.map((doc) => <option key={doc.id} value={doc.id}>{doc.label}</option>)}</select>
      </Field>
      {chosen && !docs.length && <p className="text-[13px] text-caution">{t.noDocument}</p>}
      <Field label={e.excerpt} hint={t.excerptHint}><textarea name="excerpt" required maxLength={500} rows={3} className={control} /></Field>
      <FormMessage error={state.error} message={state.message} />
      <button disabled={pending || !docs.length} className={buttonPrimary}>{pending ? e.saving : e.saveProposal}</button>
    </>}
  </form></Card>;
}

/** Review a proposal, or (mode "revalidate") re-check a reviewed one whose career path criteria changed. */
export function ClassificationReviewForm({ id, revalidate = false, locale }: { id: string; revalidate?: boolean; locale: Locale }) {
  const t = dictionaries[locale].classification;
  return <ReviewPanel action={reviewClassification} hidden={revalidate ? { id, mode: "revalidate" } : { id }} locale={locale}
    checks={revalidate ? t.revalidateChecks : t.checks} approveLabel={revalidate ? t.revalidate : undefined} rejectLabel={revalidate ? t.withdraw : undefined} />;
}

