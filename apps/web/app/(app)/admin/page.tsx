import { Suspense } from "react";
import { accessContext } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { readWindow } from "@/lib/admin/overview";
import { withParams } from "@/lib/pagination";
import { NoAccess, PageHeader, Section, Segmented } from "@/components/ui";
import { ActivitySection, CoverageSection, CrawlerSection, ExtractionSection } from "./sections";
import { SectionPlaceholder } from "./views";

// Admin overview: system state, data coverage and review activity on one
// page, for administrators (roles.manage). Read-only; every figure links to
// the page where it can be acted on. Numbers come from lib/admin/overview.ts.
export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const { client, permissions } = await accessContext();
  if (!permissions.includes("roles.manage")) return <NoAccess title="Không có quyền xem bảng điều khiển quản trị">{`Cần quyền “${permissionName("roles.manage")}”.`}</NoAccess>;
  const params = await searchParams;
  const days = readWindow(params.days);
  const now = new Date();
  const props = { client, permissions, now };
  return <>
    <PageHeader eyebrow="Quản trị" title="Bảng điều khiển quản trị"
      description="Tình trạng crawler và AI, dữ liệu đã có theo từng quốc gia, và hoạt động duyệt. Mọi con số là số dòng bạn được phép đọc, đếm trực tiếp từ cơ sở dữ liệu; không có điểm số hay xếp hạng." />
    <Section title="Tình trạng hệ thống">
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<SectionPlaceholder />}><CrawlerSection {...props} /></Suspense>
        <Suspense fallback={<SectionPlaceholder />}><ExtractionSection {...props} /></Suspense>
      </div>
    </Section>
    <Section title="Độ phủ dữ liệu" description="Nguồn: số đã xác minh / tổng số. Trường, chương trình, quy định và nghề: chỉ đếm mục đã duyệt. Bấm một quốc gia để mở hồ sơ công khai.">
      <Suspense fallback={<SectionPlaceholder />}><CoverageSection client={client} permissions={permissions} /></Suspense>
    </Section>
    <Section title="Hoạt động duyệt" actions={<Segmented label="Khoảng thời gian" items={[
      { href: withParams("/admin", params, { days: null }), label: "7 ngày", active: days === 7 },
      { href: withParams("/admin", params, { days: "30" }), label: "30 ngày", active: days === 30 },
    ]} />}>
      <Suspense key={days} fallback={<SectionPlaceholder />}><ActivitySection {...props} days={days} /></Suspense>
    </Section>
  </>;
}
