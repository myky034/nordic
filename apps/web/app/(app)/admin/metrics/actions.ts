"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { appliesToValues, metricCategories, metricError, metricKeyPattern, valueKinds, type MetricState } from "@/lib/compare/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
/** Empty → null; anything that is not a finite number → NaN, which the check below refuses. */
const number = (form: FormData, key: string) => { const v = text(form, key).replace(",", "."); return v === "" ? null : Number(v); };

// L3a: save a fact type (was a comparison metric). save_fact_type() checks the
// permission again and keeps key, value kind, entity and category fixed.
export async function saveMetric(_: MetricState, form: FormData): Promise<MetricState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("metrics.manage");
    const id = text(form, "id"), key = text(form, "key"), category = text(form, "category"), kind = text(form, "kind"), applies = text(form, "applies");
    const min = number(form, "min"), max = number(form, "max");
    if ((id && !uuidPattern.test(id)) || !metricKeyPattern.test(key) || !Object.hasOwn(metricCategories, category)
      || !(valueKinds as readonly string[]).includes(kind) || !(appliesToValues as readonly string[]).includes(applies)
      || [min, max].some((v) => v !== null && !Number.isFinite(v))) {
      return { error: metricError("fact_types_invalid", locale) };
    }
    const { error } = await client.rpc("save_fact_type", {
      p_id: id || null, p_key: key, p_label_vi: text(form, "labelVi"), p_label_en: text(form, "labelEn"),
      p_definition_vi: text(form, "definitionVi"), p_definition_en: text(form, "definitionEn"),
      p_value_kind: kind, p_applies_to: applies, p_category: category, p_unit: text(form, "unit") || null,
      p_min: kind === "number" ? min : null, p_max: kind === "number" ? max : null,
      p_comparable: form.get("comparable") === "on", p_active: form.get("active") === "on",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/metrics"); revalidatePath("/compare"); revalidatePath("/facts/workspace");
    return { message: id ? dict.adminMetrics.saved : dict.adminMetrics.created };
  } catch (e) { logAccessError("save_fact_type"); return { error: metricError(e instanceof Error ? e.message : "", locale) }; }
}
