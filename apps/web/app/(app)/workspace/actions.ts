"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthClaims } from "@/lib/auth/session";
import { uuidPattern } from "@/lib/documents/domain";
import {
  applicationStatuses, DELETE_CONFIRMATION, isItemKind, itemKinds, parseBudget, parseYear, targetDegrees, workspaceError, type WorkspaceState,
} from "@/lib/workspace/domain";

// Every write goes through the signed-in user's Supabase client, so owner-only
// RLS decides what can be touched; actions only validate the shape of input.
// The owner is never taken from the form: user_id defaults to auth.uid().
async function ownerClient() {
  const claims = await getAuthClaims();
  if (!claims) throw new Error("access_unauthenticated");
  return createClient();
}
const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
const id = (form: FormData, key: string) => { const v = text(form, key); return uuidPattern.test(v) ? v : null; };
const fail = (operation: string, e: unknown): WorkspaceState => {
  const code = e && typeof e === "object" && "code" in e && typeof e.code === "string" ? e.code : e instanceof Error ? e.message : "";
  console.error({ source: "workspace", operation, timestamp: new Date().toISOString(), status: "failed", category: "workspace_write_failed" });
  return { error: workspaceError(code) };
};
function refresh(...paths: string[]) { for (const p of ["/workspace", ...paths]) revalidatePath(p); }
const countriesFrom = (form: FormData) => [...new Set(form.getAll("countries").filter((v): v is string => typeof v === "string" && uuidPattern.test(v)))].slice(0, 5);

export type SaveState = WorkspaceState & { saved?: boolean };
/** Bookmark toggle used by the Save button on public detail pages. */
export async function toggleSaved(prev: SaveState, form: FormData): Promise<SaveState> {
  try {
    const kind = text(form, "kind"), itemId = id(form, "id");
    if (!isItemKind(kind) || !itemId) return { ...prev, error: workspaceError("invalid") };
    const client = await ownerClient();
    const column = itemKinds[kind].column;
    const existing = await client.from("saved_items").select("id").eq(column, itemId).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      const { error } = await client.from("saved_items").delete().eq("id", existing.data.id);
      if (error) throw error;
    } else {
      const { error } = await client.from("saved_items").insert({ project_id: null, [column]: itemId });
      if (error) throw error;
    }
    refresh();
    return { saved: !existing.data, message: existing.data ? "Đã bỏ lưu." : "Đã lưu vào workspace." };
  } catch (e) { return { ...prev, ...fail("toggle_saved", e) }; }
}

export async function saveProject(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const projectId = text(form, "id") ? id(form, "id") : null;
    const year = parseYear(text(form, "targetYear"));
    const name = text(form, "name");
    if ((text(form, "id") && !projectId) || year === "invalid" || !name || name.length > 120) return { error: workspaceError("invalid") };
    const client = await ownerClient();
    const row = { name, description: text(form, "description") || null, target_year: year, target_role: text(form, "targetRole") || null };
    const result = projectId
      ? await client.from("research_projects").update(row).eq("id", projectId).select("id").single()
      : await client.from("research_projects").insert(row).select("id").single();
    if (result.error) throw result.error;
    const pid = result.data.id as string;
    // Replace the project's target countries (RLS: only for a project the caller owns).
    const del = await client.from("research_project_countries").delete().eq("project_id", pid);
    if (del.error) throw del.error;
    const countries = countriesFrom(form);
    if (countries.length) {
      const ins = await client.from("research_project_countries").insert(countries.map((country_id) => ({ project_id: pid, country_id })));
      if (ins.error) throw ins.error;
    }
    refresh(`/workspace/projects/${pid}`);
    return { message: projectId ? "Đã lưu thay đổi." : "Đã tạo project." };
  } catch (e) { return fail("save_project", e); }
}

export async function setProjectStatus(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const projectId = id(form, "id"), status = text(form, "status");
    if (!projectId || !["active", "archived"].includes(status)) return { error: workspaceError("invalid") };
    const client = await ownerClient();
    const { error } = await client.from("research_projects").update({ status }).eq("id", projectId);
    if (error) throw error;
    refresh(`/workspace/projects/${projectId}`);
    return { message: status === "archived" ? "Đã lưu trữ project." : "Đã mở lại project." };
  } catch (e) { return fail("project_status", e); }
}

export async function deleteProject(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const projectId = id(form, "id");
    if (!projectId || text(form, "confirm") !== DELETE_CONFIRMATION) return { error: `Gõ ${DELETE_CONFIRMATION} để xác nhận.` };
    const client = await ownerClient();
    // Notes in the project are deleted with it; saved items are kept and unfiled.
    const { error } = await client.from("research_projects").delete().eq("id", projectId);
    if (error) throw error;
    refresh();
    return { message: "Đã xóa project." };
  } catch (e) { return fail("delete_project", e); }
}

