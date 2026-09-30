import Link from "next/link";
import { accessContext, logAccessError, type RoleRow, type UserRow, type AuditRow } from "@/lib/rbac/access";
import { auditActionLabel } from "@/lib/rbac/labels";
import { uuidPattern } from "@/lib/documents/domain";
import { selectItem } from "@/lib/review/selection";
import { decisionTime } from "@/lib/review/history";
import { withParams } from "@/lib/pagination";
import { Badge, Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Segmented } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
import { SplitList, SplitRow, SplitView } from "@/components/review/split-view";
import { RoleForm, UserRoles } from "./forms";

// Three tabs (?tab=users|roles|audit), each on one screen: users and roles use
// the split view (components/review/split-view.tsx) like /admin/sources, so
// the list stays in view while one user or role is edited on the right.
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
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const email = new Map(users.map((u) => [u.user_id, u.email]));
  const tabHref = (v: string) => withParams("/admin/access", {}, { tab: v === tabs[0][0] ? null : v });
  const uuidParam = (k: string) => typeof params[k] === "string" && uuidPattern.test(params[k] as string) ? params[k] as string : undefined;

  let body: React.ReactNode;
  if (tab === "users") {
    const requested = uuidParam("user");
    const sel = selectItem(users.map((u) => u.user_id), requested);
    const current = sel.index >= 0 ? users[sel.index] : null;
    const pager = <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-ink-3">{users.length ? `${offset + 1}–${offset + users.length}` : "0"}</span>
      <span className="flex gap-3">
        {offset > 0 && <Link scroll={false} className="text-accent" href={withParams("/admin/access", params, { offset: String(Math.max(0, offset - 20)), user: null })}>‹ Trước</Link>}
        {users.length === 20 && offset < 10000 && <Link scroll={false} className="text-accent" href={withParams("/admin/access", params, { offset: String(offset + 20), user: null })}>Sau ›</Link>}
      </span>
    </div>;
    body = <>
      <form className="mb-5 flex max-w-md gap-3"><input type="hidden" name="tab" value="users" /><label className="sr-only" htmlFor="user-search">Tìm theo email</label>
        <input id="user-search" name="q" placeholder="Tìm theo email" defaultValue={query} maxLength={200} className={`${control} mt-0`} /><button className={buttonPrimary}>Tìm</button></form>
      {users.length ? <SplitView paneScroll={false} detailKey={current?.user_id} detailOnMobile={!!requested} backHref={withParams("/admin/access", params, { user: null })}
        list={<SplitList label="Người dùng" footer={pager}>{users.map((u) => {
          const names = u.role_ids.map((id) => roleName.get(id)).filter(Boolean) as string[];
          return <SplitRow key={u.user_id} href={withParams("/admin/access", params, { user: u.user_id })} selected={u.user_id === current?.user_id} explicit={!!requested}
            title={u.email ?? "Chưa có email"} subtitle={u.user_id === context.userId ? "Tài khoản của bạn" : undefined}
            badges={names.length ? <>{names.map((n) => <Badge key={n}>{n}</Badge>)}</> : <Badge tone="caution">Chưa có vai trò</Badge>} />;
        })}</SplitList>}
        detail={current && <>
          <div className="mb-4 px-1">
            <h2 className="break-all text-[22px] font-semibold tracking-[-0.015em] text-ink">{current.email ?? "Chưa có email"}</h2>
            <p className="mt-1 break-all font-mono text-[12px] text-ink-3">{current.user_id}</p>
          </div>
          <UserRoles user={current.user_id} roles={roles} current={current.role_ids} own={context.permissions} self={current.user_id === context.userId} />
        </>} />
        : <EmptyState>Không tìm thấy người dùng{query ? ` với “${query}”` : ""}.</EmptyState>}
    </>;
  } else if (tab === "roles") {
    const creating = params.new === "1";
    const requested = uuidParam("role");
    const sel = selectItem(roles.map((r) => r.id), requested);
    const current = creating ? null : sel.index >= 0 ? roles[sel.index] : null;
    body = <SplitView paneScroll={false} detailKey={creating ? "new" : current?.id} detailOnMobile={creating || !!requested} backHref={withParams("/admin/access", params, { role: null, new: null })}
      list={<SplitList label="Vai trò" footer={<Link scroll={false} href={withParams("/admin/access", params, { new: "1", role: null })} className="text-[15px] font-medium text-accent">+ Tạo vai trò mới</Link>}>
        {roles.map((r) => <SplitRow key={r.id} href={withParams("/admin/access", params, { role: r.id, new: null })} selected={r.id === current?.id} explicit={!!requested}
          title={r.name} subtitle={r.description || undefined} badges={<Badge>{r.role_permissions.length} quyền</Badge>} />)}
      </SplitList>}
      detail={creating ? <><h2 className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">Tạo vai trò mới</h2><RoleForm permissions={permissions} own={context.permissions} /></>
        : current && <><h2 className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">{current.name}</h2><RoleForm role={current} permissions={permissions} own={context.permissions} /></>} />;
  } else {
    // Names instead of UUIDs where this page already knows them.
    const who = (id: string | null) => id === null ? "Người vận hành database (bootstrap)" : id === context.userId ? "Bạn" : email.get(id) ?? id;
    const what = (id: string | null) => id === null ? "—" : roleName.get(id) ?? email.get(id) ?? (id === context.userId ? "Bạn" : id);
    body = audit.length ? <List label="Nhật ký thay đổi">{audit.map((e) => <ListRow key={e.id} title={auditActionLabel(e.action)}
      subtitle={`${who(e.actor_id)} → ${what(e.target_id)}`} meta={decisionTime(e.created_at)}>
      <Disclosure small summary="Chi tiết kỹ thuật"><pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl bg-fill/50 p-3 font-mono text-[12px] text-ink">{JSON.stringify({ action: e.action, actor_id: e.actor_id, target_id: e.target_id, details: e.details }, null, 2)}</pre></Disclosure>
    </ListRow>)}</List> : <EmptyState>Chưa có thay đổi nào.</EmptyState>;
  }

  return <>
    <PageHeader eyebrow="Quản trị" title="Người dùng & phân quyền"
      description="Vai trò là một nhóm quyền; gán vai trò cho người dùng để họ đề xuất, duyệt hoặc quản trị. Thay đổi có hiệu lực ở lần tải trang kế tiếp của người đó và được ghi nhật ký." />
    <Segmented label="Phần" items={tabs.map(([v, l]) => ({ href: tabHref(v), label: l, active: tab === v }))} />
    <div className="mt-1">{body}</div>
  </>;
}
