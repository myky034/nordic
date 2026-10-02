import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { getCountry } from "@/lib/registry/queries";
import { countryName, countryStatusLabels } from "@/lib/registry/domain";
import { createClient } from "@/lib/supabase/server";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { countLine, latestReview, openGroup, otherGroup, questionGroups, topicFilter, type GroupKey } from "@/lib/countries/overview";
import { withParams } from "@/lib/pagination";
import { logAccessError } from "@/lib/rbac/access";
import { Badge, BackLink, Chevron, PageHeader, Section, Segmented } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { TopicCard } from "./topic-card";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { canOpenFactsWorkspace, seesInternalDetails } from "@/lib/rbac/ui";

// A country overview (design A, 2026-10-02): what Nordic already holds about
// the country — counted per topic with the same public conditions as the list
// each card links to — then reviewed facts grouped by the question a visitor
// comes with (lib/countries/overview.ts), one question per tab (?group=). Each
// fact card carries its own source (AGENTS.md §23); the country's full source
// list is one link away on /sources, not repeated here (owner, 2026-10-02).
// Only reviewed, evidence-backed content is shown; no overview text, cost of
// living or ranking is ever written here (AGENTS.md §1.1).
export default async function CountryPage({ params, searchParams }: PageProps<"/countries/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const country = await getCountry(slug);
  if (!country) notFound();

  // Same public read path as /facts (Supabase client + RLS). Every count adds
  // the explicit public conditions of its list page, so an editor (who sees
  // drafts through RLS) gets the public numbers too.
  const client = await createClient();
  // One query per question: its newest five facts plus the total, for the
  // tab counts and "Xem tất cả N". All tabs are loaded so switching is a
  // plain link and every count is real.
  const groupKeys: GroupKey[] = [...questionGroups.map((g) => g.key), otherGroup.key];
  const groupQuery = (key: GroupKey) => {
    const q = client.from("facts").select(factSelect, { count: "exact" }).eq("country_id", country.id).in("status", ["reviewed", "conflicted"]);
    const f = topicFilter(key);
    return ("in" in f ? q.in("topic", f.in) : q.not("topic", "in", `(${f.notIn.join(",")})`)).order("reviewed_at", { ascending: false, nullsFirst: false }).limit(5);
  };
  const newest = { ascending: false, nullsFirst: false } as const;
  const [groupResults, latestFact, unis, programmes, rules, figures] = await Promise.all([
    Promise.all(groupKeys.map(groupQuery)),
    client.from("facts").select("reviewed_at").eq("country_id", country.id).in("status", ["reviewed", "conflicted"]).order("reviewed_at", newest).limit(1),
    client.from("universities").select("id,name,reviewed_at", { count: "exact" }).eq("status", "reviewed").eq("country_id", country.id).order("reviewed_at", newest).limit(3),
    client.from("programmes").select("reviewed_at,universities!programmes_university_id_fkey!inner(country_id,status)", { count: "exact" })
      .eq("status", "reviewed").eq("universities.status", "reviewed").eq("universities.country_id", country.id).order("reviewed_at", newest).limit(1),
    // As /immigration: only rules whose evidence comes from a verified T1 source are public.
    client.from("immigration_rules").select("id,title,reviewed_at,documents!immigration_rules_document_id_fkey!inner(sources!inner(status,source_tier))", { count: "exact" })
      .eq("status", "reviewed").eq("country_id", country.id).eq("documents.sources.status", "verified").eq("documents.sources.source_tier", "T1").order("reviewed_at", newest).limit(3),
    // As /occupations/[id]: labour figures need a registry-verified source.
    client.from("facts").select("reviewed_at,documents!facts_document_id_fkey!inner(sources!inner(status))", { count: "exact", head: true })
      .eq("country_id", country.id).not("occupation_id", "is", null).in("status", ["reviewed", "conflicted"]).eq("documents.sources.status", "verified"),
  ]);
  if (groupResults.some((r) => r.error)) { logAccessError("country_facts"); throw new Error("Không tải được thông tin của quốc gia này."); }
  // A failed count is shown as unknown on its card, never as zero (AGENTS.md §13).
  const count = (r: { error: unknown; count: number | null }, op: string) => { if (r.error) { logAccessError(`country_count_${op}`); return null; } return r.count ?? 0; };
  const counts = { unis: count(unis, "universities"), programmes: count(programmes, "programmes"), rules: count(rules, "rules"), figures: count(figures, "figures") };
  const answers = groupKeys.map((key, i) => ({ key, facts: (groupResults[i].data ?? []) as unknown as FactRow[], total: groupResults[i].count ?? 0 }));
  const latest = latestReview([
    ...(latestFact.data ?? []).map((r) => r.reviewed_at), ...(unis.data ?? []).map((r) => r.reviewed_at),
    ...(programmes.data ?? []).map((r) => r.reviewed_at), ...(rules.data ?? []).map((r) => r.reviewed_at),
  ]);

  const save = await savedState("country", country.id);
  const permissions = await viewerPermissions();
  // Visitors are told why a section is empty; only editors get the workspace link.
  const canEdit = canOpenFactsWorkspace(permissions);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(permissions);
  const name = countryName(country.slug, country.name);
  const verified = country.sources.filter((s) => s.status === "verified").length;

  return <>
    <PageHeader back={<BackLink href="/countries">Tất cả quốc gia</BackLink>} actions={<SaveButton kind="country" id={country.id} signedIn={save.signedIn} initialSaved={save.saved} />} eyebrow={country.name} title={name}
      description={<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
        <span>{latest ? `Duyệt gần nhất: ${latest}` : "Chưa có nội dung nào được duyệt"}</span>
        <span aria-hidden="true" className="text-ink-3">·</span>
        <Link href={`/sources?country=${country.slug}`} className={textLink}>{verified}/{country.sources.length} nguồn đã xác minh</Link>
        {internal && <Badge tone={country.status === "active" ? "accent" : "neutral"}>{countryStatusLabels[country.status] ?? country.status}</Badge>}
      </span>} />

    <div className="grid gap-4 md:grid-cols-3">
      <TopicCard title="Du học" icon="education" tint="orange"
        lines={[countLine(counts.unis, "trường đại học", "Chưa có trường nào được duyệt"), countLine(counts.programmes, "chương trình học", "Chưa có chương trình nào được duyệt")]}
        items={(unis.data ?? []).map((u) => ({ href: `/universities/${u.id}`, label: u.name }))}
        links={[{ href: `/universities?country=${country.slug}`, label: "Trường" }, { href: `/programmes?country=${country.slug}`, label: "Chương trình" }]} />
      <TopicCard title="Visa & cư trú" icon="immigration" tint="teal"
        lines={[countLine(counts.rules, "quy định nhập cư", "Chưa có quy định nào được duyệt")]}
        items={(rules.data ?? []).map((r) => ({ href: `/immigration/${r.id}`, label: r.title }))}
        links={[{ href: `/immigration?country=${country.slug}`, label: "Quy định nhập cư" }]} />
      <TopicCard title="Làm việc" icon="labour" tint="brown"
        lines={[countLine(counts.figures, "số liệu thị trường lao động", "Chưa có số liệu lao động nào được duyệt")]}
        items={[]}
        links={[{ href: "/occupations", label: "Nghề nghiệp" }]} />
    </div>
    <p className="mt-2 px-1 text-[13px] text-ink-3">Chỉ đếm nội dung đã được đối chiếu với nguồn và duyệt, không phải tổng số thực tế của {name}.</p>
    <Link href={`/compare?c=${country.slug}`} className="group mt-4 flex items-center justify-between gap-4 rounded-2xl bg-surface px-5 py-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_6px_18px_rgb(0_0_0/0.08)]">
      <span><span className="block text-[15px] font-semibold text-ink">So sánh {name} với nước khác</span>
        <span className="block text-[13px] text-ink-2">Đặt cạnh nhau, kèm nguồn và kỳ số liệu; không chấm điểm hay xếp hạng.</span></span>
      <Chevron className="transition-transform group-hover:translate-x-0.5" />
    </Link>

    {/* One question per tab; the full list is /facts?country=…&group=… */}
    {(() => {
      const totals = Object.fromEntries(answers.map((a) => [a.key, a.total]));
      const active = openGroup(query.group, totals);
      const shown = answers.find((a) => a.key === active)!;
      const g = active === otherGroup.key ? otherGroup : questionGroups.find((x) => x.key === active)!;
      // "Khác" is a tab only when it holds something (or was asked for by URL).
      const tabs = answers.filter((a) => a.key !== otherGroup.key || a.total > 0 || active === otherGroup.key);
      return <Section title="Bạn muốn biết gì?">
        <Segmented label="Câu hỏi" scroll={false} items={tabs.map((a) => ({
          href: withParams(`/countries/${country.slug}`, query, { group: a.key }),
          label: a.key === otherGroup.key ? otherGroup.label : questionGroups.find((x) => x.key === a.key)!.label,
          count: a.total, active: a.key === active }))} />
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
          <h3 className="text-[17px] font-semibold text-ink">{g.question}</h3>
          {shown.total > shown.facts.length && <Link href={`/facts?country=${country.slug}&group=${active}`} className={`${textLink} text-[15px]`}>Xem tất cả {shown.total}</Link>}
        </div>
        {shown.facts.length ? <div className="space-y-3">{shown.facts.map((f) => <FactCard key={f.id} fact={f} internal={internal} />)}</div>
          : <p className="rounded-2xl bg-surface px-5 py-4 text-[15px] text-ink-2 ring-1 ring-hairline">
            Chưa có thông tin nào được duyệt cho câu hỏi này. Thông tin chỉ xuất hiện sau khi được đối chiếu với nguồn; không bao giờ được tự điền hay suy đoán.
            {canEdit && <> <Link href="/facts/workspace" className={textLink}>Thêm ở trang biên tập</Link>.</>}</p>}
      </Section>;
    })()}

  </>;
}
