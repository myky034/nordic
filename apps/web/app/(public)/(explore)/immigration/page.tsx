import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { countrySlugs, verificationLabel } from "@/lib/registry/domain";
import { immigrationFilters, ruleTypeLabel, ruleTypes } from "@/lib/immigration/domain";
import { authoritySelect, day, LegalDisclaimer, ruleListSelect, type AuthorityRow, type RuleListRow } from "@/lib/immigration/view";
import { Badge, EmptyState, ExternalLink, Field, List, ListRow, PageHeader, Pagination, SearchInput, Section, filterBar } from "@/components/ui";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { likePattern } from "@/lib/education/domain";
import { SourceStatusBadge } from "@/components/ui/badges";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";

export default async function ImmigrationPage({ searchParams }: PageProps<"/immigration">) {
  const params = await searchParams;
  const filters = immigrationFilters(params);
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  let rules = client.from("immigration_rules").select(ruleListSelect, { count: "exact" }).eq("status", "reviewed")
    .eq("documents.sources.status", "verified").eq("documents.sources.source_tier", "T1");
  if (filters.country) rules = rules.eq("countries.slug", filters.country);
  if (filters.type) rules = rules.eq("rule_type", filters.type);
  if (q) rules = rules.ilike("title", likePattern(q));
  // Registered T1 immigration authorities, so the official site is always one
  // click away even when no rule has been reviewed yet.
  let authorities = client.from("sources").select(authoritySelect).eq("source_type", "immigration_authority").eq("source_tier", "T1");
  if (filters.country) authorities = authorities.eq("countries.slug", filters.country);
  const [ruleResult, authorityResult] = await Promise.all([
    rules.order("title", { ascending: true }).range(from, to),
    authorities.order("name", { ascending: true }).limit(50),
  ]);
  if (isPastLastPage(ruleResult.error)) redirect(withParams("/immigration", params, { page: null }));
  if (ruleResult.error || authorityResult.error) { logAccessError("public_immigration"); throw new Error("Không tải được thông tin nhập cư."); }
  const list = (ruleResult.data ?? []) as unknown as RuleListRow[];
  const authorityList = authorityResult.data as unknown as AuthorityRow[];
  return <>
    <PageHeader eyebrow="Immigration" title="Residence and permit rules" />
    <div className="-mt-4 mb-10"><LegalDisclaimer /></div>
    <Form action="/immigration" className={filterBar}>
      <div className="sm:col-span-2 lg:col-span-4"><SearchInput defaultValue={q} placeholder="Search rule names" /></div>
      <Field label="Country"><select name="country" defaultValue={filters.country} className={control}><option value="">All countries</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{slug[0].toUpperCase() + slug.slice(1)}</option>)}</select></Field>
      <Field label="Rule type"><select name="type" defaultValue={filters.type} className={control}><option value="">All types</option>{Object.entries(ruleTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Apply</button><Link href="/immigration" className={`${textLink} text-[15px]`}>Reset</Link></div>
    </Form>
    {list.length
      ? <List label="Immigration rules">{list.map((r) => <ListRow key={r.id} href={`/immigration/${r.id}`} title={r.title}
          badges={<Badge tone="accent">{ruleTypeLabel(r.rule_type)}</Badge>}
          subtitle={`${r.countries.name} · ${r.documents.sources.name} (T1) · Source last verified ${day(r.documents.sources.last_verified_at)}`} />)}</List>
      : <EmptyState>No reviewed rules backed by a verified official source for this selection yet. Use the official authority links below. Nothing here is inferred.</EmptyState>}
    <Pagination summary={pageSummary(ruleResult.count ?? list.length, page)} href={(p) => withParams("/immigration", params, { page: p })} />
    <Section title="Official immigration authorities">
      {authorityList.length
        ? <List label="Authorities">{authorityList.map((a) => <ListRow key={a.id} title={a.name}
            badges={<SourceStatusBadge status={a.status}>{verificationLabel(a.status, a.last_verified_at ? new Date(a.last_verified_at) : null)}</SourceStatusBadge>}
            subtitle={<><ExternalLink quiet href={a.canonical_url}>{a.canonical_url}</ExternalLink> · {a.countries.name} · last registry verification {day(a.last_verified_at)}</>} />)}</List>
        : <EmptyState>No T1 immigration authority registered for this selection.</EmptyState>}
    </Section>
  </>;
}
