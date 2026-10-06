import Link from "next/link";
import { CRAWLER_STALE_DAYS, ROW_LIMIT, dayLabel, daysSince, decisionNamesFor, decisions, type activity, type coverage, type crawlerState, type extractionState, type perDay } from "@/lib/admin/overview";
import { crawlOutcome, crawlRunStatus } from "@/lib/crawler/domain";
import { runStatus as extractionRunStatus } from "@/lib/extraction/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, intlLocale, type Locale } from "@/lib/i18n/locales";
import { countryName } from "@/lib/registry/domain";
import { Badge, Card, Notice } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { textLink } from "@/components/ui/styles";
import { BarChart, ColumnChart, type Series } from "@/components/ui/charts";

// Presentation of the /admin overview: pure components that take numbers
// already computed by lib/admin/overview.ts. No data access here, so the
// DEV preview (/dev/preview?section=admin-overview) and tests can render them
// with DEMO rows; loading and permission checks live in ./sections.tsx.
const when = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);
// Every view takes the interface language (default Vietnamese, as in the DEV
// preview); numbers are formatted for it, labels come from the dictionary.
const fmt = (locale: Locale) => (v: number) => v.toLocaleString(intlLocale[locale]);
const ago = (days: number | null, locale: Locale) => {
  const t = dictionaries[locale].adminOverview;
  return days === null ? "" : days === 0 ? t.today : t.daysAgo(days);
};
export function Incomplete({ locale = defaultLocale }: { locale?: Locale }) {
  const t = dictionaries[locale].adminOverview;
  return <Notice tone="caution" title={t.incompleteTitle}>{t.incomplete(fmt(locale)(ROW_LIMIT))}</Notice>;
}
export function SectionPlaceholder() {
  return <div aria-hidden="true" className="h-40 animate-pulse rounded-2xl bg-fill/60" />;
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "caution" | "critical" }) {
  return <div>
    <dt className="text-[13px] text-ink-3">{label}</dt>
    <dd className={`mt-0.5 text-[22px] font-semibold tabular-nums tracking-[-0.01em] ${tone === "critical" ? "text-critical" : tone === "caution" ? "text-caution" : "text-ink"}`}>{value}</dd>
    {hint && <dd className="mt-0.5 text-[12px] leading-snug text-ink-3">{hint}</dd>}
  </div>;
}

export function CrawlerView({ state, activeTargets, complete: full, locale = defaultLocale }: { state: ReturnType<typeof crawlerState>; activeTargets: number; complete: boolean; locale?: Locale }) {
  const t = dictionaries[locale].adminOverview, n = fmt(locale);
  const outcomeSeries: Series[] = [{ key: "ok", label: t.ok, swatch: "bg-accent" }, { key: "problem", label: t.problem, swatch: "bg-caution" }];
  const st = state.lastRun ? crawlRunStatus(state.lastRun.status, locale) : null;
  return <Card className="h-full">
    <div className="flex items-center justify-between gap-3"><h3 className="text-[17px] font-semibold text-ink">{t.crawler}</h3>
      <Link href="/admin/crawler" className={`${textLink} text-[14px]`}>{t.openCrawler}</Link></div>
    {!full && <div className="mt-3"><Incomplete locale={locale} /></div>}
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
      <Stat label={t.lastRun} value={state.lastRun ? <Badge tone={st!.tone}>{st!.label}</Badge> : t.neverRun}
        hint={state.lastRun ? `${when(state.lastRun.started_at)} UTC · ${ago(state.age, locale)}` : undefined} />
      <Stat label={t.activeTargets} value={n(activeTargets)} />
      <Stat label={t.trackedUrls} value={n(state.trackedUrls)} />
      <Stat label={t.problemUrls} value={n(state.problemUrls)} tone={state.problemUrls ? "caution" : undefined}
        hint={Object.entries(state.problems).map(([k, c]) => `${crawlOutcome(k, locale).label}: ${c}`).join(" · ") || t.allUrlsOk} />
    </dl>
    {Object.keys(state.outcomes).length > 0 && <div className="mt-5 border-t border-hairline pt-4">
      <h4 className="mb-3 text-[13px] font-semibold text-ink-2">{t.urlsByOutcome}</h4>
      <BarChart locale={locale} title={t.urlsByOutcome} summary={t.urlsSummary(n(state.trackedUrls), n(state.problemUrls))}
        series={outcomeSeries} points={Object.entries(state.outcomes).sort((a, b) => b[1] - a[1])
          .map(([k, c]) => ({ label: crawlOutcome(k, locale).label, values: { [state.problems[k] ? "problem" : "ok"]: c } }))} />
    </div>}
    {state.stale && <div className="mt-4"><Notice tone="caution">{state.lastRun
      ? t.crawlerStale(CRAWLER_STALE_DAYS)
      : t.crawlerNeverRan}</Notice></div>}
  </Card>;
}

