import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { logAccessError } from "@/lib/rbac/access";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { canOpenFactsWorkspace, seesInternalDetails } from "@/lib/rbac/ui";
import { countrySlugs } from "@/lib/registry/domain";
import { likePattern } from "@/lib/education/domain";
import { groupLabel, otherGroup, questionGroups, readQuestionGroup, topicFilter } from "@/lib/countries/overview";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { EmptyState, Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { buttonPrimary, buttonSecondary, control, textLink } from "@/components/ui/styles";

export default async function Page({ searchParams }: PageProps<"/facts">) {
  const query = await searchParams;
  const q = searchParam(query);
  const country = typeof query.country === "string" && countrySlugs.some((s) => s === query.country) ? query.country : "";
  const group = readQuestionGroup(query.group);
  const page = pageParam(query);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  // Explicit public statuses even for editors: the public page never shows drafts.
  let request = client.from("facts").select(country ? `${factSelect},countries!inner(slug)` : factSelect, { count: "exact" })
    .in("status", ["reviewed", "conflicted"]);
  if (country) request = request.eq("countries.slug", country);
  if (q) request = request.ilike("subject", likePattern(q));
  // Same visitor-question groups as the country page (lib/countries/overview.ts).
  if (group) {
    const f = topicFilter(group);
    request = "in" in f ? request.in("topic", f.in) : request.not("topic", "in", `(${f.notIn.join(",")})`);
  }
  const { data, error, count } = await request.order("created_at", { ascending: false }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/facts", query, { page: null }));
  if (error) { logAccessError("public_facts"); throw new Error("Không tải được thông tin."); }
  const facts = (data ?? []) as unknown as FactRow[];
  const canEdit = canOpenFactsWorkspace(await viewerPermissions());
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.facts, dict.common];
  return <>
    <PageHeader eyebrow={c.evidence} title={t.title} description={t.description}
      actions={canEdit ? <Link href="/facts/workspace" className={buttonSecondary}>{t.edit}</Link> : undefined} />
    <Form action="/facts" className={filterBar}>
      <div className="sm:col-span-2"><Field label={t.searchLabel}><div className="mt-1.5"><SearchInput defaultValue={q} placeholder={t.searchPlaceholder} /></div></Field></div>
      <Field label={c.country}><select name="country" defaultValue={country} className={control}><option value="">{c.all}</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{dict.countryNames[slug]}</option>)}</select></Field>
      <Field label={t.topic}><select name="group" defaultValue={group ?? ""} className={control}><option value="">{c.all}</option>{[...questionGroups, otherGroup].map((g) => <option key={g.key} value={g.key}>{groupLabel(g.key, locale)}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>{c.filter}</button><Link href="/facts" className={`${textLink} text-[15px]`}>{c.clearFilter}</Link></div>
    </Form>
    {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} internal={internal} locale={locale} />)}</div>
      : <EmptyState>{t.empty(Boolean(q || country || group))}</EmptyState>}
    <Pagination summary={pageSummary(count ?? facts.length, page)} href={(p) => withParams("/facts", query, { page: p })} locale={locale} />
  </>;
}
