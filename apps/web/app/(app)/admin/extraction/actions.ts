"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { extractionError, type ExtractionState } from "@/lib/extraction/domain";

// The account AI proposals are attributed to. The database refuses any
// account that could review its own proposals.
export async function setExtractionAccount(_: ExtractionState, form: FormData): Promise<ExtractionState> {
  try {
    const { client } = await requirePermission("roles.manage");
    const user = String(form.get("user") ?? "").trim();
    if (!uuidPattern.test(user)) return { error: "Nhập UUID của tài khoản." };
    const { error } = await client.rpc("set_extraction_account", { p_user: user });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/extraction");
    return { message: "Đã lưu tài khoản AI." };
  } catch (e) { logAccessError("set_extraction_account"); return { error: extractionError(e instanceof Error ? e.message : "") }; }
}
