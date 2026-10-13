import Link from "next/link";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { textLink } from "@/components/ui/styles";

/**
 * The "way out" of an empty state (UX review 2026-10-13, L6): a visitor never
 * ends at "nothing yet". Offers, in this order and only when they apply:
 * the item's own official page, clearing the filters, the official sources of
 * the country in view (or all sources), and the countries that have data.
 * Used as EmptyState's `action`.
 */
export function WayOut({ country, clearHref, official, locale = defaultLocale }: {
  /** Country slug in view, if any. */ country?: string | null;
  /** Where the page is without filters; shown only when filters are active. */ clearHref?: string | null;
  /** The item's own official page (programme, university, rule…). */ official?: string | null;
  locale?: Locale;
}) {
  const d = dictionaries[locale], t = d.wayOut;
  const links: { href: string; label: string; external?: boolean }[] = [];
  if (official) links.push({ href: official, label: t.officialPage, external: true });
  if (clearHref) links.push({ href: clearHref, label: t.clearFilters });
  links.push(country
    ? { href: `/sources?country=${country}`, label: t.countrySources(d.countryNames[country] ?? country) }
    : { href: "/sources", label: t.officialSources });
  if (!official) links.push({ href: "/countries", label: t.countriesWithData });
  return <span className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[15px]">
    {links.map((l) => l.external
      ? <a key={l.href} href={l.href} className={textLink} rel="noopener noreferrer" target="_blank">{l.label} ↗</a>
      : <Link key={l.href} href={l.href} className={textLink}>{l.label}</Link>)}
  </span>;
}
