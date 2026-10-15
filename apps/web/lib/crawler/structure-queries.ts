import "server-only";
import type { accessContext } from "@/lib/rbac/access";
import { STRUCTURE_FORMAT } from "@nordic/db/document-structure";

// PR 1.5: every read of the structure preview, through the VIEWER's Supabase
// client, so RLS decides what comes back (no service-role key anywhere).
// Read-only: selects only.
type Client = Awaited<ReturnType<typeof accessContext>>["client"];

export type PreviewDocument = { id: string; source_id: string; canonical_url: string; title: string | null; retrieved_at: string; ingestion_method: string; sources: { name: string } | null };
export type SnapshotMeta = { id: string; document_id: string; format_version: string; structure_hash: string; captured_at: string; crawler_run_id: string; created_at: string };
export type SnapshotRow = SnapshotMeta & { structure: unknown };
export type PreviewFact = { id: string; status: string; value: string; unit: string | null; value_number: number | string | null; value_currency: string | null;
  value_period: string | null; value_date: string | null; fact_types: { label_vi: string; label_en: string } | null };
export type CrawlAttempt = { created_at: string; outcome: string; http_status: number | null; error_category: string | null; crawler_runs: { status: string; note: string | null } | null };

const META = "id,document_id,format_version,structure_hash,captured_at,crawler_run_id,created_at";
const fail = (what: string, error: { message: string } | null) => { if (error) throw new Error(`structure_preview_${what}: ${error.message}`); };

export async function loadPreviewDocument(client: Client, id: string) {
  const doc = await client.from("documents").select("id,source_id,canonical_url,title,retrieved_at,ingestion_method,sources(name)").eq("id", id).maybeSingle();
  fail("document", doc.error);
  return doc.data as unknown as PreviewDocument | null;
}

/**
 * Snapshots of the document (newest first, the view's order), the chosen one
 * (by id, or the latest through document_structures_latest), the comparison
 * snapshot (any version of the same page), the page's versions, facts from
 * this document, and — for crawler operators — the URL's latest crawl attempts.
 */
export async function loadPreview(client: Client, doc: PreviewDocument, opts: { snapshotId?: string; compareId?: string; crawlerOperator: boolean }) {
  const [versions, snapshots, facts, attempts] = await Promise.all([
    client.from("documents").select("id,retrieved_at").eq("source_id", doc.source_id).eq("canonical_url", doc.canonical_url).order("retrieved_at", { ascending: false }),
    client.from("document_structures").select(META).eq("document_id", doc.id).order("captured_at", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }),
    client.from("facts").select("id,status,value,unit,value_number,value_currency,value_period,value_date,fact_types(label_vi,label_en)").eq("document_id", doc.id).neq("status", "rejected").order("created_at"),
    opts.crawlerOperator
      ? client.from("crawler_run_items").select("created_at,outcome,http_status,error_category,crawler_runs(status,note)").eq("url", doc.canonical_url).order("created_at", { ascending: false }).limit(3)
      : Promise.resolve({ data: [], error: null }),
  ]);
  fail("versions", versions.error); fail("snapshots", snapshots.error); fail("facts", facts.error); fail("attempts", attempts.error);
  const versionRows = versions.data as { id: string; retrieved_at: string }[];
  // The chosen snapshot must belong to this document; the comparison one to any version of the page.
  const current = opts.snapshotId
    ? await client.from("document_structures").select(`${META},structure`).eq("id", opts.snapshotId).eq("document_id", doc.id).maybeSingle()
    : await client.from("document_structures_latest").select(`${META},structure`).eq("document_id", doc.id).eq("format_version", STRUCTURE_FORMAT).maybeSingle();
  fail("current", current.error);
  const compare = opts.compareId
    ? await client.from("document_structures").select(`${META},structure`).eq("id", opts.compareId).in("document_id", versionRows.map((v) => v.id)).maybeSingle()
    : { data: null, error: null };
  fail("compare", compare.error);
  // Comparison candidates: the latest snapshot of each OTHER version of the page.
  const others = versionRows.filter((v) => v.id !== doc.id).map((v) => v.id);
  const otherLatest = others.length
    ? await client.from("document_structures_latest").select(META).in("document_id", others).eq("format_version", STRUCTURE_FORMAT)
    : { data: [], error: null };
  fail("other_versions", otherLatest.error);
  return {
    versions: versionRows,
    snapshots: snapshots.data as SnapshotMeta[],
    current: current.data as SnapshotRow | null,
    compare: compare.data as SnapshotRow | null,
    otherLatest: (otherLatest.data ?? []) as SnapshotMeta[],
    facts: facts.data as unknown as PreviewFact[],
    attempts: attempts.data as unknown as CrawlAttempt[],
  };
}
