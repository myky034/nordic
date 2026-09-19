import Link from "next/link";
import { accessContext } from "@/lib/rbac/access";
import { listSources } from "@/lib/registry/queries";
import { ImportForm } from "./form";
export default async function ImportPage() {
  const context = await accessContext();
  if (!context.permissions.includes("documents.ingest")) return <section><h1 className="text-2xl font-semibold">Bạn chưa có quyền nhập tài liệu</h1><p className="mt-4">Hãy nhờ quản trị viên gán vai trò có quyền documents.ingest.</p><Link href="/dashboard" className="mt-5 inline-block underline">Về workspace</Link></section>;
  const sources = await listSources({});
  return <div className="mx-auto max-w-3xl"><h1 className="text-3xl font-semibold">Nhập tài liệu</h1><p className="mt-3 text-zinc-500">Chọn nguồn → điền metadata và chọn file gốc → xem trước → nhập. File chỉ được đọc trên máy bạn để tính hash; không upload toàn văn.</p><ImportForm sources={sources.slice(0,100).map((s) => ({ id:s.id,name:s.name,url:s.canonicalUrl,blocked:s.crawlPolicy === "blocked" }))} /></div>;
}
