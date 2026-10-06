import Link from "next/link";
import { accessContext } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { listCountries, searchSources, sourceStatusCounts } from "@/lib/registry/queries";
import { crawlPolicyLabel, dateLabel, verificationLabel } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { uuidPattern } from "@/lib/documents/domain";
import { selectItem } from "@/lib/review/selection";
import { choiceParam, pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { Badge, EmptyState, ExternalLink, NoAccess, PageHeader, SearchInput, Section, Segmented } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { SplitList, SplitPager, SplitRow, SplitView } from "@/components/review/split-view";
import { SourceForm } from "./forms";

// "Needs verification" first: that is the work queue for an operator.
const tabs = ["needs_verification", "review_required", "verified", "all"] as const;
const host = (url: string) => { try { return new URL(url).host; } catch { return url; } };

// Split view (components/review/split-view.tsx), like the review queue: the
// list stays in view, one source is edited on the right. ?source=<id> selects
// a source, ?new=1 opens the "new source" form in the same pane.
export default async function AdminSourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  const { permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminSources;
  if (!permissions.includes("sources.manage")) {
    return <NoAccess title={t.noAccessTitle} locale={locale}>{t.noAccessHelp(permissionName("sources.manage", locale))}</NoAccess>;
  }
  const params = await searchParams;
  const status = choiceParam(params, "status", [...tabs], "needs_verification");
  const q = searchParam(params);
  const page = pageParam(params);
  const creating = params.new === "1";
  const [{ rows, total }, countries, counts] = await Promise.all([
    searchSources({ q, status: status === "all" ? "" : status }, page),
    listCountries(),
    sourceStatusCounts(),
  ]);
  const countOf = (s: string) => s === "all" ? counts.reduce((n, c) => n + c._count._all, 0) : counts.find((c) => c.status === s)?._count._all ?? 0;
  const requested = typeof params.source === "string" && uuidPattern.test(params.source) ? params.source : undefined;
  // After saving, a source may move to another tab (e.g. to "Đã xác minh"); the
  // first remaining one then opens, like the review queue.
  const selection = selectItem(rows.map((r) => r.id), requested);
  const current = creating ? null : selection.index >= 0 ? rows[selection.index] : null;
  const base = withParams("/admin/sources", params, { source: null, new: null });

  return <>
    <PageHeader eyebrow={dict.adminOverview.eyebrow} title={t.title} description={t.description}
      actions={<><Link href="/sources" className={`${textLink} text-[15px]`}>{dict.editor.viewPublic}</Link>
        <Link href={withParams("/admin/sources", params, { new: "1", source: null })} scroll={false} className={buttonPrimary}>{t.newSource}</Link></>} />
    <Section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label={dict.editor.status} items={tabs.map((value) => ({ href: withParams("/admin/sources", { q }, { status: value === "needs_verification" ? null : value }), label: t.tabs[value], count: countOf(value), active: status === value }))} />
        <form action="/admin/sources" className="mb-5 w-full sm:w-72">{status !== "needs_verification" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder={t.search} /></form>
      </div>
      {rows.length || creating ? <SplitView detailKey={creating ? "new" : current?.id} paneScroll={false} detailOnMobile={creating || !!requested} backHref={base}
        list={rows.length ? <SplitList label={t.list} footer={<SplitPager locale={locale} summary={pageSummary(total, page)} href={(p) => withParams("/admin/sources", params, { page: p, source: null, new: null })} />}>
          {rows.map((s) => <SplitRow key={s.id} href={withParams("/admin/sources", params, { source: s.id, new: null })} selected={s.id === current?.id} explicit={!!requested}
            title={s.name} subtitle={`${host(s.canonicalUrl)} · ${s.country?.name ?? t.noCountry}`}
            badges={<><TierBadge tier={s.sourceTier} locale={locale} /><SourceStatusBadge status={s.status}>{verificationLabel(s.status, s.lastVerifiedAt, locale)}</SourceStatusBadge>{s.crawlEnabled && <Badge tone="accent">{t.crawling}</Badge>}</>} />)}
        </SplitList> : <p className="p-5 text-[15px] text-ink-2">{t.empty}</p>}
        detail={creating
          ? <><h2 className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">{t.newSource}</h2><SourceForm countries={countries} locale={locale} /></>
          : current && <>
            <div className="mb-4 px-1">
              <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{current.name}</h2>
              <p className="mt-1 text-[15px]"><ExternalLink href={current.canonicalUrl} quiet>{current.canonicalUrl}</ExternalLink></p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <TierBadge tier={current.sourceTier} locale={locale} />
                <SourceStatusBadge status={current.status}>{verificationLabel(current.status, current.lastVerifiedAt, locale)}</SourceStatusBadge>
                <Badge>{t.crawlBadge(crawlPolicyLabel(current.crawlPolicy, locale), current.crawlEnabled)}</Badge>
                <span className="text-[13px] text-ink-3">{t.lastVerified} {dateLabel(current.lastVerifiedAt, locale)}</span>
              </div>
            </div>
            <SourceForm source={current} countries={countries} locale={locale} />
          </>} />
        : <EmptyState>{t.empty}{q ? t.searched(q) : ""}</EmptyState>}
    </Section>
  </>;
}
