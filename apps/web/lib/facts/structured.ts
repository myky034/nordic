import { currencyPattern, valuePeriods } from "@/lib/compare/domain";

// Shape checks for the optional structured value of a fact form (L3a, L4),
// shared by every form that sends one (proposal, reviewer type, mapping).
// Which fields a type needs, the range and the excerpt check are decided by
// the database; this only refuses malformed input early.
export type Structured = { valueNumber: number | null; valueCurrency: string | null; valuePeriod: string | null; valueDate: string | null };

/** Returns null when a field is malformed. "6,5" is read as 6.5; currency is upper-cased. */
export function readStructured(get: (key: string) => string): Structured | null {
  const rawNumber = get("valueNumber").replace(",", ".");
  const valueNumber = rawNumber === "" ? null : Number(rawNumber);
  const valueCurrency = get("valueCurrency").toUpperCase() || null;
  const valuePeriod = get("valuePeriod") || null;
  const valueDate = get("valueDate") || null;
  if ((valueNumber !== null && !Number.isFinite(valueNumber)) || (valueCurrency && !currencyPattern.test(valueCurrency))
    || (valuePeriod && !(valuePeriods as readonly string[]).includes(valuePeriod)) || (valueDate && !/^\d{4}-\d{2}-\d{2}$/.test(valueDate))) return null;
  return { valueNumber, valueCurrency, valuePeriod, valueDate };
}
export const hasStructured = (v: Structured) => v.valueNumber !== null || !!v.valueCurrency || !!v.valuePeriod || !!v.valueDate;
/** Trimmed string fields of a FormData ("" when missing). */
export const formReader = (form: FormData) => (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
