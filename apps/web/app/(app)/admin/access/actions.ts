"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { accessMessage, type ActionState } from "@/lib/rbac/messages";
import { uuidPattern } from "@/lib/documents/domain";

export async function saveRole(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { client } = await requirePermission("roles.manage");
    const id = form.get("id"); const name = form.get("name"); const description = form.get("description");
    const permissions = form.getAll("permissions");
    if ((id && (typeof id !== "string" || !uuidPattern.test(id))) || typeof name !== "string" || typeof description !== "string" || permissions.some((p) => typeof p !== "string") || permissions.length > 50) return { error: accessMessage("rbac_invalid") };
    const { error } = await client.rpc("save_access_role", { p_id: id || null, p_name: name, p_description: description, p_permissions: permissions });
    if (error) { logAccessError("save_role"); return { error: accessMessage(error.code === "23505" ? error.code : error.message) }; }
    revalidatePath("/admin/access"); revalidatePath("/dashboard");
    return { message: "Đã lưu vai trò. Quyền mới được kiểm tra ở yêu cầu tiếp theo." };
  } catch (error) { logAccessError("save_role"); return { error: accessMessage(error instanceof Error ? error.message : "unknown") }; }
}
export async function assignRole(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { client } = await requirePermission("users.assign_roles");
    const user = form.get("user"); const role = form.get("role"); const grant = form.get("grant");
    if (typeof user !== "string" || !uuidPattern.test(user) || typeof role !== "string" || !uuidPattern.test(role) || !["yes", "no"].includes(String(grant))) return { error: accessMessage("rbac_invalid") };
    const { error } = await client.rpc("assign_access_role", { p_user: user, p_role: role, p_grant: grant === "yes" });
    if (error) { logAccessError("assign_role"); return { error: accessMessage(error.message) }; }
    revalidatePath("/admin/access"); revalidatePath("/dashboard");
    return { message: grant === "yes" ? "Đã gán vai trò." : "Đã gỡ vai trò." };
  } catch (error) { logAccessError("assign_role"); return { error: accessMessage(error instanceof Error ? error.message : "unknown") }; }
}
