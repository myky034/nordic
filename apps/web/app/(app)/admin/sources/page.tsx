import Link from "next/link";
import { accessContext } from "@/lib/rbac/access";
import { listSources, listCountries } from "@/lib/registry/queries";
import { SourceForm } from "./forms";

export default async function AdminSourcesPage() {
  const { permissions } = await accessContext();
  if (!permissions.includes("sources.manage")) {
    return <section><h1 className="text-2xl font-semibold">Không có quyền quản lý Source Registry</h1><p className="mt-4">Cần quyền sources.manage. Nhờ quản trị viên cấp tại Người dùng & phân quyền.</p><Link href="/dashboard" className="mt-4 inline-block underline">Về workspace</Link></section>;
  }
  const [sources, countries] = await Promise.all([listSources({}), listCountries()]);
  return <div className="mx-auto max-w-4xl space-y-8">
    <header>
      <h1 className="text-3xl font-semibold">Source Registry</h1>
      <p className="mt-3 text-zinc-500">Thêm/sửa nguồn và kiểm soát crawl. Mọi thay đổi được ghi nhật ký. Đăng ký nguồn không xác minh nội dung của nó.</p>
      <Link href="/sources" className="mt-3 inline-block text-sm underline">Xem trang công khai</Link>
    </header>
    <SourceForm countries={countries} />
    <section className="space-y-5">
      <h2 className="text-2xl font-medium">{sources.length > 100 ? "100 nguồn gần nhất" : `${sources.length} nguồn`}</h2>
      {sources.slice(0, 100).map((source) => <SourceForm key={source.id} source={source} countries={countries} />)}
    </section>
  </div>;
}
