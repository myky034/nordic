import { accessContext } from "@/lib/rbac/access";
import { listSources } from "@/lib/registry/queries";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { permissionName } from "@/lib/rbac/labels";
import { ImportForm } from "./form";
export default async function ImportPage() {
  const context = await accessContext();
  if (!context.permissions.includes("documents.ingest")) return <NoAccess title="Bạn chưa có quyền nhập tài liệu">{`Hãy nhờ quản trị viên gán vai trò có quyền “${permissionName("documents.ingest")}”.`}</NoAccess>;
  const sources = await listSources({});
  return <>
    <PageHeader eyebrow="Biên tập" title="Nhập tài liệu" description="Lưu một trang của nguồn đã đăng ký vào Nordic: chọn nguồn, điền thông tin trang và chọn file đã lưu về máy, xem trước rồi nhập. File chỉ được đọc trên máy bạn để tính mã băm; toàn văn không được tải lên." />
    <Card><ImportForm sources={sources.slice(0,100).map((s) => ({ id:s.id,name:s.name,url:s.canonicalUrl,blocked:s.crawlPolicy === "blocked" }))} /></Card>
  </>;
}
