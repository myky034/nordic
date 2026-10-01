import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { metricCategories } from "@/lib/compare/domain";
import { uuidPattern } from "@/lib/documents/domain";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { Badge, EmptyState, NoAccess, PageHeader } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, textLink } from "@/components/ui/styles";
import { MetricForm } from "./forms";

type Metric = { id: string; key: string; label: string; description: string; unit_hint: string | null; category: string; active: boolean };
const categoryName = (c: string) => metricCategories[c as keyof typeof metricCategories] ?? c;

// A sortable table of metric definitions; a row opens the slide-over
// Inspector (?metric=) with the edit form, "Tạo chỉ số mới" opens an empty one
// (?new=1) — the same pattern as /admin/access.
export default async function MetricsPage({ searchParams }: PageProps<"/admin/metrics">) {
  const { client, permissions } = await accessContext();
  if (!permissions.includes("metrics.manage")) return <NoAccess title="Không có quyền quản lý chỉ số so sánh">{`Cần quyền “${permissionName("metrics.manage")}”. Nhờ quản trị viên cấp ở trang Người dùng & phân quyền.`}</NoAccess>;
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
    <PageHeader eyebrow="Quản trị" title="Chỉ số so sánh"
      description="Chỉ số là định nghĩa dùng để xếp các thông tin cùng loại của nhiều quốc gia vào một hàng trong bảng so sánh. Đây chỉ là định nghĩa, không chứa giá trị nào; giá trị được nhập ở Thông tin & bằng chứng."
      actions={<Link href="/compare" className={`${textLink} text-[15px]`}>Xem trang so sánh</Link>} />
    <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", metric: null })} className={buttonPrimary}>Tạo chỉ số mới</Link></div>
    <DataTable label="Chỉ số so sánh" minWidth="44rem" columns={[header("label", "Tên chỉ số"), header("category", "Nhóm"), { label: "Đơn vị gợi ý" }, { label: "Trạng thái" }]}
      empty={!metrics.length && <EmptyState>Chưa có chỉ số nào. Không có chỉ số nào được tạo sẵn: mỗi định nghĩa là quyết định của quản trị viên.</EmptyState>}>
      {rows.map((m) => <DataRow key={m.id} href={here({ metric: m.id, new: null })} selected={m.id === open?.id} title={m.label}>
        <Cell>{categoryName(m.category)}</Cell>
        <Cell>{m.unit_hint ?? <span className="text-ink-3">—</span>}</Cell>
        <Cell>{m.active ? <Badge tone="accent">Đang dùng</Badge> : <Badge tone="caution">Ngừng dùng</Badge>}</Cell>
      </DataRow>)}
    </DataTable>
    {params.new === "1" && <Inspector title="Tạo chỉ số mới" closeHref={here({ new: null })}><MetricForm /></Inspector>}
    {params.new !== "1" && open && <Inspector title={open.label} subtitle={<span className="font-mono">{open.key}</span>} closeHref={here({ metric: null })}><MetricForm metric={open} /></Inspector>}
  </>;
}