export function ExtractionView({ state, daily, pending, accountSet, complete: full, now, locale = defaultLocale }: { state: ReturnType<typeof extractionState>; daily: ReturnType<typeof perDay>; pending: number; accountSet: boolean; complete: boolean; now: Date; locale?: Locale }) {
  const t = dictionaries[locale].adminOverview, n = fmt(locale);
  const tokenSeries: Series[] = [{ key: "input", label: t.tokenIn, swatch: "bg-accent" }, { key: "output", label: t.tokenOut, swatch: "bg-accent/40" }];
  const st = state.lastRun ? extractionRunStatus(state.lastRun.status, locale) : null;
  return <Card className="h-full">
    <div className="flex items-center justify-between gap-3"><h3 className="text-[17px] font-semibold text-ink">{t.extraction} <span className="text-[13px] font-normal text-ink-3">· {t.last30}</span></h3>
      <Link href="/admin/extraction" className={`${textLink} text-[14px]`}>{t.openExtraction}</Link></div>
    {!full && <div className="mt-3"><Incomplete locale={locale} /></div>}
    {!accountSet && <div className="mt-3"><Notice tone="caution" title={t.noAccountTitle}>{t.noAccountText}</Notice></div>}
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
      <Stat label={t.lastRun} value={state.lastRun ? <Badge tone={st!.tone}>{st!.label}</Badge> : t.none}
        hint={state.lastRun ? `${when(state.lastRun.started_at)} UTC · ${ago(daysSince(state.lastRun.started_at, now), locale)}` : t.noRuns30} />
      <Stat label={t.pendingRequests} value={n(pending)} />
      <Stat label={t.runs} value={n(state.runs)} tone={state.failedRuns ? "caution" : undefined}
        hint={state.failedRuns ? t.failedRuns(state.failedRuns) : t.noFailures} />
      <Stat label={t.tokensInOut} value={`${n(state.inputTokens)} / ${n(state.outputTokens)}`} hint={t.tokensHint} />
    </dl>
    <div className="mt-5 border-t border-hairline pt-4">
      <h4 className="mb-3 text-[13px] font-semibold text-ink-2">{t.tokensPerDay}</h4>
      <ColumnChart locale={locale} title={t.tokensChart} summary={t.tokensSummary(n(state.inputTokens), n(state.outputTokens))} height={110} labelEvery={7}
        series={tokenSeries} points={daily.map((d) => ({ label: dayLabel(d.day), values: d.values }))} />
    </div>
  </Card>;
}

export function CoverageView({ rows, total, complete: full, locale = defaultLocale }: ReturnType<typeof coverage> & { complete: boolean; locale?: Locale }) {
  const t = dictionaries[locale].adminOverview, n = fmt(locale), col = t.columns;
  const factSeries: Series[] = [{ key: "reviewed", label: t.reviewed, swatch: "bg-positive" }, { key: "proposed", label: t.proposed, swatch: "bg-caution" },
    { key: "conflicted", label: t.conflicted, swatch: "bg-critical" }];
  const right = (label: string) => ({ label, className: "text-right" });
  const columns = [{ label: col.country }, right(col.sourcesVerified), right(col.factsReviewed), right(col.proposed), right(col.conflicted),
    right(col.universities), right(col.programmes), right(col.rules), right(col.occupations)];
  const cells = (r: typeof total) => <>
    <Cell className="text-right tabular-nums">{n(r.sourcesVerified)} / {n(r.sourcesTotal)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.factsReviewed)}</Cell>
    <Cell className="text-right tabular-nums">{r.factsProposed ? <Badge tone="caution">{n(r.factsProposed)}</Badge> : "0"}</Cell>
    <Cell className="text-right tabular-nums">{r.factsConflicted ? <Badge tone="critical">{n(r.factsConflicted)}</Badge> : "0"}</Cell>
    <Cell className="text-right tabular-nums">{n(r.universities)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.programmes)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.rules)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.occupations)}</Cell>
  </>;
  const factPoints = rows.map((r) => ({ label: r.country ? countryName(r.country.slug, r.country.name, locale) : t.noCountry,
    values: { reviewed: r.factsReviewed, proposed: r.factsProposed, conflicted: r.factsConflicted } }));
  return <>
    {!full && <div className="mb-3"><Incomplete locale={locale} /></div>}
    <Card className="mb-4">
      <h3 className="mb-4 text-[15px] font-semibold text-ink">{t.factsByCountry}</h3>
      <BarChart locale={locale} title={t.factsByCountry} summary={t.factsSummary(n(total.factsReviewed), n(total.factsProposed), n(total.factsConflicted))}
        series={factSeries} points={factPoints} />
    </Card>
    <DataTable locale={locale} label={t.coverageTable} minWidth="60rem" columns={columns}>
      {rows.map((r) => r.country
        ? <DataRow key={r.key} href={`/countries/${r.country.slug}`} title={<span className="whitespace-nowrap">{countryName(r.country.slug, r.country.name, locale)}</span>}>{cells(r)}</DataRow>
        : <tr key={r.key}><td className="whitespace-nowrap px-4 py-3 text-ink-2">{t.noCountry}</td>{cells(r)}<td /></tr>)}
      <tr className="bg-fill/40 font-semibold [&_td]:text-ink"><td className="px-4 py-3">{t.total}</td>{cells(total)}<td /></tr>
    </DataTable>
  </>;
}

