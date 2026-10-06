import { getDictionary, getLocale } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/facts/domain";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { likePattern } from "@/lib/education/domain";
import { ruleTypeLabel } from "@/lib/immigration/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { RuleForm, RuleReviewForm } from "./forms";
import { Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, Quote, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge, SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";
import { VisibilityNote } from "@/components/review/visibility-note";
import { ReviewSteps } from "@/components/review/review-steps";
import { DecisionHistory } from "@/components/review/decision-history";
import { permissionName } from "@/lib/rbac/labels";
import { publicIds } from "@/lib/review/public-check";
import { ruleBlockers, visibilityOf } from "@/lib/review/visibility";

type Source = { name: string; source_tier: string | null; status: string };
type RuleRow = { id: string; title: string; rule_type: string; status: string; official_url: string; evidence_excerpt: string; document_id: string; countries: { name: string }; documents: { sources: Source } };
const tabs = ["proposed", "reviewed", "rejected"] as const;

export default async function Page({ searchParams }: PageProps<"/immigration/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("immigration.manage"), review = permissions.includes("facts.review");
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.immigrationWorkspace, e = dict.editor;
  if (!manage && !review) return <NoAccess title={t.noAccessTitle} back="/immigration" backLabel={e.viewPublic}>{dict.educationWorkspace.noAccessHelp(permissionName("immigration.manage", locale), permissionName("facts.review", locale))}</NoAccess>;
  const params = await searchParams;
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "proposed");
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  let list = client.from("immigration_rules").select("id,title,rule_type,status,official_url,evidence_excerpt,document_id,countries(name),documents!immigration_rules_document_id_fkey(sources(name,source_tier,status))", { count: "exact" }).eq("status", status);
  if (q) list = list.ilike("title", likePattern(q));
  const results = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, to),
    // Only T1 documents can prove a rule; filtering here just saves a failed attempt.
    client.from("documents").select("id,title,canonical_url,sources!inner(name,source_tier)").eq("sources.source_tier", "T1").order("created_at", { ascending: false }).limit(100),
    client.from("countries").select("id,name").order("name"),
    client.from("immigration_rule_reviews").select("id,decision,note,created_at,immigration_rules(title)").order("created_at", { ascending: false }).limit(20),
    ...tabs.map(([s]) => client.from("immigration_rules").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/immigration/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("immigration_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rules = (results[0].data ?? []) as unknown as RuleRow[];
  const documents = (results[1].data as unknown as { id: string; title: string | null; canonical_url: string; sources: { name: string } }[])
    .map((d) => ({ id: d.id, label: `${d.title ?? d.canonical_url} · ${d.sources.name}` }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as unknown as { id: string; decision: string; note: string; created_at: string; immigration_rules: { title: string } | null }[];
  const tabCounts = results.slice(4).map((r) => r.count ?? 0);
  // Only reviewed rules can be public; ask the database (as anon) which are.
  const visible = status === "reviewed" ? await publicIds("immigration_rules", rules.map((r) => r.id)) : new Set<string>();
  return <>
    <PageHeader eyebrow={e.eyebrow} title={t.title} description={t.description}
      actions={<><Link className={`${textLink} text-[15px]`} href="/immigration">{e.publicPage}</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">{t.enterRequirements}</Link><Link className={`${textLink} text-[15px]`} href="/admin/sources">{t.verifySources}</Link></>} />
    {review && <ReviewSteps client={client} permissions={permissions} current="immigration" locale={locale} />}
    {manage && <Disclosure summary={t.propose}><RuleForm countries={countries} documents={documents} locale={locale} /></Disclosure>}
    <Section title="Danh sách">
      <Segmented label={e.status} items={tabs.map((value, i) => ({ href: withParams("/immigration/workspace", { q }, { status: value === "proposed" ? null : value }), label: e.statusTabs[value], count: tabCounts[i], active: status === value }))} />
      <form action="/immigration/workspace" className="mb-5">{status !== "proposed" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder={t.search} /></form>
      {rules.length ? <List>{rules.map((r) => <ListRow key={r.id} title={r.title}
        badges={<><ReviewBadge status={r.status}>{statusLabel(r.status, locale)}</ReviewBadge><TierBadge tier={r.documents.sources.source_tier} locale={locale} /><SourceStatusBadge status={r.documents.sources.status}>{r.documents.sources.status === "verified" ? e.sourceVerified : e.sourceUnverified}</SourceStatusBadge></>}
        subtitle={`${ruleTypeLabel(r.rule_type, locale)} · ${r.countries.name} · ${r.documents.sources.name}`}>
        <div className="mb-2"><VisibilityNote visibility={visibilityOf(r.id, r.status, visible, ruleBlockers({ source: r.documents.sources }))} publicHref={`/immigration/${r.id}`} locale={locale} /></div>
        {/* Open in the review queue: the evidence and the decision are the work. */}
        <Disclosure small open={review && r.status === "proposed"} summary={review && r.status === "proposed" ? e.evidenceAndDecision : e.evidence}>
          <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
            <p className="break-all text-[13px] text-ink-3">{r.official_url}</p>
            <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>{e.evidenceDocumentLink}</Link>
            {review && r.status === "proposed" && <RuleReviewForm id={r.id} locale={locale} />}</div>
        </Disclosure>
      </ListRow>)}</List> : <EmptyState>{status === "proposed" ? t.emptyProposed : e.emptyGroup}</EmptyState>}
      <Pagination summary={pageSummary(results[0].count ?? rules.length, page)} href={(p) => withParams("/immigration/workspace", params, { page: p })} locale={locale} />
    </Section>
    <Section>
      <DecisionHistory locale={locale} items={reviews.map((r) => ({ id: r.id, title: r.immigration_rules?.title ?? t.gone, decision: r.decision, note: r.note, createdAt: r.created_at }))} />
    </Section>
  </>;
}
