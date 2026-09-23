"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { degreeTypes, educationError, officialUrl, type EducationState } from "@/lib/education/domain";

const text = (form: FormData, key: string) => { const v = form.get(key); return typeof v === "string" ? v.trim() : ""; };
// Actor, status and review dates are never read from the form: the RPCs take
// them from auth.uid()/now() inside the database.
function refresh() {
  revalidatePath("/education/workspace"); revalidatePath("/programmes"); revalidatePath("/universities");
}

export async function proposeUniversity(_: EducationState, form: FormData): Promise<EducationState> {
  try {
    const { client } = await requirePermission("education.manage");
    const url = officialUrl(text(form, "officialUrl"));
    const country = text(form, "country"), document = text(form, "document");
    if (!url || !uuidPattern.test(country) || !uuidPattern.test(document)) return { error: educationError("education_invalid") };
    const { error } = await client.rpc("propose_university", {
      p_country: country, p_name: text(form, "name"), p_official_url: url, p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: "Đã lưu đề xuất trường. Chưa công bố trước khi duyệt." };
  } catch (e) { logAccessError("propose_university"); return { error: educationError(e instanceof Error ? e.message : "") }; }
}

export async function proposeProgramme(_: EducationState, form: FormData): Promise<EducationState> {
  try {
    const { client } = await requirePermission("education.manage");
    const url = officialUrl(text(form, "officialUrl"));
    const rawApplication = text(form, "applicationUrl");
    const application = rawApplication ? officialUrl(rawApplication) : null;
    const university = text(form, "university"), document = text(form, "document"), degree = text(form, "degree");
    if (!url || (rawApplication && !application) || !uuidPattern.test(university) || !uuidPattern.test(document) || !Object.hasOwn(degreeTypes, degree)) {
      return { error: educationError("education_invalid") };
    }
    const { error } = await client.rpc("propose_programme", {
      p_university: university, p_name: text(form, "name"), p_degree_type: degree,
      p_field: text(form, "field") || null, p_language: text(form, "language") || null,
      p_official_url: url, p_application_url: application, p_document: document, p_excerpt: text(form, "excerpt"),
    });
    if (error) throw new Error(error.message);
    refresh();
    return { message: "Đã lưu đề xuất chương trình. Học phí/deadline nhập riêng ở Thông tin & bằng chứng." };
  } catch (e) { logAccessError("propose_programme"); return { error: educationError(e instanceof Error ? e.message : "") }; }
}

export async function reviewEducation(_: EducationState, form: FormData): Promise<EducationState> {
  try {
    const { client } = await requirePermission("facts.review");
    const kind = text(form, "kind"), id = text(form, "id"), decision = text(form, "decision");
    if (!["university", "programme"].includes(kind) || !uuidPattern.test(id) || !["reviewed", "rejected"].includes(decision)) {
      return { error: educationError("education_invalid") };
    }
    const { error } = await client.rpc("review_education", { p_kind: kind, p_id: id, p_decision: decision, p_note: text(form, "note") });
    if (error) throw new Error(error.message);
    refresh();
    return { message: "Đã ghi nhận quyết định và lịch sử." };
  } catch (e) { logAccessError("review_education"); return { error: educationError(e instanceof Error ? e.message : "") }; }
}
