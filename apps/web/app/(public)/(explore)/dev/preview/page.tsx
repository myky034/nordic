// =============================================================================
// Development-only UI preview — /dev/preview
//
// WHY: reviewing the UI needs lists long enough to paginate, conflicts, non-
// official labels and full comparison tables — states the shared database may
// not contain yet. Writing invented records to that database is forbidden
// (AGENTS.md 1.1), so this page renders the real components with in-code DEMO
// fixtures instead. It performs no database access and returns 404 in
// production builds.
// =============================================================================
import Link from "next/link";
import { notFound } from "next/navigation";
import { FactCard } from "@/lib/facts/view";
import { ExistenceEvidence } from "@/lib/education/view";
import { ConflictBanner, LegalDisclaimer } from "@/lib/immigration/view";
import { pageParam, pageSummary, pageWindow } from "@/lib/pagination";
import { demoCompareRows, demoCountries, demoEvidenceDocument, demoFacts, demoProgrammes, demoSearchGroups, demoSources } from "@/lib/dev/demo-fixtures";
import { CompareCell, CompareTable } from "@/components/compare-table";
import { LoadingState } from "@/components/ui/loading";
import {
  Badge, Card, DescriptionList, Disclosure, EmptyState, ExternalLink, Field, FormMessage, List, ListRow, Notice, PageHeader, Pagination,
  Quote, SearchInput, Section, Segmented,
} from "@/components/ui";
import { ReviewBadge, SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { buttonPrimary, buttonSecondary, buttonSmall, control, textLink } from "@/components/ui/styles";
import { SourceList } from "../../source-list";

export const metadata = { title: "UI preview (DEMO)", robots: { index: false, follow: false } };

const toc = [
  ["foundations", "Foundations"], ["lists", "Long list + pagination"], ["sources", "Source rows"], ["facts", "Fact cards"],
  ["workspace", "Workspace rows"], ["compare", "Comparison table"], ["search", "Search results"], ["detail", "Detail blocks"], ["states", "Empty & loading"],
] as const;

export default async function PreviewPage({ searchParams }: PageProps<"/dev/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const page = pageParam(query);
  const { from, to } = pageWindow(page);
  const tab = typeof query.tab === "string" ? query.tab : "proposed";
  const rows = demoProgrammes.slice(from, to + 1);

  return <>
    <div className="mb-8"><Notice tone="caution" role="alert" title="DEMO — dữ liệu giả chỉ để xem giao diện">
      Mọi tên, số và URL trên trang này là hư cấu (domain <code>example.test</code>) và không được ghi vào database. Trang chỉ tồn tại khi chạy dev; bản production trả về 404.
    </Notice></div>
    <PageHeader eyebrow="Development" title="UI preview" description="Every shared component and state, rendered with DEMO fixtures. Toggle dark mode in your OS settings to review both themes." />
    <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-2">{toc.map(([id, label]) => <a key={id} href={`#${id}`} className={buttonSmall}>{label}</a>)}</nav>

    <Section title="Foundations" className="scroll-mt-24"><span id="foundations" />
      <Card className="space-y-6">
        <div className="flex flex-wrap gap-3"><button className={buttonPrimary}>Primary</button><button className={buttonSecondary}>Secondary</button><button className={buttonSmall}>Small</button><button className={buttonPrimary} disabled>Disabled</button><a href="#foundations" className={`${textLink} self-center text-[15px]`}>Text link</a></div>
        <div className="flex flex-wrap gap-2"><TierBadge tier="T1" /><TierBadge tier="T2" /><TierBadge tier="T3" /><TierBadge tier="T4" /><TierBadge tier={null} /></div>
        <div className="flex flex-wrap gap-2">{["proposed", "reviewed", "conflicted", "rejected"].map((s) => <ReviewBadge key={s} status={s}>{s}</ReviewBadge>)}</div>
        <div className="flex flex-wrap gap-2">{["verified", "needs_verification", "review_required"].map((s) => <SourceStatusBadge key={s} status={s}>{s}</SourceStatusBadge>)}<Badge tone="accent">Kỳ số liệu: 2025-Q2</Badge></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Text field" hint="Hint text under a field."><input className={control} placeholder="DEMO placeholder" /></Field>
          <Field label="Select"><select className={control} defaultValue="b"><option value="a">DEMO option A</option><option value="b">DEMO option B</option></select></Field>
          <div className="sm:col-span-2"><SearchInput defaultValue="" placeholder="DEMO search" /></div>
        </div>
        <FormMessage error="DEMO error message shown after a failed save." /><FormMessage message="DEMO success message shown after saving." />
      </Card>
      <div className="mt-4 space-y-3">
        <Notice tone="neutral" title="Neutral notice">DEMO body text.</Notice>
        <LegalDisclaimer />
        <ConflictBanner />
      </div>
    </Section>

    <Section title="Long list + pagination" description="60 DEMO rows, 25 per page — the pattern used by every list." className="scroll-mt-24"><span id="lists" />
      <List label="DEMO programmes">{rows.map((p) => <ListRow key={p.id} href="#lists" title={p.name} badges={<Badge tone="accent">{p.degree}</Badge>}
        subtitle={`${p.university} · ${p.country} · ${p.field ?? "Field not stated"} · ${p.language ?? "Language not stated"}`} />)}</List>
      <Pagination summary={pageSummary(demoProgrammes.length, page)} href={(p) => `/dev/preview?page=${p}#lists`} />
    </Section>

    <Section title="Source rows" description="Compact rows; full metadata lives on the source page." className="scroll-mt-24"><span id="sources" />
      <SourceList sources={demoSources} />
    </Section>

    <Section title="Fact cards" description="Each visual state a claim can take." className="scroll-mt-24"><span id="facts" />
      <div className="space-y-6">{demoFacts.map(({ label, fact }) => <div key={fact.id}><p className="mb-2 px-1 text-[13px] font-medium text-ink-3">{label}</p><FactCard fact={fact} /></div>)}</div>
    </Section>

    <Section title="Workspace rows" description="Status tabs, search and a review disclosure (forms here are inert)." className="scroll-mt-24"><span id="workspace" />
      <Segmented label="DEMO status" items={[["proposed", "Chờ duyệt", 12], ["reviewed", "Đã duyệt", 48], ["rejected", "Từ chối", 3]].map(([v, l, n]) => ({ href: `/dev/preview?tab=${v}#workspace`, label: l as string, count: n as number, active: tab === v }))} />
      <List>{[1, 2, 3].map((i) => <ListRow key={i} title={`DEMO University ${String.fromCharCode(64 + i)}`}
        badges={<ReviewBadge status={tab}>{tab}</ReviewBadge>} subtitle="Sweden · https://demo.example.test/university">
        <Disclosure small summary="Bằng chứng & duyệt">
          <div className="space-y-3"><Quote>DEMO excerpt proving the entity exists.</Quote>
            <fieldset disabled className="space-y-3 rounded-xl bg-fill/40 p-4 opacity-80">
              <Field label="Quyết định"><select className={control}><option>Đã kiểm tra bằng chứng tồn tại</option></select></Field>
              <Field label="Lý do / ghi chú kiểm tra"><textarea rows={2} className={control} /></Field>
              <button className={buttonPrimary}>Ghi nhận quyết định (demo)</button>
            </fieldset></div>
        </Disclosure>
      </ListRow>)}</List>
    </Section>

    <Section title="Comparison table" description="Every value per cell with its own source, tier and period; a conflict, a non-official value and empty cells." className="scroll-mt-24"><span id="compare" />
      <CompareTable countries={demoCountries} rows={demoCompareRows.map((r) => ({
        key: r.key,
        head: <><span>{r.label}</span><span className="block text-[12px] font-normal text-ink-3">{r.unit}</span><span className="mt-1 block text-[12px] font-normal text-ink-3">{r.description}</span></>,
        cells: demoCountries.map((c) => <CompareCell key={c.id} labour={r.key === "m2"} values={r.cells[c.id as keyof typeof r.cells]} />),
      }))} />
    </Section>

    <Section title="Search results" className="scroll-mt-24"><span id="search" />
      <div className="space-y-8">{demoSearchGroups.map((g) => <div key={g.label}>
        <div className="mb-3 flex items-end justify-between px-1"><h3 className="text-[17px] font-semibold">{g.label} <span className="text-[15px] font-normal text-ink-3">{g.total}</span></h3>{g.total > g.hits.length && <a href="#search" className={`${textLink} text-[15px]`}>See all</a>}</div>
        <List>{g.hits.map((h) => <ListRow key={h.id} href="#search" title={h.title} subtitle={h.subtitle} />)}</List>
      </div>)}</div>
    </Section>

    <Section title="Detail blocks" className="scroll-mt-24"><span id="detail" />
      <DescriptionList items={[
        ["Official website", <ExternalLink key="w" href="https://demo.example.test/">https://demo.example.test/</ExternalLink>],
        ["Classification", "DEMO-CODE 0000"], ["Last registry verification", "2026-01-15"], ["Unknown value", "Not available"],
      ]} />
      <div className="mt-4"><Card><ExistenceEvidence excerpt="DEMO excerpt naming the entity." document={demoEvidenceDocument} reviewedAt="2026-01-16T00:00:00Z" /></Card></div>
    </Section>

    <Section title="Empty & loading states" className="scroll-mt-24"><span id="states" />
      <div className="space-y-4">
        <EmptyState title="DEMO empty state with title" action={<Link href="#states" className={`${textLink} text-[15px]`}>DEMO action</Link>}>Explains why nothing is shown, without inventing content.</EmptyState>
        <EmptyState>Chưa có dữ liệu.</EmptyState>
        <Card><LoadingState label="DEMO loading" /></Card>
      </div>
    </Section>
  </>;
}
