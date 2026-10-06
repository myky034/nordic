import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, readLocale, type Locale } from "./locales";
import { dictionaries, type Dictionary } from "./dictionaries";

/**
 * The viewer's interface language, read once per request (React cache) from
 * the cookie set by the header switch. Reading cookies makes the page render
 * per request, which every data page already does.
 */
export const getLocale = cache(async (): Promise<Locale> => readLocale((await cookies()).get(LOCALE_COOKIE)?.value));

/** The dictionary for the viewer's language: `const t = await getDictionary()`. */
export const getDictionary = cache(async (): Promise<Dictionary> => dictionaries[await getLocale()]);
