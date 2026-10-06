import Link from "next/link";
import Form from "next/form";
import { getSource, searchSources } from "@/lib/registry/queries";
import { canonicalSourceUrl, countryName, countrySlugs, registryFilters, sourceStatusLabel, sourceStatuses, tierOptions, unclassifiedLabel, verificationLabel } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { savedState } from "@/lib/workspace/saved";
import { EmptyState, Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { SaveButton } from "@/components/save-button";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";
import { hostLabel } from "../source-list";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { SourceDetails } from "./source-details";

// Sources as a table; a row opens the source in the slide-over Inspector
// (?source=<id>) so the list, its filters and its page stay where they were.
// /sources/[id] remains the shareable page of a source.
export default async function SourcesPage({ searchParams }: PageProps<"/sources">) {
  const query = await searchParams;
  const filters = registryFilters(query);
  const q = searchParam(query);
  const page = pageParam(query);
  const openId = typeof query.source === "string" ? query.source : null;
  // getSource() rejects anything that is not a UUID, so a junk ?source= opens nothing.
  const [{ rows, total }, open] = await Promise.all([searchSources(query, page), openId ? getSource(openId) : Promise.resolve(null)]);
  const save = open ? await savedState("source", open.id) : null;
  const here = (change: Record<string, string | number | null>) => withParams("/sources", query, change);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.sources, dict.common];
  return <>
    <PageHeader eyebrow={c.evidence} title={t.title} description={t.description} />
    <Form action="/sources" className={filterBar}>
      <div className="sm:col-span-2 lg:col-span-4"><SearchInput defaultValue={q} placeholder={t.searchPlaceholder} /></div>
      <Field label={c.country}><select name="country" defaultValue={filters.country} className={control}><option value="">{c.allCountries}</option><option value="unassigned">{t.unassignedCountry}</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{dict.countryNames[slug]}</option>)}</select></Field>
      <Field label={t.tier}><select name="tier" defaultValue={filters.tier} className={control}><option value="">{t.allTiers}</option><option value="unknown">{unclassifiedLabel(locale)}</option>{tierOptions(locale).map(([tier, label]) => <option key={tier} value={tier}>{tier} · {label}</option>)}</select></Field>
      <Field label={t.status}><select name="status" defaultValue={filters.status} className={control}><option value="">{t.allStatuses}</option>{sourceStatuses.map((status) => <option key={status} value={status}>{sourceStatusLabel(status, locale)}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>{c.filter}</button><Link href="/sources" className={`${textLink} text-[15px]`}>{c.clearFilter}</Link></div>
    </Form>
    <DataTable label={t.title} locale={locale} minWidth="52rem" columns={[{ label: t.columns.name }, { label: t.columns.tier }, { label: t.columns.status }, { label: t.columns.country }, { label: t.columns.domain }]}
      empty={!rows.length && <EmptyState>{t.empty}</EmptyState>}>
      {rows.map((s) => <DataRow key={s.id} href={here({ source: s.id })} selected={s.id === open?.id} title={<span className="block min-w-[14rem]">{s.name}</span>}>
        <Cell className="whitespace-nowrap"><TierBadge tier={s.sourceTier} locale={locale} /></Cell>
        {/* Short label here; the Inspector shows the full verification wording. */}
        <Cell className="whitespace-nowrap"><SourceStatusBadge status={s.status}>{sourceStatusLabel(s.status, locale)}</SourceStatusBadge></Cell>
        <Cell className="whitespace-nowrap">{s.country ? countryName(s.country.slug, s.country.name, locale) : <span className="text-ink-3">{t.unassigned}</span>}</Cell>
        <Cell className="whitespace-nowrap">{hostLabel(canonicalSourceUrl(s.canonicalUrl)) ?? <span className="text-ink-3">{t.urlNeedsVerification}</span>}</Cell>
      </DataRow>)}
    </DataTable>
    <Pagination summary={pageSummary(total, page)} href={(p) => here({ page: p, source: null })} locale={locale} />
    {open && <Inspector title={open.name} subtitle={hostLabel(canonicalSourceUrl(open.canonicalUrl)) ?? undefined} closeHref={here({ source: null })} locale={locale}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TierBadge tier={open.sourceTier} locale={locale} />
        <SourceStatusBadge status={open.status}>{verificationLabel(open.status, open.lastVerifiedAt, locale)}</SourceStatusBadge>
        <span className="ml-auto flex items-center gap-3">
          {save && <SaveButton kind="source" id={open.id} signedIn={save.signedIn} initialSaved={save.saved} locale={locale} />}
        </span>
      </div>
      <SourceDetails source={open} compact internal={internal} locale={locale} />
      <p className="mt-6 px-1 text-[14px]"><Link href={`/sources/${open.id}`} className={textLink}>{t.ownPage}</Link> <span className="text-ink-3">{t.forSharing}</span></p>
    </Inspector>}
  </>;
}