export function ActivityView({ rows, daily, days, pending, complete: full, locale = defaultLocale }: { rows: ReturnType<typeof activity>; daily: ReturnType<typeof perDay>; days: 7 | 30; pending: { table: string; label: string; href: string; count: number; oldestDays: number | null }[]; complete: boolean; locale?: Locale }) {
  const t = dictionaries[locale].adminOverview, n = fmt(locale), decisionLabels = decisionNamesFor(locale);
  const decisionSeries: Series[] = [{ key: "reviewed", label: decisionLabels.reviewed, swatch: "bg-positive" }, { key: "rejected", label: decisionLabels.rejected, swatch: "bg-critical" },
    { key: "conflicted", label: decisionLabels.conflicted, swatch: "bg-caution" }, { key: "revalidated", label: decisionLabels.revalidated, swatch: "bg-accent" }];
  const total = rows.reduce((a, r) => a + r.total, 0);
  return <div className="grid gap-4">
    <Card>
      <h3 className="mb-4 text-[15px] font-semibold text-ink">{t.decisionsPerDay}</h3>
      <ColumnChart locale={locale} title={t.decisionsChart(days)} summary={t.decisionsSummary(n(total))} labelEvery={days === 30 ? 5 : 1}
        series={decisionSeries} points={daily.map((d) => ({ label: dayLabel(d.day), values: d.values }))} />
    </Card>
    <div>
      {!full && <div className="mb-3"><Incomplete locale={locale} /></div>}
      <DataTable locale={locale} label={t.decisionsTable} minWidth="36rem" columns={[{ label: t.area }, ...decisions.map((d) => ({ label: decisionLabels[d], className: "text-right" })), { label: t.total, className: "text-right" }]}>
        {rows.map((r) => <DataRow key={r.kind} href={r.href} title={<span className="whitespace-nowrap">{r.label}</span>}>
          {decisions.map((d) => <Cell key={d} className="text-right tabular-nums">{r.kind !== "facts" && (d === "conflicted" || d === "revalidated") ? <span className="text-ink-3">—</span> : n(r.counts[d])}</Cell>)}
          <Cell className="text-right font-semibold tabular-nums text-ink">{n(r.total)}</Cell>
        </DataRow>)}
      </DataTable>
      <p className="mt-2 px-1 text-[12px] text-ink-3">{t.dashNote}</p>
    </div>
    <DataTable locale={locale} label={t.pendingTable} minWidth="20rem" columns={[{ label: t.waiting }, { label: t.items, className: "text-right" }, { label: t.oldest, className: "text-right" }]}>
      {pending.map((p) => <DataRow key={p.table} href={p.href} title={<span className="whitespace-nowrap">{p.label}</span>}>
        <Cell className="text-right tabular-nums">{p.count ? <Badge tone="caution">{n(p.count)}</Badge> : "0"}</Cell>
        <Cell className="whitespace-nowrap text-right tabular-nums">{p.oldestDays === null ? "—" : t.days(p.oldestDays)}</Cell>
      </DataRow>)}
    </DataTable>
  </div>;
}
