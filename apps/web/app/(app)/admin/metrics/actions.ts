"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { metricCategories, metricError, metricKeyPattern, type MetricState } from "@/lib/compare/domain";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };

export async function saveMetric(_: MetricState, form: FormData): Promise<MetricState> {
  try {
    const { client } = await requirePermission("metrics.manage");
    const id = text(form, "id"), key = text(form, "key"), category = text(form, "category");
    if ((id && !uuidPattern.test(id)) || !metricKeyPattern.test(key) || !Object.hasOwn(metricCategories, category)) return { error: metricError("metrics_invalid") };
    const { error } = await client.rpc("save_metric", {
      p_id: id || null, p_key: key, p_label: text(form, "label"), p_description: text(form, "description"),
      p_unit: text(form, "unit") || null, p_category: category, p_active: form.get("active") === "on",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/metrics"); revalidatePath("/compare");
    return { message: id ? "Đã lưu thay đổi." : "Đã tạo chỉ số." };
  } catch (e) { logAccessError("save_metric"); return { error: metricError(e instanceof Error ? e.message : "") }; }
}
