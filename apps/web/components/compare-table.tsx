import Link from "next/link";
import { isOfficialStatisticsTier } from "@/lib/labour/domain";
import { Badge } from "@/components/ui";
import { ReviewBadge, TierBadge } from "@/components/ui/badges";

// Shared by /compare and the dev UI preview. Presentation only: callers decide
// which values are public and pass them in already filtered.
export type CompareCountry = { id: string; slug: string; name: string };
export type CompareValue = { id: string; document_id: string; metric_id: string | null; occupation_id?: string | null; country_id: string; predicate?: string; value: string; unit: string | null;
  reference_period: string | null; status: string; created_at: string; evidence: { retrieved_at: string }; documents: { sources: { name: string; source_tier: string | null } } };

const day = (v: string | null) => v ? new Date(v).toISOString().slice(0, 10) : "not available";

// One cell = every public value, each with its own source, tier, period and
// date. Nothing is averaged or chosen; conflicts are shown as such.
export function CompareCell({ values, labour = false }: { values: CompareValue[]; labour?: boolean }) {
  if (!values.length) return <span className="text-[13px] text-ink-3">Chưa có dữ liệu</span>;
  return <ul className="space-y-3">{values.map((v) => <li key={v.id} className="text-[14px] leading-snug">
    {v.predicate && labour && <p className="text-[12px] text-ink-3">{v.predicate}</p>}
    <p className="font-semibold text-ink">{v.value}{v.unit ? ` ${v.unit}` : ""}</p>
    <p className="mt-1 flex flex-wrap items-center gap-1.5">
      {v.reference_period && <Badge tone="accent">{v.reference_period}</Badge>}
      <TierBadge tier={v.documents.sources.source_tier} />
      {v.status === "conflicted" && <ReviewBadge status="conflicted">Mâu thuẫn</ReviewBadge>}
      {labour && !isOfficialStatisticsTier(v.documents.sources.source_tier) && <Badge tone="caution">Không chính thức</Badge>}
    </p>
    <p className="mt-1 text-[12px] text-ink-3">{v.documents.sources.name} · thu thập {day(v.evidence.retrieved_at)} · <Link href={`/documents/${v.document_id}`} className="text-accent hover:underline">Nguồn</Link></p>
  </li>)}</ul>;
}

export function CompareTable({ countries, rows }: { countries: CompareCountry[]; rows: { key: string; head: React.ReactNode; cells: React.ReactNode[] }[] }) {
  // Wide content scrolls horizontally inside its own container on small screens;
  // the first column stays pinned so each row remains identifiable.
  return <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-hairline">
    <table className="w-full min-w-[640px] border-collapse text-left">
      <thead><tr className="border-b border-hairline">
        <th scope="col" className="sticky left-0 z-10 w-56 bg-surface px-5 py-3 text-[13px] font-medium text-ink-3">Tiêu chí</th>
        {countries.map((c) => <th key={c.id} scope="col" className="px-5 py-3 text-[15px] font-semibold text-ink"><Link href={`/countries/${c.slug}`} className="hover:underline">{c.name}</Link></th>)}
      </tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key} className="border-b border-hairline align-top last:border-b-0">
        <th scope="row" className="sticky left-0 z-10 w-56 bg-surface px-5 py-4 text-[14px] font-medium text-ink">{r.head}</th>
        {r.cells.map((cell, i) => <td key={i} className="px-5 py-4">{cell}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}
