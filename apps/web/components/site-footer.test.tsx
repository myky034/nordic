import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("./account-actions", () => ({ AccountActions: () => null }));
vi.mock("./language-switch", () => ({ LanguageSwitch: () => null }));
import { setTestLocale } from "@/test/i18n";
import { SiteFooter } from "./site-header";
afterEach(() => setTestLocale("vi"));

// UX review 2026-10-13 (C1/B3): the evidence pages leave the main menu but
// stay one tap away from every page, in the footer.
it("links facts, sources and documents under 'About the data' in both languages", async () => {
  const vi = renderToStaticMarkup(await SiteFooter());
  expect(vi).toContain('aria-label="Về dữ liệu"');
  for (const href of ["/facts", "/sources", "/documents"]) expect(vi).toContain(`href="${href}"`);
  setTestLocale("en");
  const en = renderToStaticMarkup(await SiteFooter());
  expect(en).toContain("About the data");
});
