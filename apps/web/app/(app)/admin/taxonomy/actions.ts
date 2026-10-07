"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { careerPathKeyPattern, parseKeywords, taxonomyError, type TaxonomyState } from "@/lib/taxonomy/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };

// Slice 11a: create or edit a career path. save_career_path() checks the
// permission again, keeps the key fixed and versions criteria changes.
export async function saveCareerPath(_: TaxonomyState, form: FormData): Promise<TaxonomyState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("taxonomy.manage");
    const id = text(form, "id"), key = text(form, "key");
    if ((id && !uuidPattern.test(id)) || !careerPathKeyPattern.test(key)) return { error: taxonomyError("taxonomy_invalid", locale) };
    const { error } = await client.rpc("save_career_path", {
      p_id: id || null, p_key: key, p_name_vi: text(form, "nameVi"), p_name_en: text(form, "nameEn"),
      p_definition_vi: text(form, "definitionVi"), p_definition_en: text(form, "definitionEn"),
      p_include: text(form, "include"), p_exclude: text(form, "exclude") || null,
      p_keywords: parseKeywords(text(form, "keywords")), p_active: form.get("active") === "on",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/taxonomy");
    return { message: id ? dict.adminTaxonomy.saved : dict.adminTaxonomy.created };
  } catch (e) { logAccessError("save_career_path"); return { error: taxonomyError(e instanceof Error ? e.message : "", locale) }; }
}
