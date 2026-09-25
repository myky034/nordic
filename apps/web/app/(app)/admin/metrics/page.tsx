import Link from "next/link";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { metricCategories } from "@/lib/compare/domain";
import { Badge, Card, Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { MetricForm } from "./forms";

type Metric = { id: string; key: string; label: string; description: string; unit_hint: string | null; category: string; active: boolean };

export default async function MetricsPage() {
  const { client, permissions } = await accessContext();
  if (!permissions.includes("metrics.manage")) return <NoAccess title="Không có quyền quản lý chỉ số so sánh">Cần quyền metrics.manage. Nhờ quản trị viên cấp tại Người dùng & phân quyền.</NoAccess>;
  const { data, error } = await client.from("comparison_metrics").select("id,key,label,description,unit_hint,category,active").order("category").order("label");
  if (error) { logAccessError("metrics_admin"); throw new Error("Không tải được chỉ số."); }
  const metrics = data as Metric[];
  return <>
    <PageHeader eyebrow="Quản trị" title="Chỉ số so sánh"
      description="Chỉ số là định nghĩa dùng để xếp các thông tin cùng loại của nhiều quốc gia vào một hàng so sánh. Đây chỉ là định nghĩa, không chứa giá trị nào; giá trị được nhập ở Thông tin & bằng chứng."
      actions={<Link href="/compare" className={`${textLink} text-[15px]`}>Xem trang so sánh</Link>} />
    <Disclosure summary="Tạo chỉ số mới"><Card><MetricForm /></Card></Disclosure>
    <Section title={`${metrics.length} chỉ số`}>
      {metrics.length ? <List>{metrics.map((m) => <ListRow key={m.id} title={m.label}
        badges={<><Badge>{metricCategories[m.category as keyof typeof metricCategories] ?? m.category}</Badge>{!m.active && <Badge tone="caution">Ngừng dùng</Badge>}</>}
        subtitle={`${m.key}${m.unit_hint ? ` · ${m.unit_hint}` : ""} · ${m.description}`}>
        <Disclosure small summary="Chỉnh sửa"><MetricForm metric={m} /></Disclosure>
      </ListRow>)}</List> : <EmptyState>Chưa có chỉ số nào. Không có chỉ số nào được tạo sẵn: mỗi định nghĩa là quyết định của quản trị viên.</EmptyState>}
    </Section>
  </>;
}
