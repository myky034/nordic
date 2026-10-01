import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const { path } = vi.hoisted(() => ({ path: { value: "/" } }));
vi.mock("next/navigation", () => ({ usePathname: () => path.value }));
import { MobileMenu, MobileNavList, NavLinks } from "./nav-links";

it("renders five top-level entries with collapsed, labelled group menus", () => {
  path.value = "/programmes/p1";
  const html = renderToStaticMarkup(<NavLinks />);
  for (const label of ["Quốc gia", "Du học", "Làm việc &amp; Visa", "So sánh", "Bằng chứng"]) expect(html).toContain(label);
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
  // Group panels are in the markup (for aria-controls) but hidden until opened.
  expect(html).toMatch(/<div id="[^"]+" hidden=""/);
  expect(html).toContain('aria-current="page" class="group block rounded-xl" href="/programmes"');
});
it("renders a closed Menu button on the server (the sheet itself is portalled on the client)", () => {
  path.value = "/sources";
  const html = renderToStaticMarkup(<MobileMenu />);
  expect(html).toContain('aria-label="Mở menu"');
  expect(html).toContain('aria-expanded="false"');
});
it("lists every destination in the mobile sheet, grouped, with the current page marked", () => {
  const html = renderToStaticMarkup(<MobileNavList path="/sources/s1" />);
  for (const href of ["/countries", "/universities", "/programmes", "/immigration", "/occupations", "/compare", "/facts", "/sources", "/documents"]) expect(html).toContain(`href="${href}"`);
  for (const group of ["Du học", "Làm việc &amp; Visa", "Bằng chứng"]) expect(html).toContain(group);
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
});
