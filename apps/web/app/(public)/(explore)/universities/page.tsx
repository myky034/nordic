import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { countryName, countrySlugs } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { likePattern, programmeFilters } from "@/lib/education/domain";
import { universityListSelect, type UniversityRow } from "@/lib/education/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { Chevron, EmptyState, Field, PageHeader, Pagination, SearchInput, filterBar } from "@/components/ui";
import { TierBadge } from "@/components/ui/badges";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";
import { hostLabel } from "../source-list";

export default async function UniversitiesPage({ searchParams }: PageProps<"/universities">) {
  const params = await searchParams;
  const { country } = programmeFilters(params);
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  let query = client.from("universities").select(universityListSelect, { count: "exact" }).eq("status", "reviewed");
  if (country) query = query.eq("countries.slug", country);
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/universities", params, { page: null }));
  if (error) { logAccessError("public_universities"); throw new Error("Không tải được danh sách trường."); }
  const universities = (data ?? []) as unknown as UniversityRow[];
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, c] = [dict.universities, dict.common];
  return <>
    <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <Form action="/universities" className={filterBar}>
      <div className="sm:col-span-2"><Field label={c.search}><div className="mt-1.5"><SearchInput defaultValue={q} placeholder={t.namePlaceholder} /></div></Field></div>
      <Field label={c.country}><select name="country" defaultValue={country} className={control}><option value="">{c.allCountries}</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{dict.countryNames[slug]}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>{c.filter}</button><Link href="/universities" className={`${textLink} text-[15px]`}>{c.clearFilter}</Link></div>
    </Form>
    {/* Card grid (pattern 5 in /dev/preview/patterns): a visitor scans and picks. */}
    {universities.length
      ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{universities.map((u) => <Link key={u.id} href={`/universities/${u.id}`}
          className="group flex flex-col rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{countryName(u.countries.slug, u.countries.name, locale)}</p>
          <h2 className="mt-1 text-[18px] font-semibold leading-snug text-ink">{u.name}</h2>
          <p className="mt-2 truncate text-[14px] text-ink-2">{hostLabel(u.official_url) ?? u.official_url}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[14px]">
            <span className="flex items-center gap-2 text-[12px] text-ink-3">{c.sourceWord} <TierBadge tier={u.documents.sources.source_tier} locale={locale} /></span>
            <span className="inline-flex items-center gap-1 font-medium text-accent">{c.viewDetails}<Chevron className="text-accent transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>)}</div>
      : <EmptyState>{t.empty}</EmptyState>}
    <Pagination summary={pageSummary(count ?? universities.length, page)} href={(p) => withParams("/universities", params, { page: p })} locale={locale} />
  </>;
}
