import { redirect } from "next/navigation";
import Link from "next/link";
import Form from "next/form";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { countryName, countrySlugs, verificationLabel } from "@/lib/registry/domain";
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
    <PageHeader eyebrow="Làm việc & Visa" title="Quy định nhập cư" description="Quy định về giấy phép du học, lao động và cư trú, chỉ lấy từ trang của cơ quan nhà nước (nguồn T1) đã được xác minh." />
    <div className="-mt-4 mb-10"><LegalDisclaimer /></div>
    <Form action="/immigration" className={filterBar}>
      <div className="sm:col-span-2 lg:col-span-4"><SearchInput defaultValue={q} placeholder="Tên quy định" /></div>
      <Field label="Quốc gia"><select name="country" defaultValue={filters.country} className={control}><option value="">Tất cả quốc gia</option>{countrySlugs.map((slug) => <option key={slug} value={slug}>{countryName(slug, slug)}</option>)}</select></Field>
      <Field label="Loại quy định"><select name="type" defaultValue={filters.type} className={control}><option value="">Tất cả loại</option>{Object.entries(ruleTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <div className="flex items-center gap-4"><button className={buttonPrimary}>Lọc</button><Link href="/immigration" className={`${textLink} text-[15px]`}>Bỏ lọc</Link></div>
    </Form>
    {list.length
      ? <List label="Quy định nhập cư">{list.map((r) => <ListRow key={r.id} href={`/immigration/${r.id}`} title={r.title}
          badges={<Badge tone="accent">{ruleTypeLabel(r.rule_type)}</Badge>}
          subtitle={`${countryName(r.countries.slug, r.countries.name)} · ${r.documents.sources.name} (T1) · Nguồn xác minh ${day(r.documents.sources.last_verified_at)}`} />)}</List>
      : <EmptyState>Chưa có quy định nào đã duyệt và có nguồn nhà nước đã xác minh cho lựa chọn này. Hãy xem trang của các cơ quan di trú bên dưới; ở đây không có gì được suy đoán.</EmptyState>}
    <Pagination summary={pageSummary(ruleResult.count ?? list.length, page)} href={(p) => withParams("/immigration", params, { page: p })} />
    <Section title="Cơ quan di trú (nguồn T1)">
      {authorityList.length
        ? <List label="Cơ quan di trú">{authorityList.map((a) => <ListRow key={a.id} title={a.name}
            badges={<SourceStatusBadge status={a.status}>{verificationLabel(a.status, a.last_verified_at ? new Date(a.last_verified_at) : null)}</SourceStatusBadge>}
            subtitle={<><ExternalLink quiet href={a.canonical_url}>{a.canonical_url}</ExternalLink> · {countryName(a.countries.slug, a.countries.name)} · xác minh gần nhất {day(a.last_verified_at)}</>} />)}</List>
        : <EmptyState>Chưa có cơ quan di trú (T1) nào được đăng ký cho lựa chọn này.</EmptyState>}
    </Section>
  </>;
}
