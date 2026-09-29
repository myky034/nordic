// Global navigation structure. Kept out of the component so it is testable
// and so adding a module means editing one list (AGENTS.md §16).
//
// Apple-style information architecture: a handful of top-level entries, with
// related destinations grouped under one label instead of nine equal tabs
// that no longer fit the bar.
export type NavLink = { href: string; label: string; description: string };
export type NavEntry = { id: string; label: string; href?: string; links?: NavLink[] };

export const navigation: NavEntry[] = [
  { id: "countries", label: "Countries", href: "/countries" },
  { id: "study", label: "Study", links: [
    { href: "/universities", label: "Universities", description: "Institutions with reviewed evidence" },
    { href: "/programmes", label: "Programmes", description: "Degrees, language, tuition and deadlines" },
  ] },
  { id: "work", label: "Work & Immigration", links: [
    { href: "/immigration", label: "Immigration", description: "Study, work and residence permits" },
    { href: "/occupations", label: "Occupations", description: "Jobs and labour-market figures" },
  ] },
  { id: "compare", label: "Compare", href: "/compare" },
  { id: "evidence", label: "Evidence", links: [
    { href: "/facts", label: "Facts", description: "Every published claim with its excerpt" },
    { href: "/sources", label: "Sources", description: "Registry, tiers and verification" },
    { href: "/documents", label: "Documents", description: "Recorded source pages and versions" },
  ] },
];

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}
/** An entry is active when its own page or any page in its group is open. */
export function entryActive(path: string, entry: NavEntry) {
  return entry.href ? isActive(path, entry.href) : (entry.links ?? []).some((l) => isActive(path, l.href));
}