export async function fileSavedItem(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const savedId = id(form, "id"), raw = text(form, "project"), projectId = raw ? id(form, "project") : null;
    if (!savedId || (raw && !projectId)) return { error: workspaceError("invalid") };
    const client = await ownerClient();
    const { error } = await client.from("saved_items").update({ project_id: projectId }).eq("id", savedId);
    if (error) throw error;
    refresh(...(projectId ? [`/workspace/projects/${projectId}`] : []));
    return { message: projectId ? "Đã thêm vào project." : "Đã bỏ khỏi project." };
  } catch (e) { return fail("file_saved", e); }
}

export async function removeSavedItem(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const savedId = id(form, "id");
    if (!savedId) return { error: workspaceError("invalid") };
    const client = await ownerClient();
    const { error } = await client.from("saved_items").delete().eq("id", savedId);
    if (error) throw error;
    refresh();
    return { message: "Đã bỏ lưu." };
  } catch (e) { return fail("remove_saved", e); }
}

export async function saveNote(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const noteId = text(form, "id") ? id(form, "id") : null;
    const content = text(form, "content");
    const rawProject = text(form, "project"), projectId = rawProject ? id(form, "project") : null;
    const kind = text(form, "kind"), itemId = text(form, "item") ? id(form, "item") : null;
    if ((text(form, "id") && !noteId) || !content || content.length > 10000 || (rawProject && !projectId) || (kind && (!isItemKind(kind) || !itemId))) {
      return { error: workspaceError("invalid") };
    }
    const client = await ownerClient();
    const result = noteId
      ? await client.from("notes").update({ content }).eq("id", noteId)
      : await client.from("notes").insert({ content, project_id: projectId, ...(isItemKind(kind) && itemId ? { [itemKinds[kind].column]: itemId } : {}) });
    if (result.error) throw result.error;
    refresh(...(projectId ? [`/workspace/projects/${projectId}`] : []));
    return { message: noteId ? "Đã lưu ghi chú." : "Đã thêm ghi chú." };
  } catch (e) { return fail("save_note", e); }
}

export async function deleteNote(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const noteId = id(form, "id");
    if (!noteId) return { error: workspaceError("invalid") };
    const client = await ownerClient();
    const { error } = await client.from("notes").delete().eq("id", noteId);
    if (error) throw error;
    refresh();
    return { message: "Đã xóa ghi chú." };
  } catch (e) { return fail("delete_note", e); }
}

export async function savePlan(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    const year = parseYear(text(form, "targetYear"));
    const degree = text(form, "targetDegree"), status = text(form, "applicationStatus");
    const budget = parseBudget(text(form, "budgetAmount"), text(form, "budgetCurrency"), text(form, "budgetPeriod"));
    if (year === "invalid") return { error: "Năm mục tiêu phải trong khoảng 2000–2100." };
    if (budget === "invalid") return { error: "Ngân sách cần đủ số tiền (ví dụ 12,000.50), mã tiền tệ 3 chữ (EUR, SEK…) và kỳ; hoặc để trống cả ba." };
    if ((degree && !Object.hasOwn(targetDegrees, degree)) || (status && !Object.hasOwn(applicationStatuses, status))) return { error: workspaceError("invalid") };
    const client = await ownerClient();
    const { error } = await client.from("user_plans").upsert({
      current_position: text(form, "currentPosition") || null, education: text(form, "education") || null,
      target_role: text(form, "targetRole") || null, target_degree: degree || null, target_year: year,
      language_goals: text(form, "languageGoals") || null, application_status: status || null,
      budget_amount: budget.amount, budget_currency: budget.currency, budget_period: budget.period,
    });
    if (error) throw error;
    const del = await client.from("user_plan_countries").delete().not("country_id", "is", null);
    if (del.error) throw del.error;
    const countries = countriesFrom(form);
    if (countries.length) {
      const ins = await client.from("user_plan_countries").insert(countries.map((country_id) => ({ country_id })));
      if (ins.error) throw ins.error;
    }
    refresh("/workspace/plan");
    return { message: "Đã lưu My Europe Plan." };
  } catch (e) { return fail("save_plan", e); }
}

export async function deleteMyWorkspace(_: WorkspaceState, form: FormData): Promise<WorkspaceState> {
  try {
    if (text(form, "confirm") !== DELETE_CONFIRMATION) return { error: `Gõ ${DELETE_CONFIRMATION} để xác nhận.` };
    const client = await ownerClient();
    const { error } = await client.rpc("delete_my_workspace");
    if (error) throw error;
    refresh("/workspace/plan");
    return { message: "Đã xóa toàn bộ dữ liệu workspace của bạn." };
  } catch (e) { return fail("delete_workspace", e); }
}
