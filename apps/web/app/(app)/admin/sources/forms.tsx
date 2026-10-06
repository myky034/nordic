"use client";
import { useActionState } from "react";
import { saveSource } from "./actions";
import { tierOptions, tierGuidanceFor, unclassifiedLabel, sourceStatuses, sourceStatusLabel, crawlPolicies, crawlPolicyLabel, type Tier } from "@/lib/registry/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type SourceRow = {
  id: string; name: string; canonicalUrl: string; countryId: string | null; sourceTier: string | null;
  sourceType: string | null; topics: string[]; language: string | null; authorityNotes: string | null;
  status: string; crawlPolicy: string; crawlEnabled: boolean; crawlFrequency: string | null; notes: string | null;
};

/** One titled group of fields, like a section in Apple's Settings. */
function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-surface p-5 ring-1 ring-hairline sm:p-6">
    <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1 text-[13px] leading-snug text-ink-2">{description}</p>}
    <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div>
  </section>;
}

// Used for a new source and for editing, in the right pane of /admin/sources.
// Fields are grouped by the question they answer (what is it / who publishes
// it and is that checked / may we crawl it), and the save bar is sticky at the
// bottom of the pane so it never needs a scroll to reach.
export function SourceForm({ source, countries, locale = defaultLocale }: { source?: SourceRow; countries: { id: string; name: string }[]; locale?: Locale }) {
  const t = dictionaries[locale].adminSources;
  const tierGuidance = tierGuidanceFor(locale);
  const [state, action, pending] = useActionState(saveSource, {});
  return <form action={action}>
    <input type="hidden" name="id" value={source?.id ?? ""} />
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
      <Group title={t.groupSource}>
        <Field label={t.name}><input className={control} name="name" required maxLength={200} defaultValue={source?.name} /></Field>
        <Field label={t.url} hint={t.urlHint}><input className={control} name="canonicalUrl" type="url" required maxLength={2048} defaultValue={source?.canonicalUrl} placeholder="https://" /></Field>
        <Field label={t.country}><select className={control} name="countryId" defaultValue={source?.countryId ?? ""}><option value="">{t.unassigned}</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label={t.type}><input className={control} name="sourceType" maxLength={100} defaultValue={source?.sourceType ?? ""} placeholder="government, university, community…" /></Field>
        <Field label={t.language}><input className={control} name="language" maxLength={20} defaultValue={source?.language ?? ""} placeholder="en, sv, da…" /></Field>
        <Field label={t.topics} hint={t.topicsHint}><input className={control} name="topics" defaultValue={source?.topics.join(", ") ?? ""} placeholder="immigration, education, labour_market" /></Field>
      </Group>

      <Group title={t.groupVerify} description={t.groupVerifyHelp}>
        <Field label="Tier" hint={<span className="block space-y-0.5">{(Object.keys(tierGuidance) as Tier[]).map((tier) => <span key={tier} className="block"><b className="font-medium text-ink-2">{tier}:</b> {tierGuidance[tier]}</span>)}</span>}>
          <select className={control} name="sourceTier" defaultValue={source?.sourceTier ?? ""}><option value="">{unclassifiedLabel(locale)}</option>{tierOptions(locale).map(([tier, l]) => <option key={tier} value={tier}>{tier} · {l}</option>)}</select>
        </Field>
        <Field label={t.status} hint={t.statusHint}>
          <select className={control} name="status" defaultValue={source?.status ?? "needs_verification"}>{sourceStatuses.map((s) => <option key={s} value={s}>{sourceStatusLabel(s, locale)}</option>)}</select>
        </Field>
        <Field className="sm:col-span-2" label={t.authority} hint={t.authorityHint}>
          <textarea className={control} name="authorityNotes" maxLength={2000} rows={3} defaultValue={source?.authorityNotes ?? ""}
            placeholder={t.authorityPlaceholder} />
        </Field>
        {/* Only this box (or first switching to verified) stamps a new "last verified" date. */}
        {source?.status === "verified" && <label className="flex items-start gap-3 text-[15px] sm:col-span-2"><input type="checkbox" name="reverify" className="mt-1 h-4 w-4 accent-accent" /><span>{t.reverify} <span className="block text-[13px] text-ink-3">{t.reverifyHint}</span></span></label>}
      </Group>

      <Group title={t.groupCrawl} description={t.groupCrawlHelp}>
        <Field label={t.crawlPolicy}><select className={control} name="crawlPolicy" defaultValue={source?.crawlPolicy ?? "not_reviewed"}>{crawlPolicies.map((p) => <option key={p} value={p}>{crawlPolicyLabel(p, locale)}</option>)}</select></Field>
        <Field label={t.frequency}><input className={control} name="crawlFrequency" maxLength={50} defaultValue={source?.crawlFrequency ?? ""} placeholder="weekly, monthly…" /></Field>
        <label className="flex items-center gap-3 text-[15px] sm:col-span-2"><input type="checkbox" name="crawlEnabled" defaultChecked={source?.crawlEnabled} className="h-4 w-4 accent-accent" /> {t.enableCrawl}</label>
      </Group>

      <Group title={t.groupNotes}>
        <Field className="sm:col-span-2" label={t.notes} hint={t.notesHint}><textarea className={control} name="notes" maxLength={2000} rows={2} defaultValue={source?.notes ?? ""} /></Field>
      </Group>
    </fieldset>
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap items-center gap-3 border-t border-hairline bg-canvas px-1 py-3">
      <button disabled={pending} className={buttonPrimary}>{pending ? t.saving : source ? t.save : t.create}</button>
      <div className="min-w-0 flex-1"><FormMessage error={state.error} message={state.message} /></div>
    </div>
  </form>;
}
