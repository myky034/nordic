"use client";
import { useActionState } from "react";
import { saveRole, assignRole } from "./actions";
import type { RoleRow } from "@/lib/rbac/access";
import type { ActionState } from "@/lib/rbac/messages";
import { permissionGroups, permissionLabels } from "@/lib/rbac/labels";
import { Field, FormMessage } from "@/components/ui";
import { buttonDestructive, buttonPrimary, control } from "@/components/ui/styles";

type Permission = { key: string; description: string };

/**
 * Role editor for the right pane. Permissions are grouped by area with their
 * Vietnamese names (lib/rbac/labels.ts) and the key in small type, so an
 * administrator reads "Duyệt đề xuất" instead of `facts.review` but can still
 * match the key. A permission the editor does not hold is disabled: the
 * database refuses to grant it anyway (save_access_role). The save bar sticks
 * to the bottom of the window.
 */
export function RoleForm({ role, permissions, own }: { role?: RoleRow; permissions: Permission[]; own: string[] }) {
  const [state, action, pending] = useActionState(saveRole, {});
  const manageable = !role || role.role_permissions.every((p) => own.includes(p.permission_key));
  const known = new Set(permissionGroups.flatMap((g) => g.keys as string[]));
  const groups = [
    ...permissionGroups.map((g) => ({ title: g.title, items: permissions.filter((p) => (g.keys as string[]).includes(p.key)) })),
    { title: "Khác", items: permissions.filter((p) => !known.has(p.key)) },
  ].filter((g) => g.items.length);
  const checked = (key: string) => role?.role_permissions.some((v) => v.permission_key === key);
  return <form action={action}>
    <input type="hidden" name="id" value={role?.id ?? ""} />
    <fieldset disabled={pending || !manageable} className="space-y-4 disabled:opacity-60">
      <section className="grid gap-5 rounded-2xl bg-surface p-5 ring-1 ring-hairline sm:grid-cols-2 sm:p-6">
        <Field label="Tên vai trò"><input className={control} name="name" required maxLength={80} defaultValue={role?.name} /></Field>
        <Field label="Mô tả" hint="Vai trò này dành cho ai, làm việc gì."><input className={control} name="description" maxLength={300} defaultValue={role?.description ?? ""} /></Field>
      </section>
      {groups.map((g) => <section key={g.title} className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
        <h3 className="px-5 pb-2 pt-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">{g.title}</h3>
        <div className="[&>label+label]:border-t [&>label+label]:border-hairline">
          {g.items.map((p) => <label key={p.key} className={`flex items-start gap-3 px-5 py-3 ${own.includes(p.key) ? "cursor-pointer hover:bg-fill/40" : "opacity-60"}`}>
            <input type="checkbox" name="permissions" value={p.key} disabled={!own.includes(p.key)} defaultChecked={checked(p.key)} className="mt-1 h-4 w-4 accent-accent" />
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-ink">{permissionLabels[p.key as keyof typeof permissionLabels] ?? p.key}</span>
              <span className="block font-mono text-[12px] text-ink-3">{p.key}{!own.includes(p.key) && " · bạn không có quyền này nên không cấp được"}</span>
            </span>
          </label>)}
        </div>
      </section>)}
    </fieldset>
    {!manageable && <p className="mt-3 text-[15px] text-ink-2">Vai trò này có quyền mà bạn không có, nên bạn không sửa được.</p>}
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap items-center gap-3 border-t border-hairline bg-canvas/90 px-1 py-3 backdrop-blur">
      <button disabled={pending || !manageable} className={buttonPrimary}>{pending ? "Đang lưu…" : role ? "Lưu vai trò" : "Tạo vai trò"}</button>
      <div className="min-w-0 flex-1"><FormMessage error={state.error} message={state.message} /></div>
    </div>
  </form>;
}

/** One assigned role with its own "Gỡ" button (a separate form, so each removal is explicit). */
function AssignedRole({ user, role, canRemove }: { user: string; role: RoleRow; canRemove: boolean }) {
  const [state, action, pending] = useActionState(assignRole, {} as ActionState);
  return <li className="px-5 py-3">
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="user" value={user} /><input type="hidden" name="role" value={role.id} /><input type="hidden" name="grant" value="no" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{role.name}</span>
        <span className="block text-[13px] text-ink-3">{role.role_permissions.length} quyền{role.description ? ` · ${role.description}` : ""}</span>
      </span>
      {canRemove && <button disabled={pending} className={`${buttonDestructive} px-3.5 py-1.5 text-[13px]`}>{pending ? "Đang gỡ…" : "Gỡ"}</button>}
    </form>
    {(state.error || state.message) && <div className="mt-2"><FormMessage error={state.error} message={state.message} /></div>}
  </li>;
}

/**
 * The selected user's roles: each assigned role with "Gỡ", then "Thêm vai
 * trò" listing only roles the user does not have and the editor may grant.
 * Replaces one role select plus a "Gán / Gỡ" select, which was easy to misread.
 * Your own roles cannot be changed here (the database refuses it too).
 */
export function UserRoles({ user, roles, current, own, self }: { user: string; roles: RoleRow[]; current: string[]; own: string[]; self: boolean }) {
  const [state, action, pending] = useActionState(assignRole, {} as ActionState);
  const grantable = (r: RoleRow) => r.role_permissions.every((p) => own.includes(p.permission_key));
  const assigned = roles.filter((r) => current.includes(r.id));
  const addable = roles.filter((r) => !current.includes(r.id) && grantable(r));
  return <div className="space-y-4">
    <section className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
      <h3 className="px-5 pb-2 pt-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">Vai trò hiện có</h3>
      {assigned.length ? <ul className="[&>li+li]:border-t [&>li+li]:border-hairline">
        {assigned.map((r) => <AssignedRole key={r.id} user={user} role={r} canRemove={!self && grantable(r)} />)}
      </ul> : <p className="px-5 pb-4 text-[15px] text-ink-2">Chưa có vai trò nào: người này chỉ dùng được phần công khai và không gian cá nhân.</p>}
    </section>
    {self ? <p className="px-1 text-[15px] text-ink-2">Đây là tài khoản của bạn. Cần một quản trị viên khác để thay đổi vai trò của bạn.</p>
      : <form action={action} className="rounded-2xl bg-surface p-5 ring-1 ring-hairline">
        <input type="hidden" name="user" value={user} /><input type="hidden" name="grant" value="yes" />
        <p className="text-[15px] font-semibold text-ink">Thêm vai trò</p>
        {addable.length ? <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor={`add-role-${user}`}>Vai trò</label>
          <select id={`add-role-${user}`} name="role" required defaultValue="" className={`${control} mt-0 w-auto min-w-56`}>
            <option value="" disabled>Chọn vai trò</option>
            {addable.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.role_permissions.length} quyền)</option>)}
          </select>
          <button disabled={pending} className={buttonPrimary}>{pending ? "Đang thêm…" : "Thêm"}</button>
        </div> : <p className="mt-1 text-[15px] text-ink-2">Không còn vai trò nào bạn có thể thêm cho người này.</p>}
        <div className="mt-3"><FormMessage error={state.error} message={state.message} /></div>
      </form>}
  </div>;
}
