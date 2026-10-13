import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { appliesToLabel, factTypeLabel, metricCategoryLabel, valueKindLabel } from "@/lib/compare/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { Badge, EmptyState, NoAccess, PageHeader } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { MetricForm, type FactTypeRow } from "./forms";

// L3a: a sortable table of fact types (was comparison metrics); a row opens
// the slide-over Inspector (?metric=) with the edit form, "new" opens an
// empty one (?new=1) — the same pattern as /admin/access.
export default async function MetricsPage({ searchParams }: PageProps<"/admin/metrics">) {
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminMetrics;
  const categoryName = (c: string) => metricCategoryLabel(c, locale);
  if (!permissions.includes("metrics.manage")) return <NoAccess title={t.noAccessTitle} locale={locale}>{dict.adminSources.noAccessHelp(permissionName("metrics.manage", locale))}</NoAccess>;
  const params = await searchParams;
  const { data, error } = await client.from("fact_types")
    .select("id,key,label_vi,label_en,definition_vi,definition_en,value_kind,applies_to,unit_hint,min_value,max_value,category,comparable,active").order("category").order("label_vi");
  if (error) { logAccessError("fact_types_admin"); throw new Error("Không tải được loại thông tin."); }
  const metrics = data as FactTypeRow[];
  const label = (m: FactTypeRow) => factTypeLabel(m, locale);
  const here = (change: Record<string, string | null>) => withParams("/admin/metrics", params, change);
  const sort = readSort(["label", "category"] as const, params.sort, params.dir, "category");
  const rows = sortRows(metrics, (m) => (sort.key === "label" ? label(m) : `${categoryName(m.category)} ${label(m)}`), sort.dir);
  const header = (key: "label" | "category", label: string) => ({ label, sorted: sort.key === key ? sort.dir : null, sortHref: here({ sort: key, dir: nextDir(sort, key) }) });
  const open = typeof params.metric === "string" && uuidPattern.test(params.metric) ? metrics.find((m) => m.id === params.metric) : undefined;
  return <>
    <PageHeader eyebrow={dict.adminOverview.eyebrow} title={t.title} description={t.description}
      actions={<Link href="/compare" className={`${textLink} text-[15px]`}>{t.viewCompare}</Link>} />
    <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", metric: null })} className={buttonPrimary}>{t.newMetric}</Link></div>
    <DataTable locale={locale} label={t.title} minWidth="44rem" columns={[header("label", t.name), header("category", t.category), { label: t.kind }, { label: t.appliesTo }, { label: t.comparable }, { label: t.status }]}
      empty={!metrics.length && <EmptyState>{t.empty}</EmptyState>}>
      {rows.map((m) => <DataRow key={m.id} href={here({ metric: m.id, new: null })} selected={m.id === open?.id} title={label(m)}>
        <Cell>{categoryName(m.category)}</Cell>
        <Cell>{valueKindLabel(m.value_kind, locale)}{m.unit_hint && <span className="text-ink-3"> · {m.unit_hint}</span>}</Cell>
        <Cell>{appliesToLabel(m.applies_to, locale)}</Cell>
        <Cell>{m.comparable ? t.yes : <span className="text-ink-3">—</span>}</Cell>
        <Cell>{m.active ? <Badge tone="accent">{t.active}</Badge> : <Badge tone="caution">{t.inactive}</Badge>}</Cell>
      </DataRow>)}
    </DataTable>
    {params.new === "1" && <Inspector locale={locale} title={t.newMetric} closeHref={here({ new: null })}><MetricForm locale={locale} /></Inspector>}
    {params.new !== "1" && open && <Inspector locale={locale} title={label(open)} subtitle={<span className="font-mono">{open.key}</span>} closeHref={here({ metric: null })}><MetricForm metric={open} locale={locale} /></Inspector>}
  </>;
}
