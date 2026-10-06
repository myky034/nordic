"use client";
import { useSyncExternalStore } from "react";
import { readLocale, type Locale } from "./locales";

// Client Components cannot read the locale cookie (it is httpOnly on purpose).
// They read the language the root layout already set on <html lang>; during
// server rendering this falls back to Vietnamese. Used by error boundaries,
// which must be Client Components.
const subscribe = () => () => {};
export function useHtmlLocale(): Locale {
  return readLocale(useSyncExternalStore(subscribe, () => document.documentElement.lang, () => "vi"));
}
