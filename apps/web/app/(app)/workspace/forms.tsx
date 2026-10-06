"use client";
import { useActionState } from "react";
import {
  deleteMyWorkspace, deleteNote, deleteProject, fileSavedItem, removeSavedItem, saveNote, savePlan, saveProject, setProjectStatus,
} from "./actions";
import { applicationStatusOptions, budgetPeriodOptions, deleteConfirmation, targetDegreeOptions, type ItemKind, type WorkspaceState } from "@/lib/workspace/domain";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSecondary, buttonSmall, control } from "@/components/ui/styles";

type Option = { id: string; label: string };
const Msg = ({ s }: { s: WorkspaceState }) => <FormMessage error={s.error} message={s.message} />;
// Every form takes the interface language from its page (lib/i18n); messages
// returned by the actions are already in that language.
const words = (locale: Locale) => dictionaries[locale].workspace.form;

function CountryPicker({ countries, selected, legend }: { countries: Option[]; selected: string[]; legend: string }) {
  return <fieldset><legend className="text-[13px] font-medium text-ink-2">{legend}</legend>
    <div className="mt-2 flex flex-wrap gap-2">{countries.map((c) => <label key={c.id}
      className="inline-flex cursor-pointer items-center rounded-full bg-fill px-3.5 py-1.5 text-[14px] has-[:checked]:bg-accent has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50">
      <input type="checkbox" name="countries" value={c.id} defaultChecked={selected.includes(c.id)} className="sr-only" />{c.label}</label>)}</div>
  </fieldset>;
}

export function ProjectForm({ countries, project, locale }: { countries: Option[]; project?: { id: string; name: string; description: string | null; target_year: number | null; target_role: string | null; countries: string[] }; locale: Locale }) {
  const [s, action, pending] = useActionState(saveProject, {});
  const t = words(locale);
  return <form action={action} className="space-y-5">
    {project && <input type="hidden" name="id" value={project.id} />}
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.projectName} hint={t.projectNameHint}><input name="name" required maxLength={120} defaultValue={project?.name} className={control} /></Field>
      <Field label={t.targetYear}><input name="targetYear" inputMode="numeric" maxLength={4} placeholder="2028" defaultValue={project?.target_year ?? ""} className={control} /></Field>
      <Field label={t.targetRole} className="sm:col-span-2"><input name="targetRole" maxLength={120} placeholder={t.targetRolePlaceholder} defaultValue={project?.target_role ?? ""} className={control} /></Field>
    </div>
    <CountryPicker countries={countries} selected={project?.countries ?? []} legend={t.targetCountries} />
    <Field label={t.descriptionOptional}><textarea name="description" maxLength={2000} rows={2} defaultValue={project?.description ?? ""} className={control} /></Field>
    <Msg s={s} />
    <button disabled={pending} className={buttonPrimary}>{pending ? t.saving : project ? t.saveChanges : t.createProject}</button>
  </form>;
}

export function ProjectStatusButton({ id, status, locale }: { id: string; status: string; locale: Locale }) {
  const [s, action, pending] = useActionState(setProjectStatus, {});
  const t = words(locale);
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status === "active" ? "archived" : "active"} />
    <button disabled={pending} className={buttonSmall}>{status === "active" ? t.archive : t.reopen}</button>
    {s.error && <span role="alert" className="text-[12px] text-critical">{s.error}</span>}
  </form>;
}

export function DeleteProjectForm({ id, locale }: { id: string; locale: Locale }) {
  const [s, action, pending] = useActionState(deleteProject, {});
  const t = words(locale);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="id" value={id} />
    <p className="text-[15px] text-ink-2">{t.deleteProjectText}</p>
    <Field label={t.typeToConfirm(deleteConfirmation(locale))}><input name="confirm" autoComplete="off" className={`${control} max-w-40`} /></Field>
    <Msg s={s} />
    <button disabled={pending} className="rounded-full bg-critical px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-50">{t.deleteProject}</button>
  </form>;
}

// Changing the select submits immediately: one tap to file a bookmark.
export function FileSavedSelect({ id, current, projects, locale }: { id: string; current: string | null; projects: Option[]; locale: Locale }) {
  const [s, action] = useActionState(fileSavedItem, {});
  const t = words(locale);
  return <form action={action} className="inline-flex items-center gap-2">
    <input type="hidden" name="id" value={id} />
    <label className="sr-only" htmlFor={`file-${id}`}>{t.project}</label>
    <select id={`file-${id}`} name="project" defaultValue={current ?? ""} onChange={(e) => e.currentTarget.form?.requestSubmit()} className={`${control} mt-0 w-auto py-1.5 text-[13px]`}>
      <option value="">{t.unfiled}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
    {s.error && <span role="alert" className="text-[12px] text-critical">{s.error}</span>}
  </form>;
}

export function RemoveSavedButton({ id, locale }: { id: string; locale: Locale }) {
  const [s, action, pending] = useActionState(removeSavedItem, {});
  const t = words(locale);
  return <form action={action}><input type="hidden" name="id" value={id} />
    <button disabled={pending} className="text-[13px] text-critical hover:underline">{t.removeSaved}</button>
    {s.error && <span role="alert" className="ml-2 text-[12px] text-critical">{s.error}</span>}
  </form>;
}

