import Link from "next/link";
import { connection } from "next/server";
import { listDocuments } from "@/lib/documents/queries";
import { dateLabel, tierLabel } from "@/lib/registry/domain";

export default async function DocumentsPage() {
  await connection();
  const documents = await listDocuments();
  return <>
    <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">Research library</p>
    <h1 className="mt-3 text-4xl font-semibold tracking-tight">Documents</h1>
    <p className="mt-4 max-w-2xl leading-7 text-zinc-500">Source-linked metadata and short excerpts. Storing a document does not verify its claims. Content extraction has not started.</p>
    {!documents.length ? <div className="mt-10 rounded-2xl border border-dashed p-8"><h2 className="text-lg font-medium">No documents yet</h2><p className="mt-2 text-sm text-zinc-500">Documents will appear once research material has been added from registered sources.</p><Link href="/sources" className="mt-5 inline-block text-sm underline">Browse source registry</Link></div> : <>
      <p className="mt-8 text-sm text-zinc-500">{documents.length > 100 ? "Showing the latest 100 document versions." : `${documents.length} document versions`}</p>
      <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">{documents.slice(0, 100).map((document) => <article key={document.id} className="py-6"><Link href={`/documents/${document.id}`} className="text-xl font-medium underline-offset-4 hover:underline">{document.title ?? "Untitled document"}</Link><p className="mt-2 text-sm text-zinc-500">{document.source.name} · {tierLabel(document.source.sourceTier)}</p><p className="mt-3 text-sm">Retrieved: {dateLabel(document.retrievedAt)} · Metadata stored · Extraction not started</p></article>)}</div>
    </>}
  </>;
}
