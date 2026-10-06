import { setLocale } from "@/lib/i18n/actions";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { locales } from "@/lib/i18n/locales";

/**
 * VI | EN in the header. A plain form posting to a Server Action, so it works
 * without client JavaScript; the action stores the choice in a cookie and the
 * current page re-renders in the chosen language (lib/i18n/actions.ts).
 */
export async function LanguageSwitch() {
  const [locale, t] = [await getLocale(), (await getDictionary()).language];
  return <form action={setLocale} role="group" aria-label={t.label} className="flex items-center rounded-full bg-fill p-0.5">
    {locales.map((l) => <button key={l} type="submit" name="locale" value={l} lang={l} aria-pressed={l === locale} title={t[l]}
      className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] transition ${l === locale ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-ink-3 hover:text-ink"}`}>
      {l}<span className="sr-only"> — {t[l]}</span>
    </button>)}
  </form>;
}
