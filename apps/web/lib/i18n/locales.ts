// Supported interface languages (owner decision 2026-10-06, PROJECT_SPEC.md
// Decision Log): Vietnamese by default, English on request. The choice is
// kept in a cookie, so URLs are the same in both languages.
export const locales = ["vi", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "vi";
export const LOCALE_COOKIE = "nordic_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
/** Anything unknown — missing cookie, old or tampered value — falls back to Vietnamese. */
export function readLocale(value: unknown): Locale {
  return isLocale(value) ? value : defaultLocale;
}
/** BCP 47 tags for Intl number/date formatting. */
export const intlLocale: Record<Locale, string> = { vi: "vi-VN", en: "en-GB" };
