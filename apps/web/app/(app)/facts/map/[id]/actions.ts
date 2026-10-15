"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, logAccessError } from "@/lib/rbac/access";
import { factError, type FactState } from "@/lib/facts/domain";
import { formReader, hasStructured, readStructured } from "@/lib/facts/structured";
import { uuidPattern } from "@/lib/documents/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

/**
 * L5 Q1/Q5: save a selection on the mapping screen as a proposal. The linked
 * entity is read again here from the page URL (editor_document_entity), never
 * taken from the form, so a tampered form cannot attach the fact elsewhere.
 * propose_fact() checks the excerpt is in the page text (Q4), duplicates (Q3),
 * the type and the structured value.
 */
export async function mapFact(_: FactState, form: FormData): Promise<FactState> {
  const [locale, dict] = [await getLocale(), await getDictionary()];
  try {
    const { client } = await requirePermission("facts.propose");
    const get = formReader(form);
    const document = get("document"), factType = get("factType"), country = get("country");
    if (!uuidPattern.test(document) || (factType && !uuidPattern.test(factType)) || (country && !uuidPattern.test(country))) return { error: factError("facts_invalid", locale) };
    const structured = readStructured(get);
    if (!structured || (!factType && hasStructured(structured))) return { error: factError("facts_type_value_invalid", locale) };
    const entity = await client.rpc("editor_document_entity", { p_document: document });
    if (entity.error) throw new Error(entity.error.message);
    const linked = (entity.data as { kind: string; entity_id: string }[])[0];
    const id = (kind: string) => (linked?.kind === kind ? linked.entity_id : null);
    const { error } = await client.rpc("propose_fact", {
      p_document: document, p_topic: get("topic"), p_subject: get("subject"), p_predicate: get("predicate"), p_value: get("value"),
      p_unit: null, p_country: linked ? null : country || null, p_from: null, p_until: null, p_excerpt: get("excerpt"),
      p_university: id("university"), p_programme: id("programme"), p_deadline_type: null, p_immigration_rule: id("immigration_rule"),
      p_occupation: null, p_reference_period: null, p_fact_type: factType || null,
      p_value_number: structured.valueNumber, p_value_currency: structured.valueCurrency, p_value_period: structured.valuePeriod, p_value_date: structured.valueDate,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/facts/map/${document}`); revalidatePath("/facts/workspace");
    return { message: dict.factMap.saved };
  } catch (e) { logAccessError("map_fact"); return { error: factError(e instanceof Error ? e.message : "", locale) }; }
}
