import Link from "next/link";
import { notFound } from "next/navigation";
import { isStructureV1, type DocumentStructure } from "@nordic/db/document-structure";
import { accessContext } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { canOpenFactsWorkspace } from "@/lib/rbac/ui";
import { crawlOutcome, crawlRunStatus } from "@/lib/crawler/domain";
import { loadPreview, loadPreviewDocument, type SnapshotMeta, type SnapshotRow } from "@/lib/crawler/structure-queries";
import { canOpenPreview, canReadStructures, diffStructures, filterStructure, previewState, sectionsOf, shortHash, STRUCTURE_READ_PERMISSIONS } from "@/lib/crawler/structure-view";
import { uuidPattern } from "@/lib/documents/domain";
import { statusLabel } from "@/lib/facts/domain";
import { canonicalSourceUrl } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { withParams } from "@/lib/pagination";
import { BackLink, Badge, DescriptionList, Disclosure, EmptyState, ExternalLink, List, ListRow, NoAccess, Notice, PageHeader, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge } from "@/components/ui/badges";
import { Inspector } from "@/components/ui/inspector";
import { buttonSmall, control, textLink } from "@/components/ui/styles";
import { BlocksView, DiffView, ElementDetails, JsonLdView, LinksView, OverviewView, PairsView, TablesView } from "@/components/crawler/structure-preview";

// PR 1.5 (docs/architecture/pr1.5-structure-preview-plan.md): a READ-ONLY view
// of what the crawler read from one document. No form here writes anything.
// Every query uses the viewer's own Supabase client, so RLS (not this page)
// decides which structures come back; the permission check below only picks
// which message to show.
const TABS = ["overview", "pairs", "blocks", "tables", "links", "jsonld", "diff"] as const;
type Tab = (typeof TABS)[number];
const stamp = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);

