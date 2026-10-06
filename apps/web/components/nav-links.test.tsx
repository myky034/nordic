import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { path } = vi.hoisted(() => ({ path: { value: "/" } }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));
import { MobileMenu, MobileNavList, NavLinks } from "./nav-links";
import { navigationFor } from "@/lib/navigation/menu";
import { vi as viDict } from "@/lib/i18n/dictionaries/vi";
import { en as enDict } from "@/lib/i18n/dictionaries/en";
const entries = navigationFor(viDict.nav);
const labels = { main: viDict.nav.main, openMenu: viDict.nav.openMenu, closeMenu: viDict.nav.closeMenu };

it("renders five top-level entries with collapsed, labelled group menus", () => {
  path.value = "/programmes/p1";
  const html = renderToStaticMarkup(<NavLinks entries={entries} label={viDict.nav.main} />);
  for (const label of ["Quốc gia", "Du học", "Làm việc &amp; Visa", "So sánh", "Bằng chứng"]) expect(html).toContain(label);
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
  // Group panels are in the markup (for aria-controls) but hidden until opened.
  expect(html).toMatch(/<div id="[^"]+" hidden=""/);
  expect(html).toContain('aria-current="page" class="group block rounded-xl" href="/programmes"');
});
it("renders a closed Menu button on the server (the sheet itself is portalled on the client)", () => {
  path.value = "/sources";
  const html = renderToStaticMarkup(<MobileMenu entries={entries} labels={labels} />);
  expect(html).toContain('aria-label="Mở menu"');
  expect(html).toContain('aria-expanded="false"');
});
it("lists every destination in the mobile sheet, grouped, with the current page marked", () => {
  const html = renderToStaticMarkup(<MobileNavList path="/sources/s1" entries={entries} label={viDict.nav.main} />);
  for (const href of ["/countries", "/universities", "/programmes", "/immigration", "/occupations", "/compare", "/facts", "/sources", "/documents"]) expect(html).toContain(`href="${href}"`);
  for (const group of ["Du học", "Làm việc &amp; Visa", "Bằng chứng"]) expect(html).toContain(group);
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
});

it("renders the English labels it is given", () => {
  path.value = "/";
  const html = renderToStaticMarkup(<MobileMenu entries={navigationFor(enDict.nav)} labels={{ main: enDict.nav.main, openMenu: enDict.nav.openMenu, closeMenu: enDict.nav.closeMenu }} />);
  expect(html).toContain('aria-label="Open menu"');
  const bar = renderToStaticMarkup(<NavLinks entries={navigationFor(enDict.nav)} label={enDict.nav.main} />);
  for (const label of ["Countries", "Study", "Work &amp; Visas", "Compare", "Evidence"]) expect(bar).toContain(label);
});
