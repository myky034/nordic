"use client";
import { useActionState } from "react";
import { saveCrawlTarget } from "./actions";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

type Target = { id: string; source_id: string; url: string; kind: string; path_prefix: string | null; max_urls: number; content_selector: string | null; active: boolean };
export function TargetForm({ sources, target, locale = defaultLocale }: { sources: { id: string; label: string }[]; target?: Target; locale?: Locale }) {
  const t = dictionaries[locale].adminCrawler;
  const [s, action, pending] = useActionState(saveCrawlTarget, {});
  return <form action={action} className="space-y-5">
    {target && <><input type="hidden" name="id" value={target.id} /><input type="hidden" name="source" value={target.source_id} /></>}
    {!target && <Field label={t.source}><select name="source" required className={control}><option value="">{t.chooseSource}</option>{sources.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>}
    <Field label={t.url} hint={t.urlHint}><input name="url" type="url" required maxLength={2048} defaultValue={target?.url} className={control} /></Field>
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label={t.kind} hint={t.kindHint}><select name="kind" defaultValue={target?.kind ?? "page"} className={control}><option value="page">{t.onePage}</option><option value="sitemap">{t.sitemap}</option></select></Field>
      <Field label={t.prefix} hint={t.prefixHint}><input name="prefix" maxLength={200} defaultValue={target?.path_prefix ?? ""} className={control} /></Field>
      <Field label={t.maxUrls} hint={t.maxUrlsHint}><input name="maxUrls" type="number" min={1} max={100} defaultValue={target?.max_urls ?? 20} className={control} /></Field>
    </div>
    <Field label={t.selector} hint={t.selectorHint}>
      <input name="selector" maxLength={200} defaultValue={target?.content_selector ?? ""} className={control} />
    </Field>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="active" defaultChecked={target?.active ?? true} className="h-4 w-4 accent-accent" /> {t.active}</label>
    <FormMessage error={s.error} message={s.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? t.saving : target ? t.save : t.register}</button>
  </form>;
}
