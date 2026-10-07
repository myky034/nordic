"use client";
import { useActionState } from "react";
import { saveCareerPath } from "./actions";
import type { CareerPathRow } from "@/lib/taxonomy/domain";
import { Field, FormMessage, Notice } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

// Create or edit a career path in the right-hand Inspector of /admin/taxonomy.
// Both languages are required (owner decision 2026-10-06); keywords stay
// English-only. The key is read-only once created (the database refuses changes).
export function CareerPathForm({ path, locale = defaultLocale }: { path?: CareerPathRow; locale?: Locale }) {
  const [state, action, pending] = useActionState(saveCareerPath, {});
  const t = dictionaries[locale].adminTaxonomy, common = dictionaries[locale].adminSources;
  return <form action={action} className="space-y-5">
    <Notice tone="neutral">{t.nordicNote}</Notice>
    <input type="hidden" name="id" value={path?.id ?? ""} />
    {path && <input type="hidden" name="key" value={path.key} />}
    <Field label={t.keyLabel} hint={t.keyHint}>
      <input name={path ? undefined : "key"} defaultValue={path?.key} disabled={!!path} required pattern="[a-z][a-z0-9_]{1,59}" maxLength={60} className={`${control} font-mono`} />
    </Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.nameVi}><input name="nameVi" defaultValue={path?.name_vi} required maxLength={200} className={control} /></Field>
      <Field label={t.nameEn}><input name="nameEn" defaultValue={path?.name_en} required maxLength={200} className={control} /></Field>
    </div>
    <Field label={t.definitionVi} hint={t.definitionHint}><textarea name="definitionVi" defaultValue={path?.definition_vi} required maxLength={2000} rows={3} className={control} /></Field>
    <Field label={t.definitionEn}><textarea name="definitionEn" defaultValue={path?.definition_en} required maxLength={2000} rows={3} className={control} /></Field>
    <Field label={t.include} hint={t.includeHint}><textarea name="include" defaultValue={path?.include_rule} required maxLength={4000} rows={4} className={control} /></Field>
    <Field label={t.exclude} hint={t.excludeHint}><textarea name="exclude" defaultValue={path?.exclude_rule ?? ""} maxLength={4000} rows={3} className={control} /></Field>
    <Field label={t.keywords} hint={t.keywordsHint}><textarea name="keywords" defaultValue={path?.keywords.join("\n")} rows={4} className={control} /></Field>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="active" defaultChecked={path?.active ?? true} className="h-4 w-4 accent-accent" /> {t.activeBox}</label>
    {path && <p className="text-[13px] text-ink-3">{t.versionNote}</p>}
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? common.saving : path ? common.save : t.create}</button>
  </form>;
}
