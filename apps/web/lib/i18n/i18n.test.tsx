import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const { jar } = vi.hoisted(() => ({ jar: { set: vi.fn(), value: undefined as string | undefined } }));
vi.mock("server-only", () => ({}));
// This file tests the real cookie-based module, not the shared test mock.
vi.unmock("@/lib/i18n/server");
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (jar.value === undefined ? undefined : { value: jar.value }), set: jar.set }) }));
import { readLocale, LOCALE_COOKIE } from "./locales";
import { setLocale } from "./actions";
import { dictionaries } from "./dictionaries";
import { LanguageSwitch } from "@/components/language-switch";

const form = (locale: string) => { const f = new FormData(); f.set("locale", locale); return f; };

it("falls back to Vietnamese for a missing or unknown cookie value", () => {
  expect(readLocale("en")).toBe("en");
  expect(readLocale(undefined)).toBe("vi");
  expect(readLocale("fr")).toBe("vi");
  expect(readLocale("EN")).toBe("vi");
});

describe("setLocale", () => {
  it("stores a supported language in a long-lived, httpOnly cookie for the whole site", async () => {
    jar.set.mockReset();
    await setLocale(form("en"));
    expect(jar.set).toHaveBeenCalledWith(LOCALE_COOKIE, "en", expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax", maxAge: 31536000 }));
  });
  it("ignores anything else", async () => {
    jar.set.mockReset();
    await setLocale(form("javascript:alert(1)"));
    expect(jar.set).not.toHaveBeenCalled();
  });
});

it("has the same keys in every dictionary (TypeScript enforces this; arrays are checked here)", () => {
  const shape = (v: unknown): unknown => Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
  expect(shape(dictionaries.en)).toEqual(shape(dictionaries.vi));
});

it("renders the switch with the current language pressed", async () => {
  jar.value = "en";
  const html = renderToStaticMarkup(await LanguageSwitch());
  expect(html).toContain('aria-label="Language"');
  expect(html).toMatch(/value="en"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*value="en"/);
  expect(html).toMatch(/value="vi"[^>]*aria-pressed="false"|aria-pressed="false"[^>]*value="vi"/);
  jar.value = undefined;
  expect(renderToStaticMarkup(await LanguageSwitch())).toContain('aria-label="Ngôn ngữ"');
});
