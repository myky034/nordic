import Link from "next/link";
import Form from "next/form";
import { createPublicClient } from "@/lib/supabase/public";
import { logAccessError } from "@/lib/rbac/access";
import { countrySlugs } from "@/lib/registry/domain";
import { buildCells, categoryParam, compareCountries, compareHref, MAX_COUNTRIES, metricCategories } from "@/lib/compare/domain";
import { ruleTypes } from "@/lib/immigration/domain";
import { uuidPattern } from "@/lib/documents/domain";
import { EmptyState, Field, Notice, PageHeader, Section, Segmented, filterBar } from "@/components/ui";
import { CompareCell, CompareTable, type CompareCountry, type CompareValue } from "@/components/compare-table";
import { buttonPrimary, control, textLink } from "@/components/ui/styles";

type Country = CompareCountry;
type Metric = { id: string; label: string; description: string; unit_hint: string | null; category: string };
type Value = CompareValue;
type Rule = { id: string; title: string; rule_type: string; country_id: string; documents: { sources: { last_verified_at: string | null } } };

const valueSelect = "id,document_id,metric_id,occupation_id,country_id,predicate,value,unit,reference_period,status,created_at,evidence(retrieved_at),documents!facts_document_id_fkey(sources(name,source_tier))";
const day = (v: string | null) => v ? new Date(v).toISOString().slice(0, 10) : "not available";
const name = (slug: string) => slug[0].toUpperCase() + slug.slice(1);
const Cell = CompareCell;

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const query = await searchParams;
  const { countries: slugs, ready } = compareCountries(query);
  const category = categoryParam(query);
  const occupationId = typeof query.occupation === "string" && uuidPattern.test(query.occupation) ? query.occupation : "";
  // Anonymous client: the comparison shows exactly the public view.
  const db = createPublicClient();
  const [countriesResult, metricsResult, occupationsResult] = await Promise.all([
    db.from("countries").select("id,slug,name").in("slug", slugs.length ? slugs : ["-"]),
    db.from("comparison_metrics").select("id,label,description,unit_hint,category").eq("active", true).order("category").order("label"),
    db.from("occupations").select("id,name").eq("status", "reviewed").order("name").limit(200),
  ]);
  if (countriesResult.error || metricsResult.error || occupationsResult.error) { logAccessError("compare_setup"); throw new Error("Không tải được dữ liệu so sánh."); }
  const countries = slugs.map((s) => (countriesResult.data as Country[]).find((c) => c.slug === s)).filter(Boolean) as Country[];
  const allMetrics = metricsResult.data as Metric[];
  const metrics = category ? allMetrics.filter((m) => m.category === category) : allMetrics;
  const occupations = occupationsResult.data as { id: string; name: string }[];
  const extra = { category, occupation: occupationId };

  const selector = <Form action="/compare" className={filterBar}>
    <fieldset className="sm:col-span-2 lg:col-span-3">
      <legend className="text-[13px] font-medium text-ink-2">Quốc gia (chọn 2–{MAX_COUNTRIES})</legend>
      <div className="mt-2 flex flex-wrap gap-2">{countrySlugs.map((slug) => <label key={slug} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-fill px-3.5 py-1.5 text-[14px] has-[:checked]:bg-accent has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50">
        <input type="checkbox" name="c" value={slug} defaultChecked={slugs.includes(slug)} className="sr-only" />{name(slug)}
      </label>)}</div>
    </fieldset>
    {category && <input type="hidden" name="category" value={category} />}
    {occupationId && <input type="hidden" name="occupation" value={occupationId} />}
    <div className="flex items-end"><button className={buttonPrimary}>So sánh</button></div>
  </Form>;

  const header = <PageHeader eyebrow="Country comparison" title="Compare countries"
    description="Side by side, every value keeps its own source, tier, period and date. There is no overall score or ranking." />;
  if (!ready) return <>
    {header}{selector}
    <EmptyState title="Chọn ít nhất 2 quốc gia">Ví dụ: <Link href={compareHref(["sweden", "denmark"])} className={textLink}>Sweden và Denmark</Link>.</EmptyState>
  </>;

  const ids = countries.map((c) => c.id);
  const [valuesResult, rulesResult, figuresResult, ...educationCounts] = await Promise.all([
    metrics.length ? db.from("facts").select(valueSelect).in("metric_id", metrics.map((m) => m.id)).in("country_id", ids).in("status", ["reviewed", "conflicted"]).limit(1000)
      : Promise.resolve({ data: [], error: null }),
    db.from("immigration_rules").select("id,title,rule_type,country_id,documents!immigration_rules_document_id_fkey(sources(last_verified_at))").in("country_id", ids).eq("status", "reviewed").order("title").limit(500),
    occupationId ? db.from("facts").select(valueSelect).eq("occupation_id", occupationId).in("country_id", ids).in("status", ["reviewed", "conflicted"]).limit(500)
      : Promise.resolve({ data: [], error: null }),
    ...ids.flatMap((id) => [
      db.from("universities").select("id", { count: "exact", head: true }).eq("country_id", id).eq("status", "reviewed"),
      db.from("programmes").select("id,universities!programmes_university_id_fkey!inner(country_id)", { count: "exact", head: true }).eq("universities.country_id", id).eq("status", "reviewed"),
    ]),
  ]);
  if (valuesResult.error || rulesResult.error || figuresResult.error || educationCounts.some((r) => r.error)) { logAccessError("compare_values"); throw new Error("Không tải được dữ liệu so sánh."); }
  const cells = buildCells(valuesResult.data as unknown as Value[]);
  const rules = rulesResult.data as unknown as Rule[];
  const figures = figuresResult.data as unknown as Value[];
  const countOf = (i: number, kind: 0 | 1) => educationCounts[i * 2 + kind].count ?? 0;
  const usedCategories = [...new Set(allMetrics.map((m) => m.category))];

  return <>
    {header}{selector}
    <Notice tone="neutral">Giá trị từ các nguồn, kỳ số liệu và đơn vị khác nhau không được quy đổi; đừng so sánh trực tiếp khi kỳ hoặc đơn vị khác nhau. Thông tin nghiên cứu, không phải tư vấn.</Notice>

    <Section title="Chỉ số" description="Mỗi ô liệt kê mọi giá trị đã duyệt cho quốc gia đó, mới nhất trước.">
      {usedCategories.length > 1 && <Segmented label="Nhóm chỉ số" items={[
        { href: compareHref(slugs, { ...extra, category: "" }), label: "Tất cả", active: !category },
        ...usedCategories.map((c) => ({ href: compareHref(slugs, { ...extra, category: c }), label: metricCategories[c as keyof typeof metricCategories] ?? c, active: category === c })),
      ]} />}
      {metrics.length ? <CompareTable countries={countries} rows={metrics.map((m) => ({
        key: m.id,
        head: <><span>{m.label}</span>{m.unit_hint && <span className="block text-[12px] font-normal text-ink-3">{m.unit_hint}</span>}<span className="mt-1 block text-[12px] font-normal leading-snug text-ink-3">{m.description}</span></>,
        cells: countries.map((c) => <Cell key={c.id} values={cells.get(`${m.id}:${c.id}`) ?? []} />),
      }))} /> : <EmptyState>Chưa có chỉ số so sánh nào. Quản trị viên định nghĩa chỉ số tại Quản trị → Chỉ số so sánh; không có chỉ số nào được tạo sẵn.</EmptyState>}
    </Section>

    <Section title="Quy định nhập cư" description="Quy định đã duyệt, từ nguồn T1 đã xác minh. Chỉ cho biết quy định tồn tại; xem điều kiện ở trang chi tiết.">
      <CompareTable countries={countries} rows={Object.entries(ruleTypes).map(([type, label]) => ({
        key: type, head: label,
        cells: countries.map((c) => {
          const list = rules.filter((r) => r.country_id === c.id && r.rule_type === type);
          return list.length ? <ul key={c.id} className="space-y-2">{list.map((r) => <li key={r.id} className="text-[14px]">
            <Link href={`/immigration/${r.id}`} className="text-accent hover:underline">{r.title}</Link>
            <span className="block text-[12px] text-ink-3">Nguồn xác minh {day(r.documents.sources.last_verified_at)}</span></li>)}</ul>
            : <span key={c.id} className="text-[13px] text-ink-3">Chưa có dữ liệu</span>;
        }),
      }))} />
    </Section>

    <Section title="Nghề nghiệp" description="Chọn một nghề để xem số liệu đã duyệt của nghề đó ở từng quốc gia.">
      <Form action="/compare" className="mb-4 flex flex-wrap items-end gap-3">
        {slugs.map((s) => <input key={s} type="hidden" name="c" value={s} />)}{category && <input type="hidden" name="category" value={category} />}
        <Field label="Nghề" className="min-w-64 flex-1"><select name="occupation" defaultValue={occupationId} className={control}><option value="">Chọn nghề</option>{occupations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
        <button className={buttonPrimary}>Xem</button>
      </Form>
      {occupationId ? <CompareTable countries={countries} rows={[{
        key: "figures", head: occupations.find((o) => o.id === occupationId)?.name ?? "Nghề",
        cells: countries.map((c) => <Cell key={c.id} labour values={figures.filter((f) => f.country_id === c.id).sort((a, b) => (b.reference_period ?? "").localeCompare(a.reference_period ?? ""))} />),
      }]} /> : occupations.length ? null : <EmptyState>Chưa có nghề nào được duyệt.</EmptyState>}
    </Section>

    <Section title="Giáo dục trong Nordic" description="Số mục đã được duyệt trong hệ thống — không phải tổng số trường hay chương trình thực tế của quốc gia.">
      <CompareTable countries={countries} rows={[
        { key: "u", head: "Trường đã duyệt", cells: countries.map((c, i) => <Link key={c.id} href={`/universities?country=${c.slug}`} className="text-[15px] text-accent hover:underline">{countOf(i, 0)}</Link>) },
        { key: "p", head: "Chương trình đã duyệt", cells: countries.map((c, i) => <Link key={c.id} href={`/programmes?country=${c.slug}`} className="text-[15px] text-accent hover:underline">{countOf(i, 1)}</Link>) },
      ]} />
    </Section>
  </>;
}
