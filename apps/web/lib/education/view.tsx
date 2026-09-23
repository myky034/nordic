import { ExternalLink, Quote } from "@/components/ui";
import { TierBadge } from "@/components/ui/badges";

// PostgREST select strings. FK hints (!constraint_name) are explicit because
// documents is referenced by several tables (facts, evidence, universities,
// programmes); an unhinted embed could become ambiguous as the schema grows.
const evidenceDocument = "canonical_url,retrieved_at,title,sources(name,source_tier)";
export const programmeListSelect =
  "id,name,degree_type,field,language,official_url,universities!programmes_university_id_fkey!inner(id,name,status,countries!inner(slug,name))";
export const programmeDetailSelect =
  `id,name,degree_type,field,language,official_url,application_url,evidence_excerpt,reviewed_at,universities!programmes_university_id_fkey!inner(id,name,official_url,status,countries(slug,name)),documents!programmes_document_id_fkey(${evidenceDocument})`;
export const universityListSelect =
  `id,name,official_url,evidence_excerpt,reviewed_at,countries!inner(slug,name),documents!universities_document_id_fkey(${evidenceDocument})`;

export type EvidenceDocument = { canonical_url: string; retrieved_at: string; title: string | null; sources: { name: string; source_tier: string | null } };
export type ProgrammeListRow = {
  id: string; name: string; degree_type: string; field: string | null; language: string | null; official_url: string;
  universities: { id: string; name: string; status: string; countries: { slug: string; name: string } };
};
export type ProgrammeDetailRow = Omit<ProgrammeListRow, "universities"> & {
  application_url: string | null; evidence_excerpt: string; reviewed_at: string | null;
  universities: { id: string; name: string; official_url: string; status: string; countries: { slug: string; name: string } };
  documents: EvidenceDocument;
};
export type UniversityRow = {
  id: string; name: string; official_url: string; evidence_excerpt: string; reviewed_at: string | null;
  countries: { slug: string; name: string }; documents: EvidenceDocument;
};

const day = (value: string | null) => value ? new Date(value).toISOString().slice(0, 10) : "not available";

// "Why do we believe this entity exists?" — the document, source, tier and
// retrieval date behind it (AGENTS.md Section 23). It says nothing about
// tuition, deadlines or current validity; those are separate facts.
export function ExistenceEvidence({ excerpt, document, reviewedAt }: { excerpt: string; document: EvidenceDocument; reviewedAt: string | null }) {
  return <div className="space-y-3">
    <Quote>{excerpt}</Quote>
    <p className="flex flex-wrap items-center gap-2 text-[15px] text-ink">Source: {document.sources.name} <TierBadge tier={document.sources.source_tier} /></p>
    <p className="text-[13px] text-ink-3">Retrieved: {day(document.retrieved_at)} · Evidence reviewed: {day(reviewedAt)} · <ExternalLink href={document.canonical_url}>Open original source</ExternalLink></p>
  </div>;
}
