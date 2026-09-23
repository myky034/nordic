import Link from "next/link";
import { accessContext, logAccessError, type RoleRow, type UserRow, type AuditRow } from "@/lib/rbac/access";
import { RoleForm, AssignmentForm } from "./forms";
import { Badge, Card, Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Section } from "@/components/ui";
import { buttonSecondary, control, textLink } from "@/components/ui/styles";

export default async function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  const context = await accessContext();
  const manage = context.permissions.includes("roles.manage");
  const assign = context.permissions.includes("users.assign_roles");
  if (!manage && !assign) return <NoAccess title="Không có quyền quản lý phân quyền">Nếu hệ thống chưa có quản trị viên, người vận hành cần chạy lệnh bootstrap một lần. Việc đăng nhập không tự cấp quyền quản trị.</NoAccess>;
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
  return <>
    <PageHeader eyebrow="Quản trị" title="Người dùng & phân quyền" description="Cấu hình vai trò và quyền tại đây. Thay đổi có hiệu lực ở yêu cầu tiếp theo và được ghi nhật ký." />
    {manage && <Section title="Vai trò">
      <List>{roles.map((role) => <ListRow key={JSON.stringify(role)} title={role.name}
        badges={<Badge>{role.role_permissions.length} quyền</Badge>} subtitle={role.description || undefined}>
        <Disclosure small summary="Chỉnh sửa"><RoleForm role={role} permissions={permissions} own={context.permissions} /></Disclosure>
      </ListRow>)}</List>
      <div className="mt-4 px-1"><Disclosure summary="Tạo vai trò mới"><Card><RoleForm permissions={permissions} own={context.permissions} /></Card></Disclosure></div>
    </Section>}
    {assign && <Section title="Người dùng">
      <form className="mb-4 flex gap-3"><label className="sr-only" htmlFor="user-search">Tìm theo email</label><input id="user-search" name="q" placeholder="Tìm theo email" defaultValue={query} maxLength={200} className={`${control} mt-0 max-w-md`} /><button className={buttonSecondary}>Tìm</button></form>
      {users.length ? <List>{users.map((user) => <ListRow key={user.user_id} title={user.email ?? "Email chưa có"} meta={<span className="break-all font-mono">{user.user_id}</span>}>
        <AssignmentForm user={user.user_id} roles={roles} current={user.role_ids} own={context.permissions} self={user.user_id === context.userId} />
      </ListRow>)}</List> : <EmptyState>Không tìm thấy người dùng.</EmptyState>}
      <div className="mt-4 flex gap-6 px-1 text-[15px]">{offset>0 && <Link className={textLink} href={`/admin/access?q=${encodeURIComponent(query)}&offset=${Math.max(0, offset-20)}`}>Trang trước</Link>}{users.length===20 && offset<10000 && <Link className={textLink} href={`/admin/access?q=${encodeURIComponent(query)}&offset=${offset+20}`}>Trang sau</Link>}</div>
    </Section>}
    <Section>
      <Disclosure summary="Nhật ký thay đổi (50 thao tác gần nhất)">
      <p className="mb-3 px-1 text-[15px] text-ink-2">Người thực hiện và đối tượng được nhận diện bằng UUID.</p>
      {audit.length ? <List>{audit.map((entry) => <ListRow key={entry.id} title={entry.action} meta={new Date(entry.created_at).toISOString().replace("T", " ").slice(0, 19)}>
        <Disclosure small summary="Chi tiết"><p className="break-all text-[13px] text-ink-2">Người thực hiện: {entry.actor_id ?? "Database operator (bootstrap)"}<br />Đối tượng: {entry.target_id}</p><pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-fill/50 p-3 font-mono text-[12px] text-ink">{JSON.stringify(entry.details, null, 2)}</pre></Disclosure>
      </ListRow>)}</List> : <EmptyState>Chưa có thay đổi nào.</EmptyState>}
      </Disclosure>
    </Section>
  </>;
}
