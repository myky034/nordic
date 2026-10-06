"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "./locales";

/**
 * Header language switch. A Server Action may set cookies; Next.js then
 * re-renders the current page in the same round trip, so the visitor stays
 * on the page they were reading. Unknown values are ignored.
 */
export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // remembered for a year
  });
}
