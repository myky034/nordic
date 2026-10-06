"use client";
import { useActionState } from "react";
import { cancelExtraction, requestExtraction } from "./extraction-actions";
import { FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSmall } from "@/components/ui/styles";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";

export function RequestExtractionForm({ document, locale }: { document: string; locale: Locale }) {
  const t = dictionaries[locale].documentEditor;
  const [s, action, pending] = useActionState(requestExtraction, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="document" value={document} />
    <button disabled={pending} className={buttonPrimary}>{pending ? t.sending : t.requestAi}</button>
    <FormMessage error={s.error} message={s.message} />
  </form>;
}
export function CancelExtractionForm({ document, request, locale }: { document: string; request: string; locale: Locale }) {
  const t = dictionaries[locale].documentEditor;
  const [s, action, pending] = useActionState(cancelExtraction, {});
  return <form action={action} className="space-y-2">
    <input type="hidden" name="document" value={document} /><input type="hidden" name="request" value={request} />
    <button disabled={pending} className={buttonSmall}>{pending ? t.cancelling : t.cancel}</button>
    <FormMessage error={s.error} message={s.message} />
  </form>;
}
