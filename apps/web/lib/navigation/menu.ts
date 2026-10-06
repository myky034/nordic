// Global navigation structure. Kept out of the component so it is testable
// and so adding a module means editing one list (AGENTS.md §16).
//
// Apple-style information architecture: a handful of top-level entries, with
// related destinations grouped under one label instead of nine equal tabs
// that no longer fit the bar.
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type NavLink = { href: string; label: string; description: string };
export type NavEntry = { id: string; label: string; href?: string; links?: NavLink[] };

/** The navigation in the viewer's language; labels come from the dictionary (lib/i18n). */
export function navigationFor(nav: Dictionary["nav"]): NavEntry[] {
  return [
    { id: "countries", label: nav.countries, href: "/countries" },
    { id: "study", label: nav.study, links: [
      { href: "/universities", ...nav.universities },
      { href: "/programmes", ...nav.programmes },
    ] },
    { id: "work", label: nav.work, links: [
      { href: "/immigration", ...nav.immigration },
      { href: "/occupations", ...nav.occupations },
    ] },
    { id: "compare", label: nav.compare, href: "/compare" },
    { id: "evidence", label: nav.evidence, links: [
      { href: "/facts", ...nav.facts },
      { href: "/sources", ...nav.sources },
      { href: "/documents", ...nav.documents },
    ] },
  ];
}

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}
/** An entry is active when its own page or any page in its group is open. */
export function entryActive(path: string, entry: NavEntry) {
  return entry.href ? isActive(path, entry.href) : (entry.links ?? []).some((l) => isActive(path, l.href));
}
