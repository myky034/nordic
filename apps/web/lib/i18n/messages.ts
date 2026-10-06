import { defaultLocale, type Locale } from "./locales";

/** Code → message tables for each interface language; `fallback` is required. */
export type MessageTable = Record<Locale, Record<string, string> & { fallback: string }>;

/**
 * Explicit allowlist lookup for error codes from server actions and RPCs.
 * Own keys only, so a code such as "constructor" never reaches
 * Object.prototype; unknown codes get the table's fallback, never the raw
 * code (it may contain database details).
 */
export function lookupMessage(table: MessageTable, code: string, locale: Locale = defaultLocale) {
  const t = table[locale];
  return code !== "fallback" && Object.hasOwn(t, code) ? t[code] : t.fallback;
}
