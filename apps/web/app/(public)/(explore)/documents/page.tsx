import Link from "next/link";
import Form from "next/form";
import { connection } from "next/server";
import { searchDocuments } from "@/lib/documents/queries";
import { dateLabel } from "@/lib/registry/domain";
import { pageParam, pageSummary, searchParam, withParams } from "@/lib/pagination";
import { EmptyState, List, ListRow, PageHeader, Pagination, SearchInput } from "@/components/ui";
import { TierBadge } from "@/components/ui/badges";
import { buttonPrimary, textLink } from "@/components/ui/styles";

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  await connection();
  const query = await searchParams;
  const q = searchParam(query);
  const page = pageParam(query);
  const { rows, total } = await searchDocuments(q, page);
  return <>
    <PageHeader eyebrow="Research library" title="Documents"
      description="Source-linked metadata and short excerpts. Storing a document does not verify its claims. Content extraction has not started." />
    <Form action="/documents" className="mb-6 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder="Search by title or URL" /></div>
      <button className={buttonPrimary}>Search</button>
    </Form>
    {!rows.length
      ? (q ? <EmptyState>No documents match “{q}”.</EmptyState>
        : <EmptyState title="No documents yet" action={<Link href="/sources" className={`${textLink} text-[15px]`}>Browse source registry</Link>}>
            Documents will appear once research material has been added from registered sources.
          </EmptyState>)
      : <List label="Documents">{rows.map((document) => <ListRow key={document.id} href={`/documents/${document.id}`}
          title={document.title ?? "Untitled document"}
          badges={<TierBadge tier={document.source.sourceTier} />}
          subtitle={`${document.source.name} · Retrieved ${dateLabel(document.retrievedAt)} · Extraction not started`} />)}</List>}
    <Pagination summary={pageSummary(total, page)} href={(p) => withParams("/documents", query, { page: p })} />
  </>;
}
