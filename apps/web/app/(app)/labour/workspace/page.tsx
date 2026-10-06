import { getDictionary, getLocale } from "@/lib/i18n/server";
import { statusLabel } from "@/lib/facts/domain";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { likePattern } from "@/lib/education/domain";
import { classificationLabel } from "@/lib/labour/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { OccupationForm, OccupationReviewForm } from "./forms";
import { Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, Quote, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";
import { VisibilityNote } from "@/components/review/visibility-note";
import { ReviewSteps } from "@/components/review/review-steps";
import { DecisionHistory } from "@/components/review/decision-history";
import { permissionName } from "@/lib/rbac/labels";
import { publicIds } from "@/lib/review/public-check";
import { visibilityOf } from "@/lib/review/visibility";

type Row = { id: string; name: string; status: string; classification_system: string | null; classification_code: string | null; evidence_excerpt: string; document_id: string; countries: { name: string } | null };
const tabs = ["proposed", "reviewed", "rejected"] as const;

export default async function Page({ searchParams }: PageProps<"/labour/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("labour.manage"), review = permissions.includes("facts.review");
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.labourWorkspace, e = dict.editor;
  if (!manage && !review) return <NoAccess title={t.noAccessTitle} back="/occupations" backLabel={e.viewPublic}>{dict.educationWorkspace.noAccessHelp(permissionName("labour.manage", locale), permissionName("facts.review", locale))}</NoAccess>;
  const params = await searchParams;
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "proposed");
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  let list = client.from("occupations").select("id,name,status,classification_system,classification_code,evidence_excerpt,document_id,countries(name)", { count: "exact" }).eq("status", status);
  if (q) list = list.ilike("name", likePattern(q));
  const results = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, to),
    client.from("documents").select("id,title,canonical_url").order("created_at", { ascending: false }).limit(100),
    client.from("countries").select("id,name").order("name"),
    client.from("occupation_reviews").select("id,decision,note,created_at,occupations(name)").order("created_at", { ascending: false }).limit(20),
    ...tabs.map(([s]) => client.from("occupations").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/labour/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("labour_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rows = (results[0].data ?? []) as unknown as Row[];
  const documents = (results[1].data as { id: string; title: string | null; canonical_url: string }[]).map((d) => ({ id: d.id, label: d.title ?? d.canonical_url }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as unknown as { id: string; decision: string; note: string; created_at: string; occupations: { name: string } | null }[];
  const tabCounts = results.slice(4).map((r) => r.count ?? 0);
  // occupations_public needs only the review itself, so there are no blockers
  // to explain; the check still comes from the database, not from the status.
  const visible = status === "reviewed" ? await publicIds("occupations", rows.map((r) => r.id)) : new Set<string>();
  return <>
    <PageHeader eyebrow={e.eyebrow} title={t.title} description={t.description}
      actions={<><Link className={`${textLink} text-[15px]`} href="/occupations">{e.publicPage}</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">{t.enterFigures}</Link></>} />
    {review && <ReviewSteps client={client} permissions={permissions} current="labour" locale={locale} />}
    {manage && <Disclosure summary={t.propose}><OccupationForm countries={countries} documents={documents} locale={locale} /></Disclosure>}
    <Section title="Danh sách">
      <Segmented label={e.status} items={tabs.map((value, i) => ({ href: withParams("/labour/workspace", { q }, { status: value === "proposed" ? null : value }), label: e.statusTabs[value], count: tabCounts[i], active: status === value }))} />
      <form action="/labour/workspace" className="mb-5">{status !== "proposed" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder={t.search} /></form>
      {rows.length ? <List>{rows.map((r) => <ListRow key={r.id} title={r.name}
        badges={<ReviewBadge status={r.status}>{statusLabel(r.status, locale)}</ReviewBadge>}
        subtitle={`${r.countries?.name ?? e.international} · ${classificationLabel(r.classification_system, r.classification_code, locale)}`}>
        <div className="mb-2"><VisibilityNote visibility={visibilityOf(r.id, r.status, visible, [])} publicHref={`/occupations/${r.id}`} locale={locale} /></div>
        <Disclosure small open={review && r.status === "proposed"} summary={review && r.status === "proposed" ? e.evidenceAndDecision : e.evidence}>
          <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
            <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>{e.evidenceDocumentLink}</Link>
            {review && r.status === "proposed" && <OccupationReviewForm id={r.id} locale={locale} />}</div>
        </Disclosure>
      </ListRow>)}</List> : <EmptyState>{status === "proposed" ? t.emptyProposed : e.emptyGroup}</EmptyState>}
      <Pagination summary={pageSummary(results[0].count ?? rows.length, page)} href={(p) => withParams("/labour/workspace", params, { page: p })} locale={locale} />
    </Section>
    <Section>
      <DecisionHistory locale={locale} items={reviews.map((r) => ({ id: r.id, title: r.occupations?.name ?? t.gone, decision: r.decision, note: r.note, createdAt: r.created_at }))} />
    </Section>
  </>;
}
