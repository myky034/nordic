"use client";
import { ErrorState } from "@/components/ui/states";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { useHtmlLocale } from "@/lib/i18n/client";

export default function RegistryError({ reset }: { reset: () => void }) {
  const t = dictionaries[useHtmlLocale()].common;
  return <ErrorState title={t.loadErrorTitle} text={t.loadErrorText} retryLabel={t.retry} reset={reset} />;
}
