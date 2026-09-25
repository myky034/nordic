import { factSelect } from "../facts/view";

const evidenceDocument = "canonical_url,retrieved_at,title,sources(name,source_tier)";
export const occupationListSelect = "id,name,classification_system,classification_code,countries(slug,name)";
export const occupationDetailSelect =
  `id,name,classification_system,classification_code,evidence_excerpt,reviewed_at,countries(slug,name),documents!occupations_document_id_fkey(${evidenceDocument})`;
// Inner-join the evidence source so the page can require a verified source,
// mirroring the facts_public RLS rule for occupation-linked figures.
export const figureSelect = factSelect.replace(
  "documents!facts_document_id_fkey(title,sources(name,source_tier))",
  "documents!facts_document_id_fkey!inner(title,sources!inner(name,source_tier,status))",
) + ",countries!inner(slug,name)";

export type OccupationListRow = { id: string; name: string; classification_system: string | null; classification_code: string | null; countries: { slug: string; name: string } | null };
export type OccupationDetailRow = OccupationListRow & {
  evidence_excerpt: string; reviewed_at: string | null;
  documents: { canonical_url: string; retrieved_at: string; title: string | null; sources: { name: string; source_tier: string | null } };
};