export function NoteForm({ projectId, kind, itemId, note, placeholder, locale }: { projectId?: string; kind?: ItemKind; itemId?: string; note?: { id: string; content: string }; placeholder?: string; locale: Locale }) {
  const [s, action, pending] = useActionState(saveNote, {});
  const t = words(locale);
  return <form action={action} className="space-y-3">
    {note && <input type="hidden" name="id" value={note.id} />}
    {projectId && <input type="hidden" name="project" value={projectId} />}
    {kind && itemId && <><input type="hidden" name="kind" value={kind} /><input type="hidden" name="item" value={itemId} /></>}
    <label className="sr-only" htmlFor={`note-${note?.id ?? itemId ?? projectId ?? "new"}`}>{t.note}</label>
    <textarea id={`note-${note?.id ?? itemId ?? projectId ?? "new"}`} name="content" required maxLength={10000} rows={3} defaultValue={note?.content}
      placeholder={placeholder ?? t.notePlaceholder} className={control} />
    <Msg s={s} />
    <button disabled={pending} className={buttonSecondary}>{pending ? t.saving : note ? t.saveNote : t.addNote}</button>
  </form>;
}

export function DeleteNoteButton({ id, locale }: { id: string; locale: Locale }) {
  const [s, action, pending] = useActionState(deleteNote, {});
  const t = words(locale);
  return <form action={action}><input type="hidden" name="id" value={id} />
    <button disabled={pending} className="text-[13px] text-critical hover:underline">{t.deleteNote}</button>
    {s.error && <span role="alert" className="ml-2 text-[12px] text-critical">{s.error}</span>}
  </form>;
}

type Plan = { current_position: string | null; education: string | null; target_role: string | null; target_degree: string | null; target_year: number | null;
  language_goals: string | null; application_status: string | null; budget_amount: number | null; budget_currency: string | null; budget_period: string | null };
export function PlanForm({ plan, countries, selected, locale }: { plan: Plan | null; countries: Option[]; selected: string[]; locale: Locale }) {
  const [s, action, pending] = useActionState(savePlan, {});
  const t = words(locale);
  return <form action={action} className="space-y-5">
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label={t.currentPosition}><input name="currentPosition" maxLength={120} defaultValue={plan?.current_position ?? ""} className={control} /></Field>
      <Field label={t.desiredRole}><input name="targetRole" maxLength={120} defaultValue={plan?.target_role ?? ""} className={control} /></Field>
      <Field label={t.targetDegree}><select name="targetDegree" defaultValue={plan?.target_degree ?? ""} className={control}><option value="">{t.notChosen}</option>{targetDegreeOptions(locale).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label={t.targetYear}><input name="targetYear" inputMode="numeric" maxLength={4} placeholder="2028" defaultValue={plan?.target_year ?? ""} className={control} /></Field>
      <Field label={t.applicationStatus}><select name="applicationStatus" defaultValue={plan?.application_status ?? ""} className={control}><option value="">{t.notChosen}</option>{applicationStatusOptions(locale).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      <Field label={t.languageGoals}><input name="languageGoals" maxLength={500} placeholder={t.languagePlaceholder} defaultValue={plan?.language_goals ?? ""} className={control} /></Field>
    </div>
    <Field label={t.education}><textarea name="education" maxLength={500} rows={2} defaultValue={plan?.education ?? ""} className={control} /></Field>
    <CountryPicker countries={countries} selected={selected} legend={t.targetCountries} />
    <fieldset className="rounded-xl bg-fill/40 p-4">
      <legend className="px-1 text-[13px] font-medium text-ink-2">{t.budgetLegend}</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.amount} hint={t.amountHint}><input name="budgetAmount" inputMode="decimal" defaultValue={plan?.budget_amount ?? ""} className={control} /></Field>
        <Field label={t.currency} hint={t.currencyHint}><input name="budgetCurrency" maxLength={3} defaultValue={plan?.budget_currency ?? ""} className={`${control} uppercase`} /></Field>
        <Field label={t.period}><select name="budgetPeriod" defaultValue={plan?.budget_period ?? ""} className={control}><option value="">—</option>{budgetPeriodOptions(locale).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      </div>
    </fieldset>
    <Msg s={s} />
    <button disabled={pending} className={buttonPrimary}>{pending ? t.saving : t.savePlan}</button>
  </form>;
}

export function DeleteWorkspaceForm({ locale }: { locale: Locale }) {
  const [s, action, pending] = useActionState(deleteMyWorkspace, {});
  const t = words(locale);
  return <form action={action} className="space-y-3">
    <p className="text-[15px] text-ink-2">{t.deleteWorkspaceText}</p>
    <Field label={t.typeToConfirm(deleteConfirmation(locale))}><input name="confirm" autoComplete="off" className={`${control} max-w-40`} /></Field>
    <Msg s={s} />
    <button disabled={pending} className="rounded-full bg-critical px-5 py-2.5 text-[15px] font-medium text-white disabled:opacity-50">{dictionaries[locale].workspace.deleteAll}</button>
  </form>;
}
