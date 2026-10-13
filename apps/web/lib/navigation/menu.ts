// Global navigation structure. Kept out of the component so it is testable
// and so adding a module means editing one list (AGENTS.md §16).
//
// Apple-style information architecture: a handful of top-level entries, with
// related destinations grouped under one label instead of nine equal tabs
// that no longer fit the bar.
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type NavLink = { href: string; label: string; description: string };
export type NavEntry = { id: string; label: string; href?: string; links?: NavLink[] };

/**
 * The navigation in the viewer's language; labels come from the dictionary (lib/i18n).
 *
 * Organised by what a visitor wants to do (UX review 2026-10-13, C1/B3/B7):
 * study, visas & residence, work, compare — not by how data is stored.
 * Facts, sources and documents are the evidence behind every page; they move
 * to the footer ("About the data", aboutDataLinks) instead of the main bar.
 * `showCompare`: false hides "So sánh" until it has enough data (lib/coverage, B1).
 */
export function navigationFor(nav: Dictionary["nav"], { showCompare = true }: { showCompare?: boolean } = {}): NavEntry[] {
  const entries: NavEntry[] = [
    { id: "countries", label: nav.countries, href: "/countries" },
    { id: "study", label: nav.study, links: [
      { href: "/programmes", ...nav.programmes },
      { href: "/universities", ...nav.universities },
    ] },
    { id: "permits", label: nav.permits, href: "/immigration" },
    { id: "jobs", label: nav.jobs, href: "/occupations" },
    { id: "compare", label: nav.compare, href: "/compare" },
  ];
  return showCompare ? entries : entries.filter((e) => e.id !== "compare");
}

/** Footer links to the evidence pages ("About the data"). */
export function aboutDataLinks(nav: Dictionary["nav"]): NavLink[] {
  return [
    { href: "/facts", ...nav.facts },
    { href: "/sources", ...nav.sources },
    { href: "/documents", ...nav.documents },
  ];
}

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}
/** An entry is active when its own page or any page in its group is open. */
export function entryActive(path: string, entry: NavEntry) {
  return entry.href ? isActive(path, entry.href) : (entry.links ?? []).some((l) => isActive(path, l.href));
}
