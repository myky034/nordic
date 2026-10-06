"use client";
import { useActionState } from "react";
import { saveMetric } from "./actions";
import { metricCategories, metricCategoryLabel } from "@/lib/compare/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type Metric = { id: string; key: string; label: string; description: string; unit_hint: string | null; category: string; active: boolean };
// Key and category are locked after creation (the database refuses changes),
// so they are read-only here to avoid a confusing round-trip error.
export function MetricForm({ metric, locale = defaultLocale }: { metric?: Metric; locale?: Locale }) {
  const t = dictionaries[locale].adminMetrics;
  const [state, action, pending] = useActionState(saveMetric, {});
  return <form action={action} className="space-y-5">
    <input type="hidden" name="id" value={metric?.id ?? ""} />
    {metric && <><input type="hidden" name="key" value={metric.key} /><input type="hidden" name="category" value={metric.category} /></>}
    <div className="grid gap-5">
      <Field label={t.key} hint={t.keyHint}>
        <input name={metric ? undefined : "key"} defaultValue={metric?.key} disabled={!!metric} required pattern="[a-z][a-z0-9_]{1,59}" maxLength={60} className={control} />
      </Field>
      <Field label={t.categoryLocked}>
        <select name={metric ? undefined : "category"} defaultValue={metric?.category ?? ""} disabled={!!metric} required className={control}>
          <option value="">{t.chooseCategory}</option>{Object.keys(metricCategories).map((v) => <option key={v} value={v}>{metricCategoryLabel(v, locale)}</option>)}
        </select>
      </Field>
      <Field label={t.label}><input name="label" defaultValue={metric?.label} required maxLength={200} className={control} /></Field>
      <Field label={t.unit} hint={t.unitHelp}><input name="unit" defaultValue={metric?.unit_hint ?? ""} maxLength={50} placeholder={t.unitPlaceholder} className={control} /></Field>
    </div>
    <Field label={t.definition} hint={t.definitionHint}>
      <textarea name="description" defaultValue={metric?.description} required maxLength={1000} rows={3} className={control} />
    </Field>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="active" defaultChecked={metric?.active ?? true} className="h-4 w-4 accent-accent" /> {t.activeBox}</label>
    <FormMessage error={state.error} message={state.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? dictionaries[locale].adminSources.saving : metric ? dictionaries[locale].adminSources.save : t.create}</button>
  </form>;
}
