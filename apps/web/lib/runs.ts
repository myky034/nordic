// How a crawler or extraction run was started (CHECK trigger IN
// ('schedule','manual','local') in both migrations), in plain words.
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
const triggers: Record<Locale, Record<string, string>> = {
  vi: { schedule: "Theo lịch", manual: "Chạy tay", local: "Chạy trên máy" },
  en: { schedule: "Scheduled", manual: "Manual", local: "Run locally" },
};
export function triggerLabel(trigger: string, locale: Locale = defaultLocale) {
  const t = triggers[locale];
  return Object.hasOwn(t, trigger) ? t[trigger] : trigger;
}
