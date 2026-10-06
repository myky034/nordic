import Link from "next/link";
import Form from "next/form";
import { connection } from "next/server";
import { searchDocuments } from "@/lib/documents/queries";
import { dateLabel } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

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
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.documents, dict.common];
  return <>
    <PageHeader eyebrow={c.evidence} title={t.title} description={t.description} />
    <Form action="/documents" className="mb-6 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder={t.searchPlaceholder} /></div>
      <button className={buttonPrimary}>Tìm</button>
    </Form>
    {!rows.length
      ? (q ? <EmptyState>{t.noMatch(q)}</EmptyState>
        : <EmptyState title={t.emptyTitle} action={<Link href="/sources" className={`${textLink} text-[15px]`}>{t.seeSources}</Link>}>
            {t.emptyText}
          </EmptyState>)
      : <List label={t.title}>{rows.map((document) => <ListRow key={document.id} href={`/documents/${document.id}`}
          title={document.title ?? c.untitledDocument}
          badges={<TierBadge tier={document.source.sourceTier} locale={locale} />}
          subtitle={t.retrievedFrom(document.source.name, dateLabel(document.retrievedAt, locale))} />)}</List>}
    <Pagination summary={pageSummary(total, page)} href={(p) => withParams("/documents", query, { page: p })} locale={locale} />
  </>;
}
