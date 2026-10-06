"use client";
import { useActionState } from "react";
import { setExtractionAccount } from "./actions";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

export function AccountForm({ current, locale = defaultLocale }: { current: string | null; locale?: Locale }) {
  const t = dictionaries[locale].adminExtraction;
  const [s, action, pending] = useActionState(setExtractionAccount, {});
  return <form action={action} className="space-y-4">
    <p className="text-[15px] leading-relaxed text-ink-2">{t.accountHelp}</p>
    <Field label={t.accountId} hint={t.accountIdHint}>
      <input name="user" required defaultValue={current ?? ""} maxLength={36} className={`${control} font-mono`} />
    </Field>
    <FormMessage error={s.error} message={s.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? dictionaries[locale].adminSources.saving : t.save}</button>
  </form>;
}
