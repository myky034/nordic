"use client";
import { useActionState, useState } from "react";
import { saveMetric } from "./actions";
import { appliesToLabel, appliesToValues, metricCategories, metricCategoryLabel, valueKindLabel, valueKinds } from "@/lib/compare/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";

export type FactTypeRow = {
  id: string; key: string; label_vi: string; label_en: string; definition_vi: string; definition_en: string;
  value_kind: string; applies_to: string; unit_hint: string | null; min_value: number | string | null; max_value: number | string | null;
  category: string; comparable: boolean; active: boolean;
};

// Key, value kind, entity and group are locked after creation (the database
// refuses changes), so they are read-only here to avoid a confusing round
// trip; their values travel as hidden fields.
export function MetricForm({ metric, locale = defaultLocale }: { metric?: FactTypeRow; locale?: Locale }) {
  const t = dictionaries[locale].adminMetrics, common = dictionaries[locale].adminSources;
  const [state, action, pending] = useActionState(saveMetric, {});
  const [kind, setKind] = useState(metric?.value_kind ?? "");
  const locked = (name: string, value: string | undefined) => (metric ? <input type="hidden" name={name} value={value} /> : null);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="id" value={metric?.id ?? ""} />
    {locked("key", metric?.key)}{locked("category", metric?.category)}{locked("kind", metric?.value_kind)}{locked("applies", metric?.applies_to)}
    <Field label={t.key} hint={t.keyHint}>
      <input name={metric ? undefined : "key"} defaultValue={metric?.key} disabled={!!metric} required pattern="[a-z][a-z0-9_]{1,59}" maxLength={60} className={`${control} font-mono`} />
    </Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.labelVi}><input name="labelVi" defaultValue={metric?.label_vi} required maxLength={200} className={control} /></Field>
      <Field label={t.labelEn}><input name="labelEn" defaultValue={metric?.label_en} required maxLength={200} className={control} /></Field>
    </div>
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label={t.kindLocked} hint={t.kindHint}>
        <select name={metric ? undefined : "kind"} value={kind} onChange={(e) => setKind(e.target.value)} disabled={!!metric} required className={control}>
          <option value="">{t.chooseKind}</option>{valueKinds.map((v) => <option key={v} value={v}>{valueKindLabel(v, locale)}</option>)}
        </select>
      </Field>
      <Field label={t.appliesLocked}>
        <select name={metric ? undefined : "applies"} defaultValue={metric?.applies_to ?? ""} disabled={!!metric} required className={control}>
          <option value="">{t.chooseApplies}</option>{appliesToValues.map((v) => <option key={v} value={v}>{appliesToLabel(v, locale)}</option>)}
        </select>
      </Field>
      <Field label={t.categoryLocked}>
        <select name={metric ? undefined : "category"} defaultValue={metric?.category ?? ""} disabled={!!metric} required className={control}>
          <option value="">{t.chooseCategory}</option>{Object.keys(metricCategories).map((v) => <option key={v} value={v}>{metricCategoryLabel(v, locale)}</option>)}
        </select>
      </Field>
    </div>
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label={t.unit} hint={t.unitHelp}><input name="unit" defaultValue={metric?.unit_hint ?? ""} maxLength={50} placeholder={t.unitPlaceholder} className={control} /></Field>
      {kind === "number" && <>
        <Field label={`${t.range} · ${t.min}`}><input name="min" inputMode="decimal" defaultValue={metric?.min_value ?? ""} className={control} /></Field>
        <Field label={t.max}><input name="max" inputMode="decimal" defaultValue={metric?.max_value ?? ""} className={control} /></Field>
      </>}
    </div>
    <Field label={t.definitionVi} hint={t.definitionHint}><textarea name="definitionVi" defaultValue={metric?.definition_vi} required maxLength={1000} rows={3} className={control} /></Field>
    <Field label={t.definitionEn}><textarea name="definitionEn" defaultValue={metric?.definition_en} required maxLength={1000} rows={3} className={control} /></Field>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="comparable" defaultChecked={metric?.comparable ?? false} className="h-4 w-4 accent-accent" /> {t.comparableBox}</label>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="active" defaultChecked={metric?.active ?? true} className="h-4 w-4 accent-accent" /> {t.activeBox}</label>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? common.saving : metric ? common.save : t.create}</button>
  </form>;
}
