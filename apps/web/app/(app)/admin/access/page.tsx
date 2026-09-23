import Link from "next/link";
import { accessContext, logAccessError, type RoleRow, type UserRow, type AuditRow } from "@/lib/rbac/access";
import { RoleForm, AssignmentForm } from "./forms";

export default async function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  const context = await accessContext();
  const manage = context.permissions.includes("roles.manage");
  const assign = context.permissions.includes("users.assign_roles");
  if (!manage && !assign) return <section><h1 className="text-2xl font-semibold">Không có quyền quản lý phân quyền</h1><p className="mt-4">Nếu hệ thống chưa có quản trị viên, người vận hành cần chạy lệnh bootstrap một lần. Việc đăng nhập không tự cấp quyền quản trị.</p><Link href="/dashboard" className="mt-4 inline-block underline">Về workspace</Link></section>;
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const offset = typeof params.offset === "string" && /^\d{1,5}$/.test(params.offset) ? Math.min(10000, Number(params.offset)) : 0;
  const results = await Promise.all([
    context.client.from("roles").select("id,name,description,role_permissions(permission_key)").order("name"),
    context.client.from("permissions").select("key,description").order("key"),
    context.client.from("access_audit").select("id,actor_id,action,target_id,details,created_at").order("created_at", { ascending: false }).limit(50),
    assign ? context.client.rpc("search_access_users", { p_query: query, p_offset: offset }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (results.some((r) => r.error)) { logAccessError("access_screen"); throw new Error("Unable to load access configuration"); }
  const roles = results[0].data as RoleRow[];
  const permissions = results[1].data as { key: string; description: string }[];
  const audit = results[2].data as AuditRow[];
  const users = results[3].data as UserRow[];
  return <div className="mx-auto max-w-6xl space-y-10">
    <header><h1 className="text-3xl font-semibold">Người dùng & phân quyền</h1><p className="mt-3 text-zinc-500">Cấu hình vai trò và quyền tại đây. Thay đổi có hiệu lực ở yêu cầu tiếp theo và được ghi nhật ký.</p></header>
    {manage && <section><h2 className="mb-5 text-2xl font-medium">Vai trò</h2><div className="grid gap-5 md:grid-cols-2"><RoleForm permissions={permissions} own={context.permissions} />{roles.map((role) => <RoleForm key={JSON.stringify(role)} role={role} permissions={permissions} own={context.permissions} />)}</div></section>}
    {assign && <section><h2 className="text-2xl font-medium">Người dùng</h2><form className="my-5 flex gap-3"><label className="sr-only" htmlFor="user-search">Tìm theo email</label><input id="user-search" name="q" placeholder="Tìm theo email" defaultValue={query} maxLength={200} className="w-full max-w-md rounded-lg border bg-transparent p-3" /><button className="rounded-lg border px-5">Tìm</button></form>
      <div className="divide-y">{users.map((user) => <article key={user.user_id} className="py-5"><h3 className="font-medium">{user.email ?? "Email chưa có"}</h3><p className="mt-1 break-all text-xs text-zinc-500">{user.user_id}</p><AssignmentForm user={user.user_id} roles={roles} current={user.role_ids} own={context.permissions} self={user.user_id === context.userId} /></article>)}</div>
      {!users.length && <p>Không tìm thấy người dùng.</p>}
      <div className="mt-4 flex gap-6">{offset>0 && <Link className="underline" href={`/admin/access?q=${encodeURIComponent(query)}&offset=${Math.max(0, offset-20)}`}>Trang trước</Link>}{users.length===20 && offset<10000 && <Link className="underline" href={`/admin/access?q=${encodeURIComponent(query)}&offset=${offset+20}`}>Trang sau</Link>}</div>
    </section>}
    <section><h2 className="text-2xl font-medium">Nhật ký thay đổi</h2><p className="mt-2 text-sm text-zinc-500">50 thao tác gần nhất. Người thực hiện và đối tượng được nhận diện bằng UUID.</p><div className="mt-4 space-y-3">{audit.map((entry) => <details key={entry.id} className="rounded-lg border p-4"><summary className="cursor-pointer text-sm">{new Date(entry.created_at).toISOString()} · {entry.action}</summary><p className="mt-3 break-all text-sm">Người thực hiện: {entry.actor_id ?? "Database operator (bootstrap)"}<br />Đối tượng: {entry.target_id}</p><pre className="mt-3 whitespace-pre-wrap break-all text-xs">{JSON.stringify(entry.details, null, 2)}</pre></details>)}</div></section>
  </div>;
}
