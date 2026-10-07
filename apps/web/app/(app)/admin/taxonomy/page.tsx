import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { uuidPattern } from "@/lib/documents/domain";
import { decisionTime } from "@/lib/review/history";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { buildFieldTree, careerPathName, filterFields, studyFieldName, type CareerPathRow, type StudyFieldNode, type StudyFieldRow } from "@/lib/taxonomy/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/locales";
import { Badge, EmptyState, NoAccess, Notice, PageHeader, SearchInput, Segmented } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { CareerPathForm } from "./forms";

type FieldRow = StudyFieldRow & { document_id: string; source_page: number | null; verified_by: string; verified_on: string };
type Version = { id: string; version: number; changed_at: string; include_rule: string };

// Two tabs (?tab=careers|fields). Career paths: a sortable table, a row opens
// the Inspector with the edit form and version history (?path=, ?new=1), the
// same pattern as /admin/metrics. Fields of study: the imported ISCED-F tree,
// read-only, with a search that keeps matches in their place in the tree.
export default async function TaxonomyPage({ searchParams }: PageProps<"/admin/taxonomy">) {
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminTaxonomy;
  if (!permissions.includes("taxonomy.manage")) return <NoAccess title={t.noAccessTitle} locale={locale}>{dict.adminSources.noAccessHelp(permissionName("taxonomy.manage", locale))}</NoAccess>;
  const params = await searchParams;
  const tab = params.tab === "fields" ? "fields" : "careers";
  const here = (change: Record<string, string | null>) => withParams("/admin/taxonomy", params, change);

  let body: React.ReactNode;
  let panel: React.ReactNode = null;
  if (tab === "careers") {
    const { data, error } = await client.from("career_paths")
      .select("id,key,name_vi,name_en,definition_vi,definition_en,include_rule,exclude_rule,keywords,version,active,updated_at").order("name_vi");
    if (error) { logAccessError("taxonomy_admin"); throw new Error("Không tải được hướng nghề."); }
    const paths = data as CareerPathRow[];
    const sort = readSort(["name", "updated"] as const, params.sort, params.dir, "name");
    const rows = sortRows(paths, (p) => (sort.key === "name" ? careerPathName(p, locale) : p.updated_at), sort.dir);
    const header = (key: "name" | "updated", label: string) => ({ label, sorted: sort.key === key ? sort.dir : null, sortHref: here({ sort: key, dir: nextDir(sort, key) }) });
    const open = typeof params.path === "string" && uuidPattern.test(params.path) ? paths.find((p) => p.id === params.path) : undefined;
    body = <>
      <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", path: null })} className={buttonPrimary}>{t.newPath}</Link></div>
      <DataTable locale={locale} label={t.tabs.careers} minWidth="40rem" columns={[header("name", t.name), { label: t.key }, { label: t.version, className: "text-right" }, { label: t.status }]}
        empty={!paths.length && <EmptyState>{t.noPaths}</EmptyState>}>
        {rows.map((p) => <DataRow key={p.id} href={here({ path: p.id, new: null })} selected={p.id === open?.id} title={careerPathName(p, locale)}>
          <Cell className="font-mono text-[13px]">{p.key}</Cell>
          <Cell className="text-right tabular-nums">{p.version}</Cell>
          <Cell>{p.active ? <Badge tone="accent">{t.active}</Badge> : <Badge tone="caution">{t.retired}</Badge>}</Cell>
        </DataRow>)}
      </DataTable>
    </>;
    if (params.new === "1") panel = <Inspector locale={locale} title={t.newPath} closeHref={here({ new: null })}><CareerPathForm locale={locale} /></Inspector>;
    else if (open) {
      const versions = await client.from("career_path_versions").select("id,version,changed_at,include_rule").eq("career_path_id", open.id).order("version", { ascending: false });
      if (versions.error) { logAccessError("taxonomy_versions"); throw new Error("Không tải được lịch sử hướng nghề."); }
      panel = <Inspector locale={locale} title={careerPathName(open, locale)} subtitle={<span className="font-mono">{open.key} · v{open.version}</span>} closeHref={here({ path: null })}>
        <CareerPathForm path={open} locale={locale} />
        <section className="mt-8">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t.history}</h3>
          <ul className="space-y-3">{(versions.data as Version[]).map((v) => <li key={v.id} className="text-[14px]">
            <p className="font-medium text-ink">{t.versionLine(v.version, decisionTime(v.changed_at, locale))}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-ink-2">{v.include_rule}</p>
          </li>)}</ul>
        </section>
      </Inspector>;
    }
  } else {
    const { data, error } = await client.from("study_fields").select("id,code,level,parent_id,name_en,name_vi,document_id,source_page,verified_by,verified_on").order("code");
    if (error) { logAccessError("taxonomy_fields"); throw new Error("Không tải được danh mục ngành."); }
    const all = data as FieldRow[];
    const q = typeof params.q === "string" ? params.q.slice(0, 100) : "";
    const shown = filterFields(all, q);
    const first = all[0];
    body = <>
      <div className="mb-4"><Notice tone="neutral">{t.fieldsNote}</Notice></div>
      {all.length === 0 ? <EmptyState title={t.fieldsEmptyTitle}>{t.fieldsEmpty}</EmptyState> : <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form action="/admin/taxonomy" className="w-full sm:w-80"><input type="hidden" name="tab" value="fields" /><SearchInput defaultValue={q} placeholder={t.searchFields} /></form>
          <p className="text-[13px] text-ink-3">
            {t.fieldCount(all.length)} · {t.source}: <Link href={`/documents/${first.document_id}`} className={textLink}>ISCED-F 2013</Link>
            {" · "}{t.verified(first.verified_by, first.verified_on)}
          </p>
        </div>
        {shown.length ? <div className="rounded-2xl bg-surface p-4 ring-1 ring-hairline sm:p-5"><FieldTree nodes={buildFieldTree(shown)} locale={locale} pageLabel={t.sourcePage} /></div>
          : <EmptyState>{t.noFieldMatch(q)}</EmptyState>}
      </>}
    </>;
  }

  return <>
    <PageHeader eyebrow={dict.adminOverview.eyebrow} title={t.title} description={t.description} />
    <Segmented label={dict.adminAccess.part} items={[
      { href: withParams("/admin/taxonomy", {}, {}), label: t.tabs.careers, active: tab === "careers" },
      { href: withParams("/admin/taxonomy", {}, { tab: "fields" }), label: t.tabs.fields, active: tab === "fields" },
    ]} />
    <div className="mt-1">{body}</div>
    {panel}
  </>;
}

/** Nested list: code, name in the viewer's language, the other language below in small type. */
function FieldTree({ nodes, locale, pageLabel }: { nodes: (StudyFieldNode & { source_page?: number | null })[]; locale: Locale; pageLabel: (p: number) => string }) {
  return <ul className="space-y-1">{nodes.map((n) => <li key={n.id}>
    <div className={`flex items-baseline gap-3 py-1 ${n.level === 1 ? "font-semibold text-ink" : "text-ink"}`}>
      <span className="w-12 shrink-0 font-mono text-[13px] text-ink-3">{n.code}</span>
      <span className="min-w-0 text-[15px]">{studyFieldName(n, locale)}
        <span className="block text-[12px] font-normal text-ink-3">{studyFieldName(n, locale === "en" ? "vi" : "en")}{n.source_page ? ` · ${pageLabel(n.source_page)}` : ""}</span>
      </span>
    </div>
    {n.children.length > 0 && <div className="ml-4 border-l border-hairline pl-3"><FieldTree nodes={n.children} locale={locale} pageLabel={pageLabel} /></div>}
  </li>)}</ul>;
}
