import { accessContext } from "@/lib/rbac/access";
import { listSources } from "@/lib/registry/queries";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { ImportForm } from "./form";
export default async function ImportPage() {
  const context = await accessContext();
  if (!context.permissions.includes("documents.ingest")) return <NoAccess title="Bạn chưa có quyền nhập tài liệu">Hãy nhờ quản trị viên gán vai trò có quyền documents.ingest.</NoAccess>;
  const sources = await listSources({});
  return <>
    <PageHeader eyebrow="Workspace" title="Nhập tài liệu" description="Chọn nguồn → điền metadata và chọn file gốc → xem trước → nhập. File chỉ được đọc trên máy bạn để tính hash; không upload toàn văn." />
    <Card><ImportForm sources={sources.slice(0,100).map((s) => ({ id:s.id,name:s.name,url:s.canonicalUrl,blocked:s.crawlPolicy === "blocked" }))} /></Card>
  </>;
}
