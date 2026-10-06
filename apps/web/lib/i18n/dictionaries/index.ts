import type { Locale } from "../locales";
import { en } from "./en";
import { vi, type Dictionary } from "./vi";

// Both dictionaries are small and statically imported; switching languages
// needs no extra network request.
export const dictionaries: Record<Locale, Dictionary> = { vi, en };
export type { Dictionary };
