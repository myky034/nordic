"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { factError, type FactState } from "@/lib/facts/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { uuidPattern } from "@/lib/documents/domain";
import { deadlineTypes } from "@/lib/education/domain";
import { isReferencePeriod } from "@/lib/labour/domain";
import { formReader, hasStructured, readStructured } from "@/lib/facts/structured";
export async function proposeFact(_: FactState, form: FormData): Promise<FactState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.propose");
    const get = formReader(form);
    // Slice 5/6a: optional link to ONE entity, encoded as "programme:<uuid>",
    // "university:<uuid>" or "immigration_rule:<uuid>" by a single select so
    // two links cannot be sent at once.
    const [kind, entity] = get("entity").split(":");
    if (get("entity") && (!["programme","university","immigration_rule","occupation"].includes(kind) || !uuidPattern.test(entity ?? ""))) return {error:factError("facts_invalid", locale)};
    const deadline = get("deadlineType");
    if (deadline && !Object.hasOwn(deadlineTypes, deadline)) return {error:factError("facts_invalid", locale)};
    const period = get("referencePeriod");
    // L3a: optional fact type with its structured value. Shape checks only;
    // propose_fact() decides which fields the type needs, the range, and
    // whether the number is in the excerpt.
    const factType = get("factType");
    if (factType && !uuidPattern.test(factType)) return {error:factError("facts_invalid", locale)};
    const structured = readStructured(get);
    if (!structured || (!factType && hasStructured(structured))) return {error:factError("facts_type_value_invalid", locale)};
    const { valueNumber, valueCurrency, valuePeriod, valueDate } = structured;
    if (period && !isReferencePeriod(period)) return {error:factError("facts_invalid_period", locale)};
    const { error } = await client.rpc("propose_fact", {
      p_document:get("document"),p_topic:get("topic"),p_subject:get("subject"),
      p_predicate:get("predicate"),p_value:get("value"),p_unit:get("unit") || null,
      p_country:get("country") || null,p_from:get("from") || null,p_until:get("until") || null,p_excerpt:get("excerpt"),
      p_university:kind==="university"?entity:null,p_programme:kind==="programme"?entity:null,p_deadline_type:deadline || null,p_immigration_rule:kind==="immigration_rule"?entity:null,p_occupation:kind==="occupation"?entity:null,p_reference_period:period || null,p_fact_type:factType || null,p_value_number:valueNumber,p_value_currency:valueCurrency,p_value_period:valuePeriod,p_value_date:valueDate,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/facts/workspace");
    return { message: dict.factsWorkspace.messages.proposed };
  } catch (e) { logAccessError("propose_fact"); return {error:factError(e instanceof Error ? e.message : "", locale)}; }
}
export async function reviewFact(_: FactState, form: FormData): Promise<FactState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.review");
    const { error } = await client.rpc("review_fact",{
      p_fact:form.get("fact"),p_decision:form.get("decision"),p_note:form.get("note"),p_related:form.get("related") || null,
    });
    if(error) throw new Error(error.message);
    revalidatePath("/facts/workspace"); revalidatePath("/facts"); revalidatePath("/facts/map/[id]", "page");
    return {message:dict.editor.decisionRecorded};
  } catch(e) { logAccessError("review_fact"); return {error:factError(e instanceof Error ? e.message : "", locale)}; }
}
// Slice 9: close a "source changed" flag. revalidated = the claim still
// matches the new page version; rejected = withdraw it from public pages.
export async function resolveSourceChange(_: FactState, form: FormData): Promise<FactState> {
  // Messages in the editor\'s interface language (lib/i18n).
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.review");
    const decision = form.get("decision"), related = String(form.get("related") ?? "");
    // L7a: "superseded" names the replacing fact from the same page; the database checks it.
    if (!uuidPattern.test(String(form.get("fact") ?? "")) || !["revalidated", "rejected", "superseded"].includes(String(decision))
      || (decision === "superseded" && !uuidPattern.test(related))) return {error:factError("facts_invalid", locale)};
    const { error } = await client.rpc("resolve_source_change",{p_fact:form.get("fact"),p_decision:decision,p_note:form.get("note"),p_related:decision === "superseded" ? related : null});
    if(error) throw new Error(error.message);
    revalidatePath("/facts/workspace"); revalidatePath("/facts"); revalidatePath("/facts/map/[id]", "page");
    const m = dict.factsWorkspace.messages;
    return {message:decision==="revalidated"?m.revalidated:decision==="superseded"?m.superseded:m.withdrawn};
  } catch(e) { logAccessError("resolve_source_change"); return {error:factError(e instanceof Error ? e.message : "", locale)}; }
}
// L4 (Q3): a reviewer sets, changes or removes the type and structured value
// of a proposed fact. set_fact_type() re-checks everything and records it.
export async function setFactType(_: FactState, form: FormData): Promise<FactState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.review");
    const get = formReader(form);
    const fact = get("fact"), factType = get("factType");
    if (!uuidPattern.test(fact) || (factType && !uuidPattern.test(factType))) return {error:factError("facts_invalid", locale)};
    const structured = readStructured(get);
    if (!structured || (!factType && hasStructured(structured))) return {error:factError("facts_type_value_invalid", locale)};
    const note = get("note");
    if (note.length > 1000) return {error:factError("facts_invalid", locale)};
    const { error } = await client.rpc("set_fact_type", {
      p_fact: fact, p_fact_type: factType || null, p_value_number: structured.valueNumber, p_value_currency: structured.valueCurrency,
      p_value_period: structured.valuePeriod, p_value_date: structured.valueDate, p_note: note || null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/facts/workspace"); revalidatePath("/facts/map/[id]", "page");
    return { message: dict.factsWorkspace.messages.typeSaved };
  } catch (e) { logAccessError("set_fact_type"); return {error:factError(e instanceof Error ? e.message : "", locale)}; }
}
