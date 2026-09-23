import Link from "next/link";
import { notFound } from "next/navigation";
import { getDocument, documentVersions } from "@/lib/documents/queries";
import { canonicalSourceUrl, dateLabel, tierLabel } from "@/lib/registry/domain";

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  const document = await getDocument(id);
  if (!document) notFound();
  const versions = await documentVersions(document.sourceId, document.canonicalUrl);
  const url = canonicalSourceUrl(document.canonicalUrl);
  const sourceUrl = canonicalSourceUrl(document.source.canonicalUrl);
  return <>
    <Link href="/documents" className="text-sm text-zinc-500">← All documents</Link>
    <h1 className="mt-6 break-words text-3xl font-semibold tracking-tight">{document.title ?? "Untitled document"}</h1>
    <p className="mt-3 text-sm text-zinc-500">Metadata stored · Extraction not started · Claims not verified</p>
    {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block break-all underline underline-offset-4">Read original: {url}<span className="sr-only"> (opens in a new tab)</span></a>}
    <dl className="my-8 grid gap-6 rounded-2xl bg-zinc-50 p-6 text-sm sm:grid-cols-2 dark:bg-zinc-900">
      <Field label="Source">{sourceUrl ? <a href={sourceUrl} className="underline">{document.source.name}</a> : document.source.name}</Field>
      <Field label="Source tier">{tierLabel(document.source.sourceTier)}</Field>
      <Field label="Retrieved">{dateLabel(document.retrievedAt)}</Field>
      <Field label="Published">{dateLabel(document.publishedAt)}</Field>
      <Field label="Source updated">{dateLabel(document.sourceUpdatedAt)}</Field>
      <Field label="Document type">{document.documentType}</Field>
      <Field label="Document verification">Not verified; current validity unknown</Field>
      <Field label="Registry metadata last reviewed">{dateLabel(document.source.lastVerifiedAt)}</Field>
    </dl>
    <Link href={`/facts/workspace?document=${id}`} className="mb-8 inline-block rounded-lg border px-5 py-3">Thêm thông tin & bằng chứng</Link>
    <h2 className="text-xl font-medium">Source excerpt</h2>
    {document.excerpt ? <blockquote className="mt-4 whitespace-pre-wrap break-words border-l-2 pl-5 leading-7">{document.excerpt}</blockquote> : <p className="mt-3 text-sm text-zinc-500">No excerpt supplied. Read the original source for context.</p>}
    <p className="mt-3 text-sm text-zinc-500">An excerpt records source text; it is not a verified fact or legal advice.</p>
    <h2 className="mt-10 text-xl font-medium">Recorded versions</h2>
    <p className="mt-2 text-sm text-zinc-500">Versions preserve changes without selecting one as authoritative.{versions.length > 20 ? " Showing the 20 most recently retrieved versions." : ""}</p>
    <ul className="mt-4 space-y-3">{versions.slice(0, 20).map((version) => <li key={version.id}><Link href={`/documents/${version.id}`} aria-current={version.id === id ? "page" : undefined} className="text-sm underline">Retrieved {dateLabel(version.retrievedAt)} · {version.contentHash.slice(0, 12)}{version.id === id ? " · This version" : ""}</Link></li>)}</ul>
  </>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-zinc-500">{label}</dt><dd className="mt-1">{children}</dd></div>;
}
