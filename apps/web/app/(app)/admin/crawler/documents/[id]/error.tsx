"use client";
import { ErrorState } from "@/components/ui/states";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { useHtmlLocale } from "@/lib/i18n/client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const d = dictionaries[useHtmlLocale()];
  return <ErrorState title={d.workspace.loadErrorTitle} text={d.workspace.loadErrorText} retryLabel={d.common.retry} reset={reset} />;
}
