"use client";
import { useActionState } from "react";
import {
  deleteMyWorkspace, deleteNote, deleteProject, fileSavedItem, removeSavedItem, saveNote, savePlan, saveProject, setProjectStatus,
} from "./actions";
import { applicationStatuses, budgetPeriods, DELETE_CONFIRMATION, targetDegrees, type ItemKind, type WorkspaceState } from "@/lib/workspace/domain";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSecondary, buttonSmall, control } from "@/components/ui/styles";

type Option = { id: string; label: string };
const Msg = ({ s }: { s: WorkspaceState }) => <FormMessage error={s.error} message={s.message} />;

function CountryPicker({ countries, selected }: { countries: Option[]; selected: string[] }) {
  return <fieldset><legend className="text-[13px] font-medium text-ink-2">Quốc gia mục tiêu</legend>
    <div className="mt-2 flex flex-wrap gap-2">{countries.map((c) => <label key={c.id}
      className="inline-flex cursor-pointer items-center rounded-full bg-fill px-3.5 py-1.5 text-[14px] has-[:checked]:bg-accent has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50">
      <input type="checkbox" name="countries" value={c.id} defaultChecked={selected.includes(c.id)} className="sr-only" />{c.label}</label>)}</div>
  </fieldset>;
}

export function ProjectForm({ countries, project }: { countries: Option[]; project?: { id: string; name: string; description: string | null; target_year: number | null; target_role: string | null; countries: string[] } }) {
  const [s, action, pending] = useActionState(saveProject, {});
  return <form action={action} className="space-y-5">
    {project && <input type="hidden" name="id" value={project.id} />}
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Tên project" hint="Ví dụ: Sweden 2028"><input name="name" required maxLength={120} defaultValue={project?.name} className={control} /></Field>
      <Field label="Năm mục tiêu"><input name="targetYear" inputMode="numeric" maxLength={4} placeholder="2028" defaultValue={project?.target_year ?? ""} className={control} /></Field>
      <Field label="Vai trò / mục tiêu nghề nghiệp" className="sm:col-span-2"><input name="targetRole" maxLength={120} placeholder="Ví dụ: Software Engineer" defaultValue={project?.target_role ?? ""} className={control} /></Field>
    </div>
    <CountryPicker countries={countries} selected={project?.countries ?? []} />
    <Field label="Mô tả (tùy chọn)"><textarea name="description" maxLength={2000} rows={2} defaultValue={project?.description ?? ""} className={control} /></Field>
    <Msg s={s} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : project ? "Lưu thay đổi" : "Tạo project"}</button>
  </form>;
}

export function ProjectStatusButton({ id, status }: { id: string; status: string }) {
  const [s, action, pending] = useActionState(setProjectStatus, {});
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status === "active" ? "archived" : "active"} />
    <button disabled={pending} className={buttonSmall}>{status === "active" ? "Lưu trữ" : "Mở lại"}</button>
    {s.error && <span role="alert" className="text-[12px] text-critical">{s.error}</span>}
  </form>;
}

export function DeleteProjectForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(deleteProject, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="id" value={id} />
    <p className="text-[15px] text-ink-2">Xóa project cùng các ghi chú trong project. Các mục đã lưu vẫn còn, chỉ được bỏ khỏi project. Không hoàn tác được.</p>
    <Field label={`Gõ ${DELETE_CONFIRMATION} để xác nhận`}><input name="confirm" autoComplete="off" className={`${control} max-w-40`} /></Field>
    <Msg s={s} />
    <button disabled={pending} className="rounded-full bg-critical px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-50">Xóa project</button>
  </form>;
}

