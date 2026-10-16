// The fact types a rule may target, with their value kind. A copy of the
// ACTIVE rows of fact_types as read (read-only) on 2026-10-16; the database
// stays the authority and re-checks every proposal (extractor_propose).
// PR 3 compares this list with extractor_fact_types() at run time. The D8
// types (intake_start_date, intake_end_date, application_status,
// study_pace_percent) are added here only after they exist in fact_types.
// Retired: programme_duration_text (inactive since L4).

export type ValueKind = "money" | "number" | "date" | "text";

export const KNOWN_FACT_TYPES: Readonly<Record<string, ValueKind>> = {
  application_deadline: "date",
  application_fee: "money",
  application_period: "text",
  english_requirement: "text",
  prior_degree_requirement: "text",
  programme_credits: "number",
  programme_duration: "number",
  study_mode: "text",
  permit_processing_time: "number",
  post_study_permit_duration: "number",
  residence_permit_fee: "money",
  work_during_studies: "text",
  median_salary: "money",
  min_ielts_overall: "number",
  min_toefl_ibt: "number",
  teaching_language: "text",
  maintenance_requirement: "money",
  tuition_fee: "money",
};

/**
 * D2 (approved 2026-10-16): which fact types belong to an intake.
 * - "intake": always about one intake (application dates and periods; the
 *   D8 types application_status, intake_start_date, intake_end_date join
 *   when they exist). A rule may take the intake from a heading or the page.
 * - "optional": may be intake-specific or broader, depending on what the
 *   source says (tuition). Appearing on an intake page is not enough, so in
 *   PR 2b such rules cannot attach an intake at all.
 * - anything else: never intake-specific.
 */
export const INTAKE_SCOPE: Readonly<Record<string, "intake" | "optional">> = {
  application_deadline: "intake",
  application_period: "intake",
  tuition_fee: "optional",
};
