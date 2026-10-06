import { connection } from "next/server";
import Link from "next/link";
import { listCountries } from "@/lib/registry/queries";
import { countryName, countryStatusLabel } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { sortRows } from "@/lib/table";
import { Badge, Chevron, EmptyState, PageHeader } from "@/components/ui";
import { intlLocale } from "@/lib/i18n/locales";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { textLink } from "@/components/ui/styles";

// Card grid (pattern 5 in /dev/preview/patterns): a visitor scans and picks
// a country. Only registry data is shown: name, source count (and, for
// editors, the research status).
export default async function CountriesPage() {
  // Database reads belong to request time, not production build time.
  await connection();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.countries;
  // Ordered by the name the visitor reads (Vietnamese or English), not the stored one.
  const countries = sortRows(await listCountries(), (c) => countryName(c.slug, c.name, locale), "asc");
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  return <>
    <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
    {!countries.length ? <EmptyState>{t.empty}</EmptyState>
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => <Link key={c.id} href={`/countries/${c.slug}`}
          className="group flex flex-col rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {/* The stored English name as a caption — redundant when the interface is English. */}
          {locale === "vi" && <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{c.name}</p>}
          <h2 className="mt-1 text-[22px] font-semibold leading-snug text-ink">{countryName(c.slug, c.name, locale)}</h2>
          {internal && <div className="mt-3"><Badge tone={c.status === "active" ? "accent" : "neutral"}>{countryStatusLabel(c.status, locale)}</Badge></div>}
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[14px]">
            <span className="text-ink-2">{t.sources(c._count.sources.toLocaleString(intlLocale[locale]))}</span>
            <span className="inline-flex items-center gap-1 font-medium text-accent">{t.profile}<Chevron className="text-accent transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>)}
      </div>}
    <p className="mt-6 px-1 text-[15px]"><Link href="/sources" className={textLink}>{t.allSources}</Link></p>
  </>;
}