export default async function StructurePreviewPage({ params, searchParams }: PageProps<"/admin/crawler/documents/[id]">) {
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.structurePreview;
  const perms = STRUCTURE_READ_PERMISSIONS.map((p) => permissionName(p, locale)).join(", ");
  if (!canOpenPreview(permissions)) return <NoAccess title={t.noAccessTitle} locale={locale}>{t.noAccess(`${permissionName("crawler.manage", locale)}, ${perms}`)}</NoAccess>;

  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const doc = await loadPreviewDocument(client, id);
  if (!doc) notFound();

  const query = await searchParams;
  const str = (k: string) => typeof query[k] === "string" ? (query[k] as string) : undefined;
  const uuid = (k: string) => { const v = str(k); return v && uuidPattern.test(v) ? v : undefined; };
  const tab: Tab = (TABS as readonly string[]).includes(str("tab") ?? "") ? str("tab") as Tab : "overview";
  const path = `/admin/crawler/documents/${id}`;
  const here = (change: Record<string, string | null>) => withParams(path, query, change);
  const original = canonicalSourceUrl(doc.canonical_url);
  const crawlerOperator = permissions.includes("crawler.manage");

  const header = <PageHeader back={<BackLink href="/admin/crawler">{t.back}</BackLink>} eyebrow={t.eyebrow}
    title={<span className="break-words">{doc.title ?? doc.canonical_url}</span>}
    description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>{doc.sources?.name ?? "—"}</span><span>{t.retrieved(stamp(doc.retrieved_at))}</span>
      {original && <ExternalLink href={original}>{t.openOriginal}</ExternalLink>}
      <Link href={`/documents/${id}`} className={textLink}>{dict.documents.eyebrow}</Link></span>} />;

  // State 1: not fetched by the crawler — nothing to load.
  if (previewState({ ingestionMethod: doc.ingestion_method, canRead: true, snapshotCount: 0 }) === "not_crawled")
    return <>{header}<EmptyState title={t.notCrawledTitle}>{t.notCrawled}</EmptyState></>;

  const data = await loadPreview(client, doc, { snapshotId: uuid("snapshot"), compareId: uuid("compare"), crawlerOperator });
  if (uuid("snapshot") && !data.current) notFound();
  const state = previewState({ ingestionMethod: doc.ingestion_method, canRead: canReadStructures(permissions), snapshotCount: data.snapshots.length });

  const attempts = <Section title={t.lastCrawl}>
    {crawlerOperator ? data.attempts.length ? <List label={t.lastCrawl}>{data.attempts.map((a, i) => {
      const o = crawlOutcome(a.outcome, locale);
      const run = a.crawler_runs ? crawlRunStatus(a.crawler_runs.status, locale) : null;
      return <ListRow key={i} title={<span className="tabular-nums">{stamp(a.created_at)}</span>}
        badges={<><Badge tone={o.tone}>{o.label}</Badge>{run && <Badge tone={run.tone}>{t.run}: {run.label}</Badge>}</>}
        meta={[a.http_status && `HTTP ${a.http_status}`, a.error_category, a.crawler_runs?.note].filter(Boolean).join(" · ") || undefined} />;
    })}</List> : <EmptyState>{t.noCrawlInfo}</EmptyState> : <p className="text-[15px] text-ink-2">{t.noCrawlInfo}</p>}
  </Section>;

  // Facts are a separate, normalized layer: kept apart from the raw content.
  const facts = <Section className="rounded-3xl bg-fill/50 p-5 sm:p-6" title={t.normalizedTitle} description={t.normalizedHelp}
    actions={canOpenFactsWorkspace(permissions) ? <Link href={`/facts/map/${id}`} className={`${textLink} text-[15px]`}>{t.openMap}</Link> : undefined}>
    {data.facts.length ? <List label={t.normalizedTitle}>{data.facts.map((f) => <ListRow key={f.id}
      title={f.fact_types ? (locale === "en" ? f.fact_types.label_en : f.fact_types.label_vi) : "—"}
      subtitle={<span className="break-words">{f.value}{f.unit ? ` ${f.unit}` : ""}</span>}
      badges={<ReviewBadge status={f.status}>{statusLabel(f.status, locale)}</ReviewBadge>} />)}</List>
      : <EmptyState>{t.normalizedNone}</EmptyState>}
  </Section>;

  const notice = <div className="mb-8"><Notice tone="caution">{t.rawNotice}</Notice></div>;
  if (state === "no_access") return <>{header}{notice}<Notice tone="caution" title={t.noAccessTitle}>{t.noAccess(perms)}</Notice>{facts}</>;
  if (state === "missing") return <>{header}{notice}<EmptyState title={t.missingTitle}>{t.missing}</EmptyState>{attempts}{facts}</>;

  const current = data.current as SnapshotRow;
  const latestId = data.snapshots[0]?.id;
  const versionOf = new Map(data.versions.map((v) => [v.id, v.retrieved_at]));
  const snapshotLabel = (s: SnapshotMeta) => `${stamp(s.captured_at)} · ${shortHash(s.structure_hash)}`;
  // Comparison candidates: older snapshots of this version, and the latest of each other version.
  const candidates = [...data.snapshots.filter((s) => s.id !== current.id), ...data.otherLatest];

  const meta = <Section title={t.snapshot}>
    <DescriptionList items={[
      [t.capturedAt, <span key="c" className="tabular-nums">{stamp(current.captured_at)}{current.id === latestId && <> <Badge tone="accent">{t.latest}</Badge></>}</span>],
      [t.format, <span key="f" className="font-mono text-[13px]">{current.format_version}</span>],
      [t.hash, <span key="h" className="font-mono text-[13px]" title={current.structure_hash}>{shortHash(current.structure_hash)}</span>],
      [t.run, <span key="r" className="font-mono text-[13px]">{current.crawler_run_id}</span>],
    ]} />
    <div className="mt-4 space-y-3">
      <Disclosure small summary={`${t.history} (${data.snapshots.length})`}>
        <List label={t.history}>{data.snapshots.map((s) => <ListRow key={s.id} href={here({ snapshot: s.id === latestId ? null : s.id, compare: null, ref: null })}
          title={<span className="tabular-nums">{snapshotLabel(s)}</span>}
          badges={<>{s.id === latestId && <Badge tone="accent">{t.latest}</Badge>}{s.id === current.id && <Badge>{t.viewing}</Badge>}</>} />)}</List>
      </Disclosure>
      <Disclosure small summary={`${t.versions} (${data.versions.length})`}>
        <List label={t.versions}>{data.versions.map((v) => <ListRow key={v.id} href={`/admin/crawler/documents/${v.id}`}
          title={<span className="tabular-nums">{stamp(v.retrieved_at)}</span>} badges={v.id === id ? <Badge>{t.viewing}</Badge> : undefined} />)}</List>
      </Disclosure>
      <Disclosure small summary={t.compareWith}>
        {candidates.length ? <List label={t.compareWith}>{candidates.map((s) => <ListRow key={s.id} href={here({ compare: s.id, tab: "diff", ref: null })}
          title={<span className="tabular-nums">{snapshotLabel(s)}</span>}
          meta={s.document_id === id ? undefined : `${t.versions}: ${stamp(versionOf.get(s.document_id) ?? s.captured_at)}`}
          badges={s.id === data.compare?.id ? <Badge tone="accent">{t.comparing}</Badge> : undefined} />)}</List>
          : <EmptyState>{t.noCompare}</EmptyState>}
      </Disclosure>
    </div>
  </Section>;

  // Unknown format or a malformed payload: show it raw rather than guess.
  if (!isStructureV1(current.structure))
    return <>{header}{notice}{meta}<Notice tone="caution" title={t.unknownFormatTitle}>{t.unknownFormat}</Notice>
      <pre className="mt-4 max-h-[40rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-surface p-4 font-mono text-[12px] ring-1 ring-hairline">{JSON.stringify(current.structure, null, 2)}</pre>{facts}</>;

  const full: DocumentStructure = current.structure;
  const q = str("q") ?? "";
  const section = str("section") ?? "";
  const shown = filterStructure(full, { q, section });
  const refId = str("ref");
  const href = (ref: string) => here({ ref });
  // Diff by content, oldest on the left.
  const other = data.compare && isStructureV1(data.compare.structure) ? data.compare : null;
  const diff = other ? (other.captured_at <= current.captured_at ? diffStructures(other.structure as DocumentStructure, full) : diffStructures(full, other.structure as DocumentStructure)) : null;

  const views: Record<Tab, React.ReactNode> = {
    overview: <OverviewView s={full} locale={locale} />,
    pairs: <PairsView s={shown} href={href} selected={refId} locale={locale} />,
    blocks: <BlocksView s={shown} href={href} selected={refId} locale={locale} />,
    tables: <TablesView s={shown} locale={locale} />,
    links: <LinksView s={shown} href={href} selected={refId} locale={locale} />,
    jsonld: <JsonLdView s={full} locale={locale} />,
    diff: <DiffView diff={diff} locale={locale} />,
  };
  const filterable = tab === "pairs" || tab === "blocks" || tab === "tables" || tab === "links";

  return <>
    {header}{notice}{meta}
    <Section title={t.title}>
      <Segmented label={t.title} scroll={false} items={TABS.map((k) => ({ href: here({ tab: k === "overview" ? null : k, ref: null }), label: t.tabs[k], active: tab === k,
        count: k === "pairs" ? full.pairs.length : k === "blocks" ? full.blocks.length : k === "tables" ? full.tables.length : k === "links" ? full.links.length : undefined }))} />
      {filterable && <form method="get" action={path} className="mb-4 flex flex-wrap items-end gap-2">
        {(["tab", "snapshot", "compare"] as const).map((k) => str(k) ? <input key={k} type="hidden" name={k} value={str(k)} /> : null)}
        <div className="min-w-56 flex-1"><SearchInput defaultValue={q} placeholder={t.filter} /></div>
        <select name="section" defaultValue={section} aria-label={t.allSections} className={`${control} mt-0 w-auto max-w-xs`}>
          <option value="">{t.allSections}</option>{sectionsOf(full).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit" className={buttonSmall}>{t.apply}</button>
        {(q || section) && <Link scroll={false} href={here({ q: null, section: null, ref: null })} className={`${textLink} text-[14px]`}>{t.clear}</Link>}
      </form>}
      {views[tab]}
    </Section>
    {facts}
    {refId && <Inspector locale={locale} title={t.element(refId)} closeHref={here({ ref: null })}><ElementDetails s={full} refId={refId} locale={locale} /></Inspector>}
  </>;
}
