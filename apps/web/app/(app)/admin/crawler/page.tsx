import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { crawlOutcome, crawlReadiness, crawlRunStatus } from "@/lib/crawler/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { triggerLabel } from "@/lib/runs";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { Badge, EmptyState, List, ListRow, NoAccess, Notice, PageHeader, Segmented } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { TargetForm } from "./forms";

type Source = { id: string; name: string; canonical_url: string; crawl_enabled: boolean; crawl_policy: string; status: string };
type Target = { id: string; source_id: string; url: string; kind: string; path_prefix: string | null; max_urls: number; content_selector: string | null; active: boolean };
type State = { source_id: string; url: string; last_status: number | null; last_outcome: string | null; last_fetched_at: string | null; last_document_id: string | null };
type Run = { id: string; trigger: string; status: string; started_at: string; finished_at: string | null; note: string | null; counts: Record<string, number> | null;
  crawler_run_items: { id: string; url: string; http_status: number | null; outcome: string; error_category: string | null; flagged_facts: number; document_id: string | null }[] };
const stamp = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);

// Two tabs (?tab=urls|runs), each a table; a row opens the slide-over
// Inspector (?target=, ?run=, or ?new=1 to register a URL), the same pattern
// as /admin/access.
export default async function CrawlerAdminPage({ searchParams }: PageProps<"/admin/crawler">) {
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminCrawler;
  if (!permissions.includes("crawler.manage")) return <NoAccess title={t.noAccessTitle} locale={locale}>{dict.adminSources.noAccessHelp(permissionName("crawler.manage", locale))}</NoAccess>;
  const when = (v: string | null) => v ? stamp(v) : t.never;
  const params = await searchParams;
  const tab = params.tab === "runs" ? "runs" : "urls";
  const results = await Promise.all([
    client.from("sources").select("id,name,canonical_url,crawl_enabled,crawl_policy,status").order("name"),
    client.from("crawl_targets").select("id,source_id,url,kind,path_prefix,max_urls,content_selector,active").order("url"),
    client.from("crawl_url_states").select("source_id,url,last_status,last_outcome,last_fetched_at,last_document_id"),
    client.from("crawler_runs").select("id,trigger,status,started_at,finished_at,note,counts,crawler_run_items(id,url,http_status,outcome,error_category,flagged_facts,document_id)").order("started_at", { ascending: false }).limit(10),
  ]);
  if (results.some((r) => r.error)) { logAccessError("crawler_admin"); throw new Error("Không tải được dữ liệu crawler."); }
  const sources = results[0].data as Source[];
  const targets = results[1].data as Target[];
  const states = results[2].data as State[];
  const runs = results[3].data as unknown as Run[];
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const stateOf = (target: Target) => states.find((x) => x.url === target.url && x.source_id === target.source_id);
  const here = (change: Record<string, string | null>) => withParams("/admin/crawler", params, change);
  const id = (k: string) => typeof params[k] === "string" && uuidPattern.test(params[k] as string) ? params[k] as string : undefined;

  let body: React.ReactNode;
  let panel: React.ReactNode = null;
  if (tab === "urls") {
    const sort = readSort(["source", "fetched"] as const, params.sort, params.dir, "source");
    const rows = sortRows(targets, (r) => sort.key === "source" ? sourceById.get(r.source_id)?.name : stateOf(r)?.last_fetched_at ?? null, sort.dir);
    const header = (key: "source" | "fetched", label: string) => ({ label, sorted: sort.key === key ? sort.dir : null, sortHref: here({ sort: key, dir: nextDir(sort, key) }) });
    body = <>
      <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", target: null })} className={buttonPrimary}>{t.newUrl}</Link></div>
      <DataTable locale={locale} label={t.tabs.urls} minWidth="52rem" columns={[{ label: t.url }, header("source", t.source), { label: t.kind }, { label: t.lastOutcome }, header("fetched", t.fetchedAt)]}
        empty={!targets.length && <EmptyState>{t.noTargets}</EmptyState>}>
        {rows.map((target) => {
          const s = sourceById.get(target.source_id);
          const ready = s ? crawlReadiness(s, locale) : null;
          const st = stateOf(target);
          const o = st?.last_outcome ? crawlOutcome(st.last_outcome, locale) : null;
          return <DataRow key={target.id} href={here({ target: target.id, new: null })} selected={target.id === id("target")} title={<span className="break-all">{target.url}</span>}>
            <Cell>{s?.name ?? "—"}{ready && !ready.ready && <span className="block text-[12px] text-caution">{ready.reason}</span>}</Cell>
            <Cell><span className="flex flex-wrap gap-1.5"><Badge>{target.kind === "sitemap" ? t.sitemap : t.page}</Badge>{!target.active && <Badge tone="caution">{t.off}</Badge>}</span></Cell>
            <Cell>{o ? <Badge tone={o.tone}>{o.label}</Badge> : <span className="text-ink-3">—</span>}</Cell>
            <Cell className="whitespace-nowrap tabular-nums">{when(st?.last_fetched_at ?? null)}</Cell>
          </DataRow>;
        })}
      </DataTable>
    </>;
    const open = targets.find((r) => r.id === id("target"));
    if (params.new === "1") panel = <Inspector locale={locale} title={t.newUrl} closeHref={here({ new: null })}>
      <TargetForm locale={locale} sources={sources.map((s) => ({ id: s.id, label: `${s.name} — ${s.canonical_url}` }))} />
    </Inspector>;
    else if (open) {
      const s = sourceById.get(open.source_id);
      const st = stateOf(open);
      const ready = s ? crawlReadiness(s, locale) : null;
      panel = <Inspector locale={locale} title={<span className="break-all">{open.url}</span>} subtitle={s?.name} closeHref={here({ target: null })}>
        <div className="mb-5 space-y-3">
          {ready && <Notice tone={ready.ready ? "positive" : "caution"}>{ready.reason}</Notice>}
          <p className="text-[15px] text-ink-2">{t.lastFetch(when(st?.last_fetched_at ?? null))}{st?.last_status ? t.httpCode(st.last_status) : ""}
            {st?.last_document_id && <> · <Link href={`/documents/${st.last_document_id}`} className={textLink}>{t.latestDocument}</Link></>}</p>
        </div>
        <TargetForm sources={[]} target={open} locale={locale} />
      </Inspector>;
    }
  } else {
    const flaggedOf = (r: Run) => r.crawler_run_items.reduce((a, i) => a + i.flagged_facts, 0);
    body = <DataTable locale={locale} label={t.tabs.runs} minWidth="48rem" columns={[{ label: t.started }, { label: t.status }, { label: t.trigger }, { label: t.result }, { label: t.flagged, className: "text-right" }]}
      empty={!runs.length && <EmptyState>{t.noRuns}</EmptyState>}>
      {runs.map((r) => {
        const st = crawlRunStatus(r.status, locale);
        const summary = Object.entries(r.counts ?? {}).map(([k, n]) => `${crawlOutcome(k, locale).label}: ${n}`).join(" · ");
        const flagged = flaggedOf(r);
        return <DataRow key={r.id} href={here({ run: r.id })} selected={r.id === id("run")} title={<span className="tabular-nums">{when(r.started_at)}</span>}>
          <Cell><Badge tone={st.tone}>{st.label}</Badge></Cell>
          <Cell>{triggerLabel(r.trigger, locale)}</Cell>
          <Cell className="max-w-72 truncate">{summary || r.note || t.nothingProcessed}</Cell>
          <Cell className="text-right tabular-nums">{flagged ? <Badge tone="caution">{t.nFacts(flagged)}</Badge> : "0"}</Cell>
        </DataRow>;
      })}
    </DataTable>;
    const open = runs.find((r) => r.id === id("run"));
    if (open) {
      const st = crawlRunStatus(open.status, locale);
      panel = <Inspector locale={locale} title={t.run(stamp(open.started_at))} subtitle={`${st.label} · ${triggerLabel(open.trigger, locale)}`} closeHref={here({ run: null })}>
        {open.note && <p className="mb-4 text-[15px] text-ink-2">{open.note}</p>}
        <p className="mb-3 text-[13px] text-ink-3">{t.flaggedHelp}</p>
        {open.crawler_run_items.length ? <List label={t.processed}>{open.crawler_run_items.map((i) => <ListRow key={i.id} title={<span className="break-all text-[14px] font-normal">{i.url}</span>}
          href={i.document_id ? `/documents/${i.document_id}` : undefined}
          badges={<Badge tone={crawlOutcome(i.outcome, locale).tone}>{crawlOutcome(i.outcome, locale).label}</Badge>}
          meta={[i.http_status && `HTTP ${i.http_status}`, i.error_category, i.flagged_facts ? t.nFlagged(i.flagged_facts) : null].filter(Boolean).join(" · ") || undefined} />)}</List>
          : <EmptyState>{t.noItems}</EmptyState>}
      </Inspector>;
    }
  }

  return <>
    <PageHeader eyebrow={dict.adminOverview.eyebrow} title={t.title} description={t.description}
      actions={<Link href="/admin/sources" className={`${textLink} text-[15px]`}>{t.manageSources}</Link>} />
    <div className="mb-6"><Notice tone="neutral">{t.politeness}</Notice></div>
    <Segmented label={dict.adminAccess.part} items={[{ href: withParams("/admin/crawler", {}, {}), label: t.tabs.urls, count: targets.length, active: tab === "urls" },
      { href: withParams("/admin/crawler", {}, { tab: "runs" }), label: t.tabs.runs, active: tab === "runs" }]} />
    <div className="mt-1">{body}</div>
    {panel}
  </>;
}
