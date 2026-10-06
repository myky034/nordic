import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { metricCategoryLabel } from "@/lib/compare/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { Badge, EmptyState, NoAccess, PageHeader } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { MetricForm } from "./forms";

type Metric = { id: string; key: string; label: string; description: string; unit_hint: string | null; category: string; active: boolean };

// A sortable table of metric definitions; a row opens the slide-over
// Inspector (?metric=) with the edit form, "Tạo chỉ số mới" opens an empty one
// (?new=1) — the same pattern as /admin/access.
export default async function MetricsPage({ searchParams }: PageProps<"/admin/metrics">) {
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminMetrics;
  const categoryName = (c: string) => metricCategoryLabel(c, locale);
  if (!permissions.includes("metrics.manage")) return <NoAccess title={t.noAccessTitle} locale={locale}>{dict.adminSources.noAccessHelp(permissionName("metrics.manage", locale))}</NoAccess>;
  const params = await searchParams;
  const { data, error } = await client.from("comparison_metrics").select("id,key,label,description,unit_hint,category,active").order("category").order("label");
  if (error) { logAccessError("metrics_admin"); throw new Error("Không tải được chỉ số."); }
  const metrics = data as Metric[];
  const here = (change: Record<string, string | null>) => withParams("/admin/metrics", params, change);
  const sort = readSort(["label", "category"] as const, params.sort, params.dir, "category");
  const rows = sortRows(metrics, (m) => (sort.key === "label" ? m.label : `${categoryName(m.category)} ${m.label}`), sort.dir);
  const header = (key: "label" | "category", label: string) => ({ label, sorted: sort.key === key ? sort.dir : null, sortHref: here({ sort: key, dir: nextDir(sort, key) }) });
  const open = typeof params.metric === "string" && uuidPattern.test(params.metric) ? metrics.find((m) => m.id === params.metric) : undefined;
  return <>
    <PageHeader eyebrow={dict.adminOverview.eyebrow} title={t.title} description={t.description}
      actions={<Link href="/compare" className={`${textLink} text-[15px]`}>{t.viewCompare}</Link>} />
    <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", metric: null })} className={buttonPrimary}>{t.newMetric}</Link></div>
    <DataTable locale={locale} label={t.title} minWidth="44rem" columns={[header("label", t.name), header("category", t.category), { label: t.unitHint }, { label: t.status }]}
      empty={!metrics.length && <EmptyState>{t.empty}</EmptyState>}>
      {rows.map((m) => <DataRow key={m.id} href={here({ metric: m.id, new: null })} selected={m.id === open?.id} title={m.label}>
        <Cell>{categoryName(m.category)}</Cell>
        <Cell>{m.unit_hint ?? <span className="text-ink-3">—</span>}</Cell>
        <Cell>{m.active ? <Badge tone="accent">{t.active}</Badge> : <Badge tone="caution">{t.inactive}</Badge>}</Cell>
      </DataRow>)}
    </DataTable>
    {params.new === "1" && <Inspector locale={locale} title={t.newMetric} closeHref={here({ new: null })}><MetricForm locale={locale} /></Inspector>}
    {params.new !== "1" && open && <Inspector locale={locale} title={open.label} subtitle={<span className="font-mono">{open.key}</span>} closeHref={here({ metric: null })}><MetricForm metric={open} locale={locale} /></Inspector>}
  </>;
}
