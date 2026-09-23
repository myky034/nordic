"use client";
import { useActionState } from "react";
import { saveRole, assignRole } from "./actions";
import type { RoleRow } from "@/lib/rbac/access";
import type { ActionState } from "@/lib/rbac/messages";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSmall, control } from "@/components/ui/styles";
function Result({ state }: { state: ActionState }) {
  return <FormMessage error={state.error} message={state.message} />;
}
export function RoleForm({ role, permissions, own }: { role?: RoleRow; permissions: { key: string; description: string }[]; own: string[] }) {
  const [state, action, pending] = useActionState(saveRole, {});
  const manageable = !role || role.role_permissions.every((p) => own.includes(p.permission_key));
  return <form action={action} className="space-y-5">
    {!role && <h3 className="text-[17px] font-semibold">Tạo vai trò</h3>}
    <input type="hidden" name="id" value={role?.id ?? ""} />
    <fieldset disabled={pending || !manageable} className="space-y-5 disabled:opacity-60">
      <div className="grid gap-5 sm:grid-cols-2"><Field label="Tên vai trò"><input className={control} name="name" required maxLength={80} defaultValue={role?.name} /></Field>
      <Field label="Mô tả"><input className={control} name="description" maxLength={300} defaultValue={role?.description ?? ""} /></Field></div>
      <div className="overflow-hidden rounded-xl ring-1 ring-hairline [&>label+label]:border-t [&>label+label]:border-hairline">{permissions.map((p) => <label key={p.key} className="flex items-start gap-3 bg-surface px-4 py-3 text-[15px]"><input type="checkbox" name="permissions" value={p.key} disabled={!own.includes(p.key)} defaultChecked={role?.role_permissions.some((v) => v.permission_key === p.key)} className="mt-1 h-4 w-4 accent-[var(--accent)]" /><span><span className="font-medium font-mono text-[13px]">{p.key}</span><span className="block text-ink-2">{p.description}</span></span></label>)}</div>
      <button className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu vai trò"}</button>
    </fieldset>
    {!manageable && <p className="text-[15px] text-ink-2">Vai trò này chứa quyền ngoài phạm vi của bạn.</p>}
    <Result state={state} />
  </form>;
}
export function AssignmentForm({ user, roles, own, current, self }: { user: string; roles: RoleRow[]; own: string[]; current: string[]; self: boolean }) {
  const [state, action, pending] = useActionState(assignRole, {});
  const allowed = roles.filter((r) => r.role_permissions.every((p) => own.includes(p.permission_key)));
  return <form action={action} className="mt-3 space-y-3">
    <input type="hidden" name="user" value={user} />
    <p className="text-[13px] text-ink-3">Vai trò: {roles.filter((r) => current.includes(r.id)).map((r) => r.name).join(", ") || "Chưa được gán"}</p>
    {self ? <p className="text-[15px] text-ink-2">Đây là tài khoản của bạn. Cần quản trị viên khác để thay đổi vai trò.</p> : <fieldset disabled={pending || !allowed.length} className="flex flex-wrap items-center gap-3 disabled:opacity-50">
      <label className="sr-only" htmlFor={`role-${user}`}>Vai trò</label><select id={`role-${user}`} name="role" className={`${control} mt-0 w-auto`}>{allowed.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      <label className="sr-only" htmlFor={`grant-${user}`}>Thao tác</label><select id={`grant-${user}`} name="grant" className={`${control} mt-0 w-auto`}><option value="yes">Gán vai trò</option><option value="no">Gỡ vai trò</option></select>
      <button className={buttonSmall}>{pending ? "Đang cập nhật…" : "Áp dụng"}</button>
    </fieldset>}
    <Result state={state} />
  </form>;
}
