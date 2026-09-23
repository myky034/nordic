"use client";
import { useActionState } from "react";
import { saveRole, assignRole } from "./actions";
import type { RoleRow } from "@/lib/rbac/access";
import type { ActionState } from "@/lib/rbac/messages";
const input = "mt-2 w-full rounded-lg border border-zinc-300 bg-transparent p-3 dark:border-zinc-700";
function Result({ state }: { state: ActionState }) {
  return <>{state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}{state.message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{state.message}</p>}</>;
}
export function RoleForm({ role, permissions, own }: { role?: RoleRow; permissions: { key: string; description: string }[]; own: string[] }) {
  const [state, action, pending] = useActionState(saveRole, {});
  const manageable = !role || role.role_permissions.every((p) => own.includes(p.permission_key));
  return <form action={action} className="space-y-4 rounded-2xl border p-5">
    <h3 className="text-lg font-medium">{role ? role.name : "Tạo vai trò"}</h3>
    <input type="hidden" name="id" value={role?.id ?? ""} />
    <fieldset disabled={pending || !manageable} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm">Tên vai trò<input className={input} name="name" required maxLength={80} defaultValue={role?.name} /></label>
      <label className="block text-sm">Mô tả<input className={input} name="description" maxLength={300} defaultValue={role?.description ?? ""} /></label>
      <div className="space-y-3">{permissions.map((p) => <label key={p.key} className="flex items-start gap-3 text-sm"><input type="checkbox" name="permissions" value={p.key} disabled={!own.includes(p.key)} defaultChecked={role?.role_permissions.some((v) => v.permission_key === p.key)} className="mt-1" /><span><span className="font-medium">{p.key}</span><span className="block text-zinc-500">{p.description}</span></span></label>)}</div>
      <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">{pending ? "Đang lưu…" : "Lưu vai trò"}</button>
    </fieldset>
    {!manageable && <p className="text-sm text-zinc-500">Vai trò này chứa quyền ngoài phạm vi của bạn.</p>}
    <Result state={state} />
  </form>;
}
export function AssignmentForm({ user, roles, own, current, self }: { user: string; roles: RoleRow[]; own: string[]; current: string[]; self: boolean }) {
  const [state, action, pending] = useActionState(assignRole, {});
  const allowed = roles.filter((r) => r.role_permissions.every((p) => own.includes(p.permission_key)));
  return <form action={action} className="mt-3 space-y-3">
    <input type="hidden" name="user" value={user} />
    <p className="text-sm text-zinc-500">Vai trò: {roles.filter((r) => current.includes(r.id)).map((r) => r.name).join(", ") || "Chưa được gán"}</p>
    {self ? <p className="text-sm">Đây là tài khoản của bạn. Cần quản trị viên khác để thay đổi vai trò.</p> : <fieldset disabled={pending || !allowed.length} className="flex flex-wrap gap-3 disabled:opacity-50">
      <label className="sr-only" htmlFor={`role-${user}`}>Vai trò</label><select id={`role-${user}`} name="role" className="rounded-lg border bg-background p-2">{allowed.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <label className="sr-only" htmlFor={`grant-${user}`}>Thao tác</label><select id={`grant-${user}`} name="grant" className="rounded-lg border bg-background p-2"><option value="yes">Gán vai trò</option><option value="no">Gỡ vai trò</option></select>
      <button className="rounded-lg border px-4 py-2">{pending ? "Đang cập nhật…" : "Áp dụng"}</button>
    </fieldset>}
    <Result state={state} />
  </form>;
}
