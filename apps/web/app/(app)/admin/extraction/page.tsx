import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { itemOutcome, reasonLabel, requestStatus, runStatus } from "@/lib/extraction/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/locales";
import { triggerLabel } from "@/lib/runs";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { Badge, Card, EmptyState, List, ListRow, NoAccess, Notice, PageHeader, Segmented } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { textLink } from "@/components/ui/styles";
import { AccountForm } from "./forms";

type Request = { id: string; document_id: string; status: string; note: string | null; created_at: string; documents: { title: string | null; canonical_url: string } | null };
type Item = { id: string; outcome: string; reason: string | null; fact_id: string | null; candidate: { subject?: string; predicate?: string; value?: string } };
type Run = { id: string; trigger: string; provider: string; model: string; prompt_version: string; status: string; started_at: string; note: string | null;
  input_tokens: number; output_tokens: number; counts: Record<string, number> | null; extraction_items: Item[] };
const when = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);

// Tabs (?tab=requests|runs|settings): open requests and runs are tables; a run
// opens in the slide-over Inspector (?run=) with every candidate and, for a
// refused one, the reason explained in Vietnamese. Settings (the AI account)
// is for administrators only.
export default async function ExtractionAdminPage({ searchParams }: PageProps<"/admin/extraction">) {
  const { client, permissions } = await accessContext();
  const editor = permissions.includes("facts.propose") || permissions.includes("facts.review");
  const admin = permissions.includes("roles.manage");
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminExtraction, crawler = dict.adminCrawler;
  const n = (v: number) => v.toLocaleString(intlLocale[locale]);
  if (!editor && !admin) return <NoAccess title={t.noAccessTitle} locale={locale}>{t.noAccessHelp(permissionName("facts.propose", locale), permissionName("facts.review", locale))}</NoAccess>;
  const params = await searchParams;
  const tab = params.tab === "runs" ? "runs" : params.tab === "settings" && admin ? "settings" : "requests";
  const results = await Promise.all([
    client.from("extraction_settings").select("ai_user_id,updated_at").maybeSingle(),
    client.from("extraction_requests").select("id,document_id,status,note,created_at,documents(title,canonical_url)").in("status", ["pending", "running"]).order("created_at"),
    client.from("extraction_runs").select("id,trigger,provider,model,prompt_version,status,started_at,note,input_tokens,output_tokens,counts,extraction_items(id,outcome,reason,fact_id,candidate)")
      .order("started_at", { ascending: false }).limit(10),
  ]);
  if (results.some((r) => r.error)) { logAccessError("extraction_admin"); throw new Error("Không tải được dữ liệu trích xuất."); }
  const account = results[0].data as { ai_user_id: string; updated_at: string } | null;
  const open = (results[1].data ?? []) as unknown as Request[];
  const runs = (results[2].data ?? []) as unknown as Run[];
  const here = (change: Record<string, string | null>) => withParams("/admin/extraction", params, change);
  const selectedRun = typeof params.run === "string" && uuidPattern.test(params.run) ? runs.find((r) => r.id === params.run) : undefined;

  let body: React.ReactNode;
  if (tab === "requests") {
    body = <DataTable locale={locale} label={t.tabs.requests} minWidth="40rem" columns={[{ label: t.document }, { label: crawler.status }, { label: t.requestedAt }]}
      empty={!open.length && <EmptyState>{t.noRequests}</EmptyState>}>
      {open.map((r) => <DataRow key={r.id} href={`/documents/${r.document_id}`} title={r.documents?.title ?? r.documents?.canonical_url ?? dict.common.untitledDocument}>
        <Cell><Badge tone={requestStatus(r.status, locale).tone}>{requestStatus(r.status, locale).label}</Badge></Cell>
        <Cell className="whitespace-nowrap tabular-nums">{when(r.created_at)}</Cell>
      </DataRow>)}
    </DataTable>;
  } else if (tab === "runs") {
    body = <DataTable locale={locale} label={t.tabs.runs} minWidth="52rem" columns={[{ label: crawler.started }, { label: crawler.status }, { label: crawler.trigger }, { label: crawler.result }, { label: t.model }]}
      empty={!runs.length && <EmptyState>{crawler.noRuns}</EmptyState>}>
      {runs.map((r) => {
        const st = runStatus(r.status, locale);
        const summary = Object.entries(r.counts ?? {}).map(([k, c]) => `${itemOutcome(k, locale).label}: ${c}`).join(" · ");
        return <DataRow key={r.id} href={here({ run: r.id })} selected={r.id === selectedRun?.id} title={<span className="tabular-nums">{when(r.started_at)}</span>}>
          <Cell><Badge tone={st.tone}>{st.label}</Badge></Cell>
          <Cell>{triggerLabel(r.trigger, locale)}</Cell>
          <Cell className="max-w-72 truncate">{summary || r.note || t.noDocuments}</Cell>
          <Cell className="whitespace-nowrap">{r.model}</Cell>
        </DataRow>;
      })}
    </DataTable>;
  } else {
    body = <Card><AccountForm current={account?.ai_user_id ?? null} locale={locale} /></Card>;
  }

  let panel: React.ReactNode = null;
  if (tab === "runs" && selectedRun) {
    const r = selectedRun;
    const st = runStatus(r.status, locale);
    panel = <Inspector locale={locale} title={crawler.run(when(r.started_at))} subtitle={`${st.label} · ${triggerLabel(r.trigger, locale)}`} closeHref={here({ run: null })}>
      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
        <dt className="text-ink-3">{t.model}</dt><dd className="text-ink">{r.model}</dd>
        <dt className="text-ink-3">{t.provider}</dt><dd className="break-all text-ink">{r.provider}</dd>
        <dt className="text-ink-3">{t.promptVersion}</dt><dd className="text-ink">{r.prompt_version}</dd>
        <dt className="text-ink-3">{dict.adminOverview.tokensInOut}</dt><dd className="tabular-nums text-ink">{n(r.input_tokens)} / {n(r.output_tokens)}</dd>
      </dl>
      {r.note && <p className="mb-4 text-[15px] text-ink-2">{r.note}</p>}
      {r.extraction_items.length ? <List label={t.suggestions}>{r.extraction_items.map((i) => <ListRow key={i.id}
        title={<span className="text-[14px] font-normal">{i.candidate.subject ?? "?"} — {i.candidate.predicate ?? "?"}: {i.candidate.value ?? "?"}</span>}
        badges={<Badge tone={itemOutcome(i.outcome, locale).tone}>{itemOutcome(i.outcome, locale).label}</Badge>}
        subtitle={reasonLabel(i.reason, locale) ?? undefined} meta={i.reason && reasonLabel(i.reason, locale) !== i.reason ? i.reason : undefined} />)}</List>
        : <EmptyState>{t.noSuggestions}</EmptyState>}
    </Inspector>;
  }

  return <>
    <PageHeader eyebrow={dict.adminOverview.eyebrow} title={t.title} description={t.description}
      actions={<Link href="/facts/workspace" className={`${textLink} text-[15px]`}>{dict.documentEditor.reviewQueue}</Link>} />
    {!account && <div className="mb-6"><Notice tone="caution" title={dict.adminOverview.noAccountTitle}>{t.noAccountText(admin)}</Notice></div>}
    <Segmented label={dict.adminAccess.part} items={[
      { href: withParams("/admin/extraction", {}, {}), label: t.tabs.requests, count: open.length, active: tab === "requests" },
      { href: withParams("/admin/extraction", {}, { tab: "runs" }), label: t.tabs.runs, active: tab === "runs" },
      ...(admin ? [{ href: withParams("/admin/extraction", {}, { tab: "settings" }), label: t.tabs.settings, active: tab === "settings" }] : []),
    ]} />
    {tab === "requests" && <p className="mb-3 px-1 text-[13px] text-ink-3">{t.requestsHelp}</p>}
    <div className="mt-1">{body}</div>
    {panel}
  </>;
}
