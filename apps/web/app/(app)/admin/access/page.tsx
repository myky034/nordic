import Link from "next/link";
import { accessContext, logAccessError, type RoleRow, type UserRow, type AuditRow } from "@/lib/rbac/access";
import { auditActionLabel } from "@/lib/rbac/labels";
import { uuidPattern } from "@/lib/documents/domain";
import { decisionTime } from "@/lib/review/history";
import { withParams } from "@/lib/pagination";
import { nextDir, readSort, sortRows } from "@/lib/table";
import { Badge, NoAccess, PageHeader, Segmented } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { Inspector } from "@/components/ui/inspector";
import { buttonPrimary, control } from "@/components/ui/styles";
import { RoleForm, UserRoles } from "./forms";
import { EffectivePermissions } from "./effective-permissions";

// Three tabs (?tab=users|roles|audit), each a sortable table (Numbers-style,
// components/ui/data-table.tsx). Clicking a row opens the item in a slide-over
// Inspector (?user= / ?role= / ?entry=, or ?new=1 for a new role), so the
// table keeps its place and Esc closes the panel.
export default async function AccessPage({ searchParams }: PageProps<"/admin/access">) {
  const context = await accessContext();
  const manage = context.permissions.includes("roles.manage");
  const assign = context.permissions.includes("users.assign_roles");
  if (!manage && !assign) return <NoAccess title="Không có quyền quản lý phân quyền">Nếu hệ thống chưa có quản trị viên, người vận hành cần chạy lệnh bootstrap một lần. Việc đăng nhập không tự cấp quyền quản trị.</NoAccess>;
  const params = await searchParams;
  const tabs = [...(assign ? [["users", "Người dùng"]] : []), ...(manage ? [["roles", "Vai trò"]] : []), ["audit", "Nhật ký"]] as [string, string][];
  const tab = typeof params.tab === "string" && tabs.some(([v]) => v === params.tab) ? params.tab : tabs[0][0];
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const offset = typeof params.offset === "string" && /^\d{1,5}$/.test(params.offset) ? Math.min(10000, Number(params.offset)) : 0;
  const results = await Promise.all([
    context.client.from("roles").select("id,name,description,role_permissions(permission_key)").order("name"),
    context.client.from("permissions").select("key,description").order("key"),
    context.client.from("access_audit").select("id,actor_id,action,target_id,details,created_at").order("created_at", { ascending: false }).limit(50),
    assign ? context.client.rpc("search_access_users", { p_query: query, p_offset: offset }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (results.some((r) => r.error)) { logAccessError("access_screen"); throw new Error("Không tải được cấu hình phân quyền."); }
  const roles = results[0].data as RoleRow[];
  const permissions = results[1].data as { key: string; description: string }[];
  const audit = results[2].data as AuditRow[];
  const users = results[3].data as UserRow[];
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const email = new Map(users.map((u) => [u.user_id, u.email]));
  const tabHref = (v: string) => withParams("/admin/access", {}, { tab: v === tabs[0][0] ? null : v });
  const here = (change: Record<string, string | null>) => withParams("/admin/access", params, change);
  const uuidParam = (k: string) => typeof params[k] === "string" && uuidPattern.test(params[k] as string) ? params[k] as string : undefined;
  const sortHeader = (sort: { key: string; dir: "asc" | "desc" }, key: string, label: string, className?: string) =>
    ({ label, className, sorted: sort.key === key ? sort.dir : null, sortHref: here({ sort: key, dir: nextDir(sort, key) }) });

  let body: React.ReactNode;
  let panel: React.ReactNode = null;
  if (tab === "users") {
    // Rows come 20 at a time from search_access_users (oldest account first);
    // sorting would only reorder one page, so this table is not sortable.
    const permsOf = (u: UserRow) => new Set(u.role_ids.flatMap((id) => roleById.get(id)?.role_permissions.map((p) => p.permission_key) ?? [])).size;
    const open = users.find((u) => u.user_id === uuidParam("user"));
    body = <>
      <form className="mb-4 flex max-w-md gap-3"><input type="hidden" name="tab" value="users" /><label className="sr-only" htmlFor="user-search">Tìm theo email</label>
        <input id="user-search" name="q" placeholder="Tìm theo email" defaultValue={query} maxLength={200} className={`${control} mt-0`} /><button className={buttonPrimary}>Tìm</button></form>
      <DataTable label="Người dùng" minWidth="36rem" columns={[{ label: "Email" }, { label: "Vai trò" }, { label: "Số quyền", className: "text-right" }]}
        empty={!users.length && <p className="p-5 text-[15px] text-ink-2">Không tìm thấy người dùng{query ? ` với “${query}”` : ""}.</p>}>
        {users.map((u) => <DataRow key={u.user_id} href={here({ user: u.user_id })} selected={u.user_id === open?.user_id}
          title={<>{u.email ?? "Chưa có email"}{u.user_id === context.userId && <span className="ml-2 text-[13px] font-normal text-ink-3">(bạn)</span>}</>}>
          <Cell><span className="flex flex-wrap gap-1.5">{u.role_ids.length ? u.role_ids.map((id) => <Badge key={id}>{roleById.get(id)?.name ?? "Vai trò không xác định"}</Badge>) : <Badge tone="caution">Chưa có vai trò</Badge>}</span></Cell>
          <Cell className="text-right tabular-nums">{permsOf(u)}</Cell>
        </DataRow>)}
      </DataTable>
      <div className="mt-3 flex items-center justify-between px-1 text-[13px]">
        <span className="text-ink-3">{users.length ? `${offset + 1}–${offset + users.length}` : "0"}</span>
        <span className="flex gap-4">
          {offset > 0 && <Link scroll={false} className="text-accent" href={here({ offset: String(Math.max(0, offset - 20)), user: null })}>‹ Trang trước</Link>}
          {users.length === 20 && offset < 10000 && <Link scroll={false} className="text-accent" href={here({ offset: String(offset + 20), user: null })}>Trang sau ›</Link>}
        </span>
      </div>
    </>;
    if (open) panel = <Inspector title={open.email ?? "Chưa có email"} subtitle={<span className="font-mono">{open.user_id}</span>} closeHref={here({ user: null })}>
      <UserRoles user={open.user_id} roles={roles} current={open.role_ids} own={context.permissions} self={open.user_id === context.userId} />
      <EffectivePermissions roles={roles} roleIds={open.role_ids} />
    </Inspector>;
  } else if (tab === "roles") {
    const sort = readSort(["name", "permissions"] as const, params.sort, params.dir, "name");
    const rows = sortRows(roles, (r) => (sort.key === "name" ? r.name : r.role_permissions.length), sort.dir);
    const open = roles.find((r) => r.id === uuidParam("role"));
    body = <>
      <div className="mb-4 flex justify-end"><Link scroll={false} href={here({ new: "1", role: null })} className={buttonPrimary}>Tạo vai trò mới</Link></div>
      <DataTable label="Vai trò" minWidth="36rem" columns={[sortHeader(sort, "name", "Tên vai trò"), { label: "Mô tả" }, sortHeader(sort, "permissions", "Số quyền", "text-right")]}>
        {rows.map((r) => <DataRow key={r.id} href={here({ role: r.id, new: null })} selected={r.id === open?.id} title={r.name}>
          <Cell>{r.description || <span className="text-ink-3">—</span>}</Cell>
          <Cell className="text-right tabular-nums">{r.role_permissions.length}</Cell>
        </DataRow>)}
      </DataTable>
    </>;
    if (params.new === "1") panel = <Inspector title="Tạo vai trò mới" closeHref={here({ new: null })}><RoleForm permissions={permissions} own={context.permissions} /></Inspector>;
    else if (open) panel = <Inspector title={open.name} subtitle={`${open.role_permissions.length} quyền`} closeHref={here({ role: null })}><RoleForm role={open} permissions={permissions} own={context.permissions} /></Inspector>;
  } else {
    // Names instead of UUIDs where this page already knows them.
    const who = (id: string | null) => id === null ? "Người vận hành database (bootstrap)" : id === context.userId ? "Bạn" : email.get(id) ?? id;
    const what = (id: string | null) => id === null ? "—" : roleById.get(id)?.name ?? email.get(id) ?? (id === context.userId ? "Bạn" : id);
    const sort = readSort(["time", "action", "actor"] as const, params.sort, params.dir, "time", "desc");
    const rows = sortRows(audit, (e) => sort.key === "time" ? e.created_at : sort.key === "action" ? auditActionLabel(e.action) : who(e.actor_id), sort.dir);
    const open = audit.find((e) => e.id === uuidParam("entry"));
    body = <DataTable label="Nhật ký thay đổi" minWidth="44rem" columns={[sortHeader(sort, "time", "Thời gian (UTC)"), sortHeader(sort, "action", "Thao tác"), sortHeader(sort, "actor", "Người thực hiện"), { label: "Đối tượng" }]}
      empty={!audit.length && <p className="p-5 text-[15px] text-ink-2">Chưa có thay đổi nào.</p>}>
      {rows.map((e) => <DataRow key={e.id} href={here({ entry: e.id })} selected={e.id === open?.id} title={<span className="tabular-nums">{decisionTime(e.created_at).replace(" UTC", "")}</span>}>
        <Cell className="text-ink">{auditActionLabel(e.action)}</Cell>
        <Cell className="max-w-56 truncate">{who(e.actor_id)}</Cell>
        <Cell className="max-w-56 truncate">{what(e.target_id)}</Cell>
      </DataRow>)}
    </DataTable>;
    if (open) panel = <Inspector title={auditActionLabel(open.action)} subtitle={decisionTime(open.created_at)} closeHref={here({ entry: null })}>
      <dl className="space-y-3 text-[15px]">
        <div><dt className="text-[13px] text-ink-3">Người thực hiện</dt><dd className="break-all text-ink">{who(open.actor_id)}</dd></div>
        <div><dt className="text-[13px] text-ink-3">Đối tượng</dt><dd className="break-all text-ink">{what(open.target_id)}</dd></div>
      </dl>
      <p className="mb-2 mt-5 text-[13px] font-semibold text-ink-2">Chi tiết kỹ thuật</p>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-fill/50 p-3 font-mono text-[12px] text-ink">{JSON.stringify({ action: open.action, actor_id: open.actor_id, target_id: open.target_id, details: open.details }, null, 2)}</pre>
    </Inspector>;
  }

  return <>
    <PageHeader eyebrow="Quản trị" title="Người dùng & phân quyền"
      description="Vai trò là một nhóm quyền; gán vai trò cho người dùng để họ đề xuất, duyệt hoặc quản trị. Thay đổi có hiệu lực ở lần tải trang kế tiếp của người đó và được ghi nhật ký." />
    <Segmented label="Phần" items={tabs.map(([v, l]) => ({ href: tabHref(v), label: l, active: tab === v }))} />
    <div className="mt-1">{body}</div>
    {panel}
  </>;
}
