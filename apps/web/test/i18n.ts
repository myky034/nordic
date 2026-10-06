import type { Locale } from "@/lib/i18n/locales";

let current: Locale = "vi";
/** Interface language seen by pages under test; reset it in afterEach if changed. */
export const setTestLocale = (locale: Locale) => { current = locale; };
export const testLocale = () => current;
