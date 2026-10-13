"use server";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { degreeTypes, educationError, officialUrl, type EducationState } from "@/lib/education/domain";
import { classificationError } from "@/lib/taxonomy/domain";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
// Actor, status and review dates are never read from the form: the RPCs take
// them from auth.uid()/now() inside the database.
function refresh() {
  revalidatePath("/education/workspace"); revalidatePath("/programmes"); revalidatePath("/universities");
}

export async function proposeUniversity(_: EducationState, form: FormData): Promise<EducationState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("education.manage");
    const url = officialUrl(text(form, "officialUrl"));
    const country = text(form, "country"), document = text(form, "document");
    if (!url || !uuidPattern.test(country) || !uuidPattern.test(document)) return { error: educationError("education_invalid", locale) };
    const { error } = await client.rpc("propose_university", {
      p_country: country, p_name: text(form, "name"), p_official_url: url, p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.educationWorkspace.messages.university };
  } catch (e) { logAccessError("propose_university"); return { error: educationError(e instanceof Error ? e.message : "", locale) }; }
}

export async function proposeProgramme(_: EducationState, form: FormData): Promise<EducationState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("education.manage");
    const url = officialUrl(text(form, "officialUrl"));
    const rawApplication = text(form, "applicationUrl");
    const application = rawApplication ? officialUrl(rawApplication) : null;
    const university = text(form, "university"), document = text(form, "document"), degree = text(form, "degree");
    if (!url || (rawApplication && !application) || !uuidPattern.test(university) || !uuidPattern.test(document) || !Object.hasOwn(degreeTypes, degree)) {
      return { error: educationError("education_invalid", locale) };
    }
    const { error } = await client.rpc("propose_programme", {
      p_university: university, p_name: text(form, "name"), p_degree_type: degree,
      p_field: text(form, "field") || null, p_language: text(form, "language") || null,
      p_official_url: url, p_application_url: application, p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.educationWorkspace.messages.programme };
  } catch (e) { logAccessError("propose_programme"); return { error: educationError(e instanceof Error ? e.message : "", locale) }; }
}

export async function reviewEducation(_: EducationState, form: FormData): Promise<EducationState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.review");
    const kind = text(form, "kind"), id = text(form, "id"), decision = text(form, "decision");
    if (!["university", "programme"].includes(kind) || !uuidPattern.test(id) || !["reviewed", "rejected"].includes(decision)) {
      return { error: educationError("education_invalid", locale) };
    }
    const { error } = await client.rpc("review_education", { p_kind: kind, p_id: id, p_decision: decision, p_note: text(form, "note") });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.editor.decisionRecorded };
  } catch (e) { logAccessError("review_education"); return { error: educationError(e instanceof Error ? e.message : "", locale) }; }
}

// Slice 11b: classify a reviewed Master's/PhD programme by ONE field of study
// or ONE career path. The database checks eligibility, the evidence site and
// duplicates again (propose_classification); nothing here is trusted.
export async function proposeClassification(_: EducationState, form: FormData): Promise<EducationState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("education.manage");
    const programme = text(form, "programme"), document = text(form, "document"), dimension = text(form, "dimension");
    const target = text(form, dimension === "path" ? "path" : "field");
    if (!["field", "path"].includes(dimension) || ![programme, document, target].every((v) => uuidPattern.test(v))) {
      return { error: classificationError("classification_invalid", locale) };
    }
    const { error } = await client.rpc("propose_classification", {
      p_programme: programme, p_study_field: dimension === "field" ? target : null, p_career_path: dimension === "path" ? target : null,
      p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.classification.proposed };
  } catch (e) { logAccessError("propose_classification"); return { error: classificationError(e instanceof Error ? e.message : "", locale) }; }
}

// mode=revalidate: the panel's approve button means "still matches the new
// criteria" for a reviewed classification whose career path changed.
export async function reviewClassification(_: EducationState, form: FormData): Promise<EducationState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.review");
    const id = text(form, "id"), raw = text(form, "decision"), mode = text(form, "mode");
    if (!uuidPattern.test(id) || !["reviewed", "rejected"].includes(raw)) return { error: classificationError("classification_invalid", locale) };
    const decision = mode === "revalidate" && raw === "reviewed" ? "revalidated" : raw;
    const { error } = await client.rpc("review_classification", { p_id: id, p_decision: decision, p_note: text(form, "note") });
    if (error) throw new Error(error.message);
    refresh();
    return { message: dict.editor.decisionRecorded };
  } catch (e) { logAccessError("review_classification"); return { error: classificationError(e instanceof Error ? e.message : "", locale) }; }
}