// Changing the select submits immediately: one tap to file a bookmark.
export function FileSavedSelect({ id, current, projects }: { id: string; current: string | null; projects: Option[] }) {
  const [s, action] = useActionState(fileSavedItem, {});
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="id" value={id} />
    <label className="sr-only" htmlFor={`file-${id}`}>Project</label>
    <select id={`file-${id}`} name="project" defaultValue={current ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={`${control} mt-0 w-auto py-1.5 text-[13px]`}>
      <option value="">Chưa gắn project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
    {s.error && <span role="alert" className="text-[12px] text-critical">{s.error}</span>}
  </form>;
}

export function RemoveSavedButton({ id }: { id: string }) {
  const [s, action, pending] = useActionState(removeSavedItem, {});
  return <form action={action}><input type="hidden" name="id" value={id} />
    <button disabled={pending} className="text-[13px] text-critical hover:underline">Bỏ lưu</button>
    {s.error && <span role="alert" className="ml-2 text-[12px] text-critical">{s.error}</span>}
  </form>;
}

export function NoteForm({ projectId, kind, itemId, note, placeholder }: { projectId?: string; kind?: ItemKind; itemId?: string; note?: { id: string; content: string }; placeholder?: string }) {
  const [s, action, pending] = useActionState(saveNote, {});
  return <form action={action} className="space-y-3">
    {note && <input type="hidden" name="id" value={note.id} />}
    {projectId && <input type="hidden" name="project" value={projectId} />}
    {kind && itemId && <><input type="hidden" name="kind" value={kind} /><input type="hidden" name="item" value={itemId} /></>}
    <label className="sr-only" htmlFor={`note-${note?.id ?? itemId ?? projectId ?? "new"}`}>Ghi chú</label>
    <textarea id={`note-${note?.id ?? itemId ?? projectId ?? "new"}`} name="content" required maxLength={10000} rows={3} defaultValue={note?.content}
      placeholder={placeholder ?? "Ghi chú riêng của bạn — chỉ bạn xem được."} className={control} />
    <Msg s={s} />
    <button disabled={pending} className={buttonSecondary}>{pending ? "Đang lưu…" : note ? "Lưu ghi chú" : "Thêm ghi chú"}</button>
  </form>;
}

export function DeleteNoteButton({ id }: { id: string }) {
  const [s, action, pending] = useActionState(deleteNote, {});
  return <form action={action}><input type="hidden" name="id" value={id} />
    <button disabled={pending} className="text-[13px] text-critical hover:underline">Xóa ghi chú</button>
    {s.error && <span role="alert" className="ml-2 text-[12px] text-critical">{s.error}</span>}
  </form>;
}

type Plan = { current_position: string | null; education: string | null; target_role: string | null; target_degree: string | null; target_year: number | null;
  language_goals: string | null; application_status: string | null; budget_amount: number | null; budget_currency: string | null; budget_period: string | null };
export function PlanForm({ plan, countries, selected }: { plan: Plan | null; countries: Option[]; selected: string[] }) {
  const [s, action, pending] = useActionState(savePlan, {});
  return <form action={action} className="space-y-5">
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Vai trò hiện tại"><input name="currentPosition" maxLength={120} defaultValue={plan?.current_position ?? ""} className={control} /></Field>
      <Field label="Vai trò mong muốn"><input name="targetRole" maxLength={120} defaultValue={plan?.target_role ?? ""} className={control} /></Field>
      <Field label="Bậc học mục tiêu"><select name="targetDegree" defaultValue={plan?.target_degree ?? ""} className={control}><option value="">Chưa chọn</option>{Object.entries(targetDegrees).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Năm mục tiêu"><input name="targetYear" inputMode="numeric" maxLength={4} placeholder="2028" defaultValue={plan?.target_year ?? ""} className={control} /></Field>
      <Field label="Trạng thái hồ sơ"><select name="applicationStatus" defaultValue={plan?.application_status ?? ""} className={control}><option value="">Chưa chọn</option>{Object.entries(applicationStatuses).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label="Mục tiêu ngôn ngữ"><input name="languageGoals" maxLength={500} placeholder="Ví dụ: IELTS 7.0, tiếng Thụy Điển A2" defaultValue={plan?.language_goals ?? ""} className={control} /></Field>
    </div>
    <Field label="Học vấn"><textarea name="education" maxLength={500} rows={2} defaultValue={plan?.education ?? ""} className={control} /></Field>
    <CountryPicker countries={countries} selected={selected} />
    <fieldset className="rounded-xl bg-fill/40 p-4">
      <legend className="px-1 text-[13px] font-medium text-ink-2">Ngân sách (tùy chọn — chỉ bạn xem được; hệ thống không dùng để tính toán)</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Số tiền" hint="Dạng 12,000.50"><input name="budgetAmount" inputMode="decimal" defaultValue={plan?.budget_amount ?? ""} className={control} /></Field>
        <Field label="Tiền tệ" hint="Mã 3 chữ: EUR, SEK, VND…"><input name="budgetCurrency" maxLength={3} defaultValue={plan?.budget_currency ?? ""} className={`${control} uppercase`} /></Field>
        <Field label="Kỳ"><select name="budgetPeriod" defaultValue={plan?.budget_period ?? ""} className={control}><option value="">—</option>{Object.entries(budgetPeriods).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      </div>
    </fieldset>
    <Msg s={s} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu My Europe Plan"}</button>
  </form>;
}

export function DeleteWorkspaceForm() {
  const [s, action, pending] = useActionState(deleteMyWorkspace, {});
  return <form action={action} className="space-y-3">
    <p className="text-[15px] text-ink-2">Xóa vĩnh viễn toàn bộ project, mục đã lưu, ghi chú và My Europe Plan của bạn. Không ảnh hưởng tới tài khoản hay dữ liệu nghiên cứu công khai. Không hoàn tác được.</p>
    <Field label={`Gõ ${DELETE_CONFIRMATION} để xác nhận`}><input name="confirm" autoComplete="off" className={`${control} max-w-40`} /></Field>
    <Msg s={s} />
    <button disabled={pending} className="rounded-full bg-critical px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-50">Xóa toàn bộ dữ liệu workspace</button>
  </form>;
}
