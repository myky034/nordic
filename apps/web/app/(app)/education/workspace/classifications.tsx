import Link from "next/link";
import { redirect } from "next/navigation";
import { logAccessError, type accessContext } from "@/lib/rbac/access";
import { statusLabel } from "@/lib/facts/domain";
import { degreeLabel, likePattern } from "@/lib/education/domain";
import { careerPathName, classifiableFields, isStale, studyFieldName } from "@/lib/taxonomy/domain";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { publicIds } from "@/lib/review/public-check";
import { visibilityOf } from "@/lib/review/visibility";
import { Badge, Disclosure, EmptyState, List, ListRow, Pagination, Quote, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";
import { VisibilityNote } from "@/components/review/visibility-note";
import { DecisionHistory } from "@/components/review/decision-history";
import { ClassificationForm, ClassificationReviewForm } from "./forms";

type Client = Awaited<ReturnType<typeof accessContext>>["client"];
type Params = Record<string, string | string[] | undefined>;
type Path = { name_vi: string; name_en: string; version: number; include_rule: string; exclude_rule: string | null; active: boolean };
type Row = {
  id: string; status: string; evidence_excerpt: string; document_id: string; career_path_version: number | null;
  programmes: { id: string; name: string; degree_type: string; universities: { name: string } | null } | null;
  study_fields: { code: string; name_en: string; name_vi: string } | null;
  career_paths: Path | null;
};
export const classificationTabs = ["proposed", "stale", "reviewed", "rejected"] as const;
const select = "id,status,evidence_excerpt,document_id,career_path_version,programmes!inner(id,name,degree_type,universities!programmes_university_id_fkey(name)),"
  + "study_fields(code,name_en,name_vi),career_paths(name_vi,name_en,version,include_rule,exclude_rule,active)";
// Stale classifications are found by comparing two columns, which PostgREST
// cannot filter on, so they are read (capped) and filtered here.
const STALE_LIMIT = 500;

/**
 * Slice 11b: the "Phân loại ngành / hướng nghề" kind of the education
 * workspace — propose form, status tabs (including "needs re-review" after a
 * career path's criteria changed), evidence and decision for each row.
 */
export async function ClassificationSection({ client, params, status, locale, manage, review }: {
  client: Client; params: Params; status: (typeof classificationTabs)[number]; locale: Locale; manage: boolean; review: boolean;
}) {
  const d = dictionaries[locale], t = d.classification, e = d.editor, w = d.educationWorkspace;
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  let list = client.from("programme_classifications").select(select, { count: "exact" });
  list = status === "stale" ? list.eq("status", "reviewed").not("career_path_id", "is", null) : list.eq("status", status);
  if (q) list = list.ilike("programmes.name", likePattern(q));
  list = list.order("created_at", { ascending: false });
  const results = await Promise.all([
    status === "stale" ? list.limit(STALE_LIMIT) : list.range(from, to),
    ...(["proposed", "reviewed", "rejected"] as const).map((s) => client.from("programme_classifications").select("id", { count: "exact", head: true }).eq("status", s)),
    client.from("programme_classifications").select("status,career_path_version,career_paths(version)").eq("status", "reviewed").not("career_path_id", "is", null).limit(STALE_LIMIT),
    client.from("classification_reviews").select("id,decision,note,created_at,programme_classifications(programmes(name),study_fields(code,name_en,name_vi),career_paths(name_vi,name_en))")
      .order("created_at", { ascending: false }).limit(20),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/education/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("classification_workspace"); throw new Error("Không tải được phân loại."); }
  const all = (results[0].data ?? []) as unknown as Row[];
  const rows = status === "stale" ? all.filter(isStale) : all;
  const [proposed, reviewed, rejected] = results.slice(1, 4).map((r) => r.count ?? 0);
  const staleCount = ((results[4].data ?? []) as unknown as Parameters<typeof isStale>[0][]).filter(isStale).length;
  const counts = { proposed, stale: staleCount, reviewed, rejected };
  const history = (results[5].data ?? []) as unknown as { id: string; decision: string; note: string; created_at: string;
    programme_classifications: { programmes: { name: string } | null; study_fields: { code: string; name_en: string; name_vi: string } | null; career_paths: { name_vi: string; name_en: string } | null } | null }[];
  const visible = status === "reviewed" || status === "stale" ? await publicIds("programme_classifications", rows.map((r) => r.id)) : new Set<string>();
  const target = (r: { study_fields: Row["study_fields"]; career_paths: { name_vi: string; name_en: string } | null }) => r.study_fields
    ? `${r.study_fields.code} · ${studyFieldName(r.study_fields, locale)}`
    : r.career_paths ? `${careerPathName(r.career_paths, locale)} (${t.nordicPath})` : w.gone;
  const tabLabel = (s: (typeof classificationTabs)[number]) => (s === "stale" ? t.staleTab : e.statusTabs[s]);
  const base = { kind: "classification" };

  return <>
    {manage && <Disclosure summary={t.propose}><ProposeClassification client={client} locale={locale} /></Disclosure>}
    <Section title={e.list}>
      <Segmented label={e.status} items={classificationTabs.map((s) => ({ href: withParams("/education/workspace", { q }, { ...base, status: s === "proposed" ? null : s }), label: tabLabel(s), count: counts[s], active: status === s }))} />
      <form action="/education/workspace" className="mb-5">
        <input type="hidden" name="kind" value="classification" />{status !== "proposed" && <input type="hidden" name="status" value={status} />}
        <SearchInput defaultValue={q} placeholder={t.searchProgramme} />
      </form>
      {rows.length ? <List>{rows.map((r) => {
        const stale = isStale(r);
        const retired = !!r.career_paths && !r.career_paths.active;
        const decide = review && (r.status === "proposed" || stale);
        return <ListRow key={r.id} title={target(r)}
          badges={<><ReviewBadge status={r.status}>{statusLabel(r.status, locale)}</ReviewBadge>{stale && <Badge tone="caution">{t.stale}</Badge>}</>}
          subtitle={r.programmes ? `${r.programmes.name} · ${degreeLabel(r.programmes.degree_type, locale)} · ${r.programmes.universities?.name ?? ""}` : w.gone}>
          <div className="mb-2 space-y-1">
            {r.programmes && <VisibilityNote visibility={visibilityOf(r.id, r.status, visible, [])} publicHref={`/programmes/${r.programmes.id}`} locale={locale} />}
            {stale && r.career_paths && <p className="text-[13px] text-caution">{t.staleHelp(r.career_path_version ?? 0, r.career_paths.version)}</p>}
            {retired && <p className="text-[13px] text-ink-3">{t.retiredPath}</p>}
          </div>
          <Disclosure small open={decide} summary={decide ? e.evidenceAndDecision : e.evidence}>
            <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
              <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>{e.evidenceDocumentLink}</Link>
              {r.career_paths && <div className="rounded-xl bg-fill/40 p-3 text-[14px] leading-relaxed">
                <p className="font-semibold text-ink">{t.criteria(r.career_paths.version)}</p>
                <p className="mt-1 text-[13px] font-medium text-ink-3">{t.include}</p><p className="whitespace-pre-wrap text-ink-2">{r.career_paths.include_rule}</p>
                {r.career_paths.exclude_rule && <><p className="mt-1 text-[13px] font-medium text-ink-3">{t.exclude}</p><p className="whitespace-pre-wrap text-ink-2">{r.career_paths.exclude_rule}</p></>}
              </div>}
              {decide && <ClassificationReviewForm id={r.id} revalidate={stale} locale={locale} />}
            </div>
          </Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>{status === "proposed" ? t.emptyProposed : status === "stale" ? t.emptyStale : e.emptyGroup}</EmptyState>}
      {status !== "stale" && <Pagination summary={pageSummary(results[0].count ?? rows.length, page)} href={(p) => withParams("/education/workspace", params, { page: p })} locale={locale} />}
    </Section>
    <Section>
      <DecisionHistory locale={locale} items={history.map((h) => {
        const c = h.programme_classifications;
        return { id: h.id, decision: h.decision, note: h.note, createdAt: h.created_at,
          title: c ? `${c.programmes?.name ?? w.gone} → ${target(c)}` : w.gone, detail: t.historyDetail };
      })} />
    </Section>
  </>;
}

/** Loads the options the propose form needs; only rendered for education.manage holders. */
async function ProposeClassification({ client, locale }: { client: Client; locale: Locale }) {
  const results = await Promise.all([
    client.from("programmes").select("id,name,degree_type,official_url,universities!programmes_university_id_fkey(name)").eq("status", "reviewed").in("degree_type", ["master", "phd"]).order("name").limit(500),
    client.from("study_fields").select("id,code,level,name_en,name_vi").order("code"),
    client.from("career_paths").select("id,name_vi,name_en,version,include_rule,exclude_rule").eq("active", true).order("name_vi"),
    client.from("documents").select("id,title,canonical_url").order("created_at", { ascending: false }).limit(300),
  ]);
  if (results.some((r) => r.error)) { logAccessError("classification_form"); throw new Error("Không tải được dữ liệu cho form phân loại."); }
  const programmes = (results[0].data as unknown as { id: string; name: string; degree_type: string; official_url: string; universities: { name: string } | null }[])
    .map((p) => ({ id: p.id, label: `${p.name} · ${degreeLabel(p.degree_type, locale)} · ${p.universities?.name ?? ""}`, url: p.official_url }));
  const fields = classifiableFields(results[1].data as { id: string; code: string; level: number; name_en: string; name_vi: string }[])
    .map((f) => ({ id: f.id, code: f.code, level: f.level, label: `${f.code} · ${studyFieldName(f, locale)}` }));
  const paths = (results[2].data as { id: string; name_vi: string; name_en: string; version: number; include_rule: string; exclude_rule: string | null }[])
    .map((p) => ({ id: p.id, label: careerPathName(p, locale), version: p.version, include: p.include_rule, exclude: p.exclude_rule }));
  const documents = (results[3].data as { id: string; title: string | null; canonical_url: string }[]).map((doc) => ({ id: doc.id, label: doc.title ?? doc.canonical_url, url: doc.canonical_url }));
  if (!fields.length && !paths.length) return <p className="text-[15px] text-ink-2">{dictionaries[locale].classification.noTargets}</p>;
  return <ClassificationForm programmes={programmes} fields={fields} paths={paths} documents={documents} locale={locale} />;
}
