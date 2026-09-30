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
import { buttonDestructive, buttonPrimary, buttonSecondary, buttonSmall, control, textLink } from "@/components/ui/styles";
import { SourceList } from "../../source-list";
import { crawlOutcomes, runStatuses as crawlRunStatuses } from "@/lib/crawler/domain";
import { itemOutcomes, requestStatuses } from "@/lib/extraction/domain";
import { counters, dashboardGroups } from "@/lib/dashboard/items";
import { CounterTile, TileLink } from "@/app/(app)/dashboard/tiles";
import { ReviewFields } from "@/components/review/review-panel";
import { ItemStepper, SplitList, SplitPager, SplitRow, SplitView } from "@/components/review/split-view";
import { selectItem } from "@/lib/review/selection";
import { SamePageFacts } from "@/components/review/same-page-facts";
import { SourceForm } from "@/app/(app)/admin/sources/forms";
import { ReviewStepsView } from "@/components/review/review-steps";
import { DecisionHistory } from "@/components/review/decision-history";

// DEMO pending counts for the review steps; null shows how a failed count looks ("—").
const demoStepCounts = { sourcesUnverified: null, education: 12, immigration: 3, labour: 0, facts: 16 };
import { VisibilityNote } from "@/components/review/visibility-note";
import { entityStatuses } from "@/lib/education/domain";
import { statuses as factStatuses } from "@/lib/facts/domain";
import { sourceStatusLabels, sourceStatuses, verificationLabel } from "@/lib/registry/domain";
import type { Visibility } from "@/lib/review/visibility";

// One DEMO row per visibility state a reviewer can meet (lib/review/visibility.ts).
function demoVisibility(tab: string): [string, Visibility | null][] {
  if (tab === "proposed") return [["DEMO University A", { state: "will_be_public" }],
    ["DEMO Immigration rule B", { state: "will_stay_hidden", blockers: ["rule_source_unverified"] }]];
  if (tab === "reviewed") return [["DEMO University C", { state: "public" }],
    ["DEMO Salary figure D", { state: "hidden", blockers: ["source_unverified"] }], ["DEMO University E", { state: "unknown" }]];
  return [["DEMO University F", null]];
}

export const metadata = { title: "UI preview (DEMO)", robots: { index: false, follow: false } };

const toc = [
  ["foundations", "Foundations"], ["lists", "Long list + pagination"], ["sources", "Source rows"], ["facts", "Fact cards"],
  ["dashboard", "Dashboard"], ["review", "Review split view"], ["sources-admin", "Sources admin"], ["workspace", "Workspace rows"], ["personal", "Personal workspace"], ["automation", "Crawler & AI"], ["compare", "Comparison table"], ["search", "Search results"], ["detail", "Detail blocks"], ["states", "Empty & loading"],
] as const;

export default async function PreviewPage({ searchParams }: PageProps<"/dev/preview">) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const page = pageParam(query);
  const { from, to } = pageWindow(page);
  const tab = typeof query.tab === "string" ? query.tab : "proposed";
  const src = typeof query.src === "string" ? query.src : undefined;
  const demoSource = demoSources.find((s) => s.id === src) ?? demoSources[0];
  const item = typeof query.item === "string" ? query.item : undefined;
  const demoSelection = selectItem(demoFacts.map((d) => d.fact.id), item);
  const demoSelected = demoFacts[demoSelection.index].fact;
  const rows = demoProgrammes.slice(from, to + 1);
  // ?section=<id> renders one section only (handy for screenshots in docs).
  const only = typeof query.section === "string" && toc.some(([id]) => id === query.section) ? query.section : "";
  const show = (id: string) => !only || only === id;
  // ?facts=f8,f9 limits the fact-card section to those DEMO ids (doc screenshots).
  const factIds = typeof query.facts === "string" ? query.facts.split(",") : [];

  return <>
    <div className="mb-8"><Notice tone="caution" role="alert" title="DEMO — dữ liệu giả chỉ để xem giao diện">
      Mọi tên, số và URL trên trang này là hư cấu (domain <code>example.test</code>) và không được ghi vào database. Trang chỉ tồn tại khi chạy dev; bản production trả về 404.
    </Notice></div>
    {!only && <><PageHeader eyebrow="Development" title="UI preview" description="Every shared component and state, rendered with DEMO fixtures. Toggle dark mode in your OS settings to review both themes." />
    <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-2">{toc.map(([id, label]) => <a key={id} href={`#${id}`} className={buttonSmall}>{label}</a>)}</nav></>}

    {show("foundations") && <Section title="Foundations" className="scroll-mt-24"><span id="foundations" />
      <Card className="space-y-6">
        <div className="flex flex-wrap gap-3"><button className={buttonPrimary}>Primary</button><button className={buttonSecondary}>Secondary</button><button className={buttonDestructive}>Destructive</button><button className={buttonSmall}>Small</button><button className={buttonPrimary} disabled>Disabled</button><a href="#foundations" className={`${textLink} self-center text-[15px]`}>Text link</a></div>
        <div className="flex flex-wrap gap-2"><TierBadge tier="T1" /><TierBadge tier="T2" /><TierBadge tier="T3" /><TierBadge tier="T4" /><TierBadge tier={null} /></div>
        <div className="flex flex-wrap gap-2">{["proposed", "reviewed", "conflicted", "rejected"].map((s) => <ReviewBadge key={s} status={s}>{factStatuses[s]}</ReviewBadge>)}</div>
        <div className="flex flex-wrap gap-2">{sourceStatuses.map((s) => <SourceStatusBadge key={s} status={s}>{sourceStatusLabels[s]}</SourceStatusBadge>)}<Badge tone="accent">Kỳ số liệu: 2025-Q2</Badge></div>
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
    </Section>}

    {show("lists") && <Section title="Long list + pagination" description="60 DEMO rows, 25 per page — the pattern used by every list." className="scroll-mt-24"><span id="lists" />
      <List label="DEMO programmes">{rows.map((p) => <ListRow key={p.id} href="#lists" title={p.name} badges={<Badge tone="accent">{p.degree}</Badge>}
        subtitle={`${p.university} · ${p.country} · ${p.field ?? "Field not stated"} · ${p.language ?? "Language not stated"}`} />)}</List>
      <Pagination summary={pageSummary(demoProgrammes.length, page)} href={(p) => `/dev/preview?page=${p}#lists`} />
    </Section>}

    {show("sources") && <Section title="Source rows" description="Compact rows; full metadata lives on the source page." className="scroll-mt-24"><span id="sources" />
      <SourceList sources={demoSources} />
    </Section>}

    {show("facts") && <Section title="Fact cards" description="Each visual state a claim can take." className="scroll-mt-24"><span id="facts" />
      <div className="space-y-6">{demoFacts.filter(({ fact }) => !factIds.length || factIds.includes(fact.id)).map(({ label, fact }) => <div key={fact.id}><p className="mb-2 px-1 text-[13px] font-medium text-ink-3">{label}</p><FactCard fact={fact} /></div>)}</div>
    </Section>}

    {show("dashboard") && <Section title="Dashboard" description="Every tile an administrator sees, with DEMO counts (one unloadable)." className="scroll-mt-24"><span id="dashboard" />
      <h3 className="mb-3 px-1 text-[17px] font-semibold">Cần xử lý</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{counters.map((c, i) => <CounterTile key={c.id} label={c.label} href="#dashboard" value={[12, 3, 0, null][i]} />)}</div>
      {dashboardGroups.map((g) => <div key={g.id}><h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">{g.title}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{g.tiles.map((t) => <TileLink key={t.href} tile={{ ...t, href: "#dashboard" }} />)}</div></div>)}
    </Section>}

    {show("review") && <Section title="Review split view" description="/facts/workspace: compact list on the left (own scroll, sticky), the selected claim and its decision on the right. ?item= selects; forms are inert." className="scroll-mt-24"><span id="review" />
      <SplitView detailKey={demoSelected.id} detailOnMobile={!!item} backHref="/dev/preview?section=review#review"
        list={<SplitList label="DEMO list" footer={<SplitPager summary={{ pages: 3, current: 1, first: 1, last: demoFacts.length, total: 60, hasPrev: false, hasNext: true }} href={(p) => `/dev/preview?section=review&page=${p}#review`} />}>
          {demoFacts.map(({ fact: f }) => <SplitRow key={f.id} href={`/dev/preview?section=review&item=${f.id}#review`} selected={f.id === demoSelected.id} explicit={!!item}
            title={`${f.subject} — ${f.predicate}`} subtitle={`${f.value}${f.unit ? " " + f.unit : ""} · ${f.documents.sources.name}`}
            badges={f.origin === "ai" || f.source_changed_at ? <>{f.origin === "ai" && <Badge tone="accent">AI</Badge>}{f.source_changed_at && <Badge tone="caution">Nguồn đã đổi</Badge>}</> : undefined} />)}
        </SplitList>}
        detail={<>
          <ItemStepper index={demoSelection.index} count={demoFacts.length}
            prevHref={demoSelection.prevId ? `/dev/preview?section=review&item=${demoSelection.prevId}#review` : null}
            nextHref={demoSelection.nextId ? `/dev/preview?section=review&item=${demoSelection.nextId}#review` : null} />
          <div className="space-y-4"><FactCard fact={demoSelected} />
            <div className="space-y-3 px-1"><VisibilityNote visibility={{ state: "will_be_public" }} />
              <SamePageFacts current={demoSelected} others={[
                { id: "s1", subject: demoSelected.subject, predicate: demoSelected.predicate, value: "DEMO other value", unit: null, status: "reviewed" },
                { id: "s2", subject: "DEMO permit", predicate: "processing time", value: "0", unit: "demo weeks", status: "reviewed" },
                { id: "s3", subject: "DEMO permit", predicate: "insurance requirement", value: "DEMO value", unit: null, status: "proposed" },
              ]} />
              <fieldset disabled className="space-y-4 rounded-2xl bg-fill/50 p-4 opacity-90 sm:p-5"><ReviewFields checks={["DEMO: trích đoạn có nguyên văn trên trang gốc.", "DEMO: giá trị khớp trích đoạn."]} /></fieldset>
            </div></div>
        </>} />
    </Section>}
    {show("sources-admin") && <Section title="Sources admin" description="/admin/sources: list on the left, the grouped edit form on the right with a sticky save bar. ?src= selects; the form is disabled here." className="scroll-mt-24"><span id="sources-admin" />
      <SplitView detailKey={demoSource.id} paneScroll={false} detailOnMobile={!!src} backHref="/dev/preview?section=sources-admin"
        list={<SplitList label="DEMO sources" footer={<SplitPager summary={{ pages: 1, current: 1, first: 1, last: demoSources.length, total: demoSources.length, hasPrev: false, hasNext: false }} href={() => "#"} />}>
          {demoSources.map((s) => <SplitRow key={s.id} href={`/dev/preview?section=sources-admin&src=${s.id}`} selected={s.id === demoSource.id} explicit={!!src}
            title={s.name} subtitle={`demo.example.test · ${s.country?.name ?? "Chưa gán quốc gia"}`}
            badges={<><TierBadge tier={s.sourceTier} /><SourceStatusBadge status={s.status}>{verificationLabel(s.status, s.lastVerifiedAt)}</SourceStatusBadge></>} />)}
        </SplitList>}
        detail={<><h2 className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">{demoSource.name}</h2>
          <fieldset disabled><SourceForm source={demoSource} countries={demoCountries} /></fieldset></>} />
    </Section>}
    {show("workspace") && <Section title="Workspace rows" description="Review queue: evidence and the decision are open; each row says whether the record is (or will be) public and why not. Forms here are inert." className="scroll-mt-24"><span id="workspace" />
      <ReviewStepsView counts={demoStepCounts} permissions={["facts.review"]} current="education" />
      <Segmented label="DEMO status" items={[["proposed", "Chờ duyệt", 12], ["reviewed", "Đã duyệt", 48], ["rejected", "Từ chối", 3]].map(([v, l, n]) => ({ href: `/dev/preview?tab=${v}#workspace`, label: l as string, count: n as number, active: tab === v }))} />
      <List>{demoVisibility(tab).map(([title, visibility], i) => <ListRow key={i} title={title}
        badges={<ReviewBadge status={tab}>{entityStatuses[tab] ?? tab}</ReviewBadge>} subtitle="Sweden · https://demo.example.test/university">
        <div className="mb-2"><VisibilityNote visibility={visibility} publicHref="/dev/preview#workspace" /></div>
        <Disclosure small open={tab === "proposed"} summary={tab === "proposed" ? "Bằng chứng và quyết định" : "Bằng chứng"}>
          <div className="space-y-3"><Quote>DEMO excerpt proving the entity exists.</Quote>
            {tab === "proposed" && <fieldset disabled className="space-y-4 rounded-2xl bg-fill/50 p-4 opacity-90 sm:p-5">
              <ReviewFields checks={["DEMO: trích đoạn có nguyên văn trên trang gốc.", "DEMO: tên chính thức đúng như nguồn ghi."]} />
            </fieldset>}</div>
        </Disclosure>
      </ListRow>)}</List>
      <div className="mt-6"><DecisionHistory summary="Lịch sử quyết định (DEMO)" items={[
        { id: "h1", title: "DEMO University C", decision: "reviewed", note: "DEMO: khớp nguyên văn trang gốc.", createdAt: "2026-01-15T09:30:00Z", detail: "Trường" },
        { id: "h2", title: "DEMO University F", decision: "rejected", note: "DEMO: trích đoạn không có trên trang.", createdAt: "2026-01-14T16:05:00Z", detail: "Trường" },
        { id: "h3", title: "DEMO fact — tuition", decision: "conflicted", note: "DEMO: hai nguồn nêu hai mức khác nhau.", createdAt: "2026-01-13T08:00:00Z", detail: "Mâu thuẫn với: DEMO fact — tuition (T2)" },
      ]} /></div>
    </Section>}

    {show("personal") && <Section title="Personal workspace" description="Save button, projects, saved items, notes and plan shortcuts (inert DEMO copies)." className="scroll-mt-24"><span id="personal" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-fill px-4 py-2 text-[14px] font-medium text-ink">☆ Lưu</span>
        <span className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-[14px] font-medium text-white">★ Đã lưu</span>
        <span className="inline-flex items-center rounded-full bg-fill px-4 py-2 text-[14px] font-medium text-ink">☆ Đăng nhập để lưu</span>
      </div>
      <h3 className="mb-3 px-1 text-[17px] font-semibold">Research projects</h3>
      <Segmented label="DEMO projects" items={[{ href: "#personal", label: "Đang làm", active: true }, { href: "#personal", label: "Đã lưu trữ", active: false }]} />
      <List>{[["DEMO Sweden 2028", "2028 · DEMO role · Sweden, Denmark"], ["DEMO Master plan", "Chưa đặt mục tiêu"]].map(([t, sub]) => <ListRow key={t} href="#personal" title={t} subtitle={sub} />)}</List>
      <h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">Đã lưu</h3>
      <Segmented label="DEMO kinds" items={[["Tất cả", 4, true], ["Quốc gia", 1, false], ["Chương trình", 2, false], ["Quy định nhập cư", 1, false]].map(([l, n, a]) => ({ href: "#personal", label: l as string, count: n as number, active: a as boolean }))} />
      <List>{[["DEMO Saved Programme", "Chương trình", "DEMO Sweden 2028"], ["DEMO University A", "Trường", ""]].map(([t, k, proj]) => <ListRow key={t} title={t} badges={<Badge>{k}</Badge>} meta="Lưu ngày 2026-01-15">
        <div className="flex flex-wrap items-center gap-4"><select disabled defaultValue={proj} className={`${control} mt-0 w-auto py-1.5 text-[13px]`}><option value="">Chưa gắn project</option><option value="DEMO Sweden 2028">DEMO Sweden 2028</option></select><span className="text-[13px] text-critical">Bỏ lưu</span></div>
      </ListRow>)}</List>
      <h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">Ghi chú gần đây</h3>
      <List><ListRow title={<span className="font-normal">DEMO note: prepare transcripts before November.</span>} badges={<Badge>Ghi chú của bạn</Badge>} meta="DEMO Sweden 2028 · DEMO Saved Programme · sửa ngày 2026-01-15" /></List>
      <h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">Lối tắt theo hồ sơ (My Europe Plan)</h3>
      <div className="mb-3"><Notice tone="neutral">Đây là các liên kết lọc sẵn theo câu trả lời của bạn — <strong>không phải khuyến nghị</strong>, không xếp hạng và không dự đoán khả năng trúng tuyển.</Notice></div>
      <List>{[["So sánh các nước bạn quan tâm", "Sweden, Denmark"], ["Chương trình master tại Sweden", "Danh sách chương trình đã duyệt, lọc theo lựa chọn của bạn"]].map(([t, sub]) => <ListRow key={t} href="#personal" title={t} subtitle={sub} />)}</List>
    </Section>}

    {show("automation") && <Section title="Crawler & AI extraction" description="Inert DEMO copies of /admin/crawler, the document-page AI panel and /admin/extraction." className="scroll-mt-24"><span id="automation" />
      <h3 className="mb-3 px-1 text-[17px] font-semibold">Crawler — URL đã đăng ký</h3>
      <div className="mb-2 flex flex-wrap items-center gap-2 px-1"><span className="text-[15px] font-semibold">DEMO Government Agency</span><Badge tone="positive">Sẽ được crawl ở lần chạy tới</Badge></div>
      <List>{([["https://demo.example.test/permits", "created", "Trang"], ["https://demo.example.test/sitemap.xml", "unchanged", "Sitemap /study/"], ["https://demo.example.test/fees", "robots_disallowed", "Trang"]] as const).map(([u, o, k]) =>
        <ListRow key={u} title={<span className="break-all">{u}</span>} badges={<><Badge>{k}</Badge><Badge tone={crawlOutcomes[o].tone}>{crawlOutcomes[o].label}</Badge></>} meta="Lần lấy gần nhất: 2026-01-15 08:00 · HTTP 200 · selector main" />)}</List>
      <h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">Crawler — lần chạy gần nhất</h3>
      <List><ListRow title="2026-01-15 08:00" badges={<><Badge tone={crawlRunStatuses.succeeded.tone}>{crawlRunStatuses.succeeded.label}</Badge><Badge>schedule</Badge><Badge tone="caution">1 fact cần xem lại</Badge></>} subtitle="Phiên bản mới: 1 · Không đổi: 1 · robots.txt chặn: 1" /></List>
      <h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">Trang tài liệu — Trích xuất bằng AI</h3>
      <div className="mb-4 flex flex-wrap items-center gap-4"><button disabled className={buttonPrimary}>Yêu cầu trích xuất bằng AI</button><span className={`${textLink} text-[15px]`}>Hàng chờ duyệt</span><span className={`${textLink} text-[15px]`}>Nhật ký trích xuất</span></div>
      <List>
        <ListRow title="Yêu cầu 2026-01-15 09:00" badges={<Badge tone={requestStatuses.done.tone}>{requestStatuses.done.label}</Badge>} subtitle="4 candidates, mode json_schema_basic, proposed 2, invalid 2" meta="Xong 2026-01-15 09:05" />
        <ListRow title="Yêu cầu 2026-01-14 09:00" badges={<Badge tone={requestStatuses.failed.tone}>{requestStatuses.failed.label}</Badge>} subtitle="rate_limited: LLM HTTP 429 (DEMO)" />
      </List>
      <h3 className="mb-3 mt-8 px-1 text-[17px] font-semibold">Nhật ký trích xuất — chi tiết ứng viên</h3>
      <List>{([["DEMO permit — application fee: 0", "proposed", null], ["DEMO permit — processing time: 0 weeks", "invalid", "Excerpt not found verbatim in the document text"], ["DEMO fee — amount: 999", "invalid", "Number 999 not found in the excerpt"], ["DEMO permit — application fee: 0", "duplicate", "Same subject, predicate and value already proposed for this document"]] as const).map(([t, o, r], i) =>
        <ListRow key={i} title={<span className="text-[14px] font-normal">{t}</span>} badges={<Badge tone={itemOutcomes[o].tone}>{itemOutcomes[o].label}</Badge>} subtitle={r ?? undefined} />)}</List>
    </Section>}

    {show("compare") && <Section title="Comparison table" description="Every value per cell with its own source, tier and period; a conflict, a non-official value and empty cells." className="scroll-mt-24"><span id="compare" />
      <CompareTable countries={demoCountries} rows={demoCompareRows.map((r) => ({
        key: r.key,
        head: <><span>{r.label}</span><span className="block text-[12px] font-normal text-ink-3">{r.unit}</span><span className="mt-1 block text-[12px] font-normal text-ink-3">{r.description}</span></>,
        cells: demoCountries.map((c) => <CompareCell key={c.id} labour={r.key === "m2"} values={r.cells[c.id as keyof typeof r.cells]} />),
      }))} />
    </Section>}

    {show("search") && <Section title="Search results" className="scroll-mt-24"><span id="search" />
      <div className="space-y-8">{demoSearchGroups.map((g) => <div key={g.label}>
        <div className="mb-3 flex items-end justify-between px-1"><h3 className="text-[17px] font-semibold">{g.label} <span className="text-[15px] font-normal text-ink-3">{g.total}</span></h3>{g.total > g.hits.length && <a href="#search" className={`${textLink} text-[15px]`}>See all</a>}</div>
        <List>{g.hits.map((h) => <ListRow key={h.id} href="#search" title={h.title} subtitle={h.subtitle} />)}</List>
      </div>)}</div>
    </Section>}

    {show("detail") && <Section title="Detail blocks" className="scroll-mt-24"><span id="detail" />
      <DescriptionList items={[
        ["Official website", <ExternalLink key="w" href="https://demo.example.test/">https://demo.example.test/</ExternalLink>],
        ["Classification", "DEMO-CODE 0000"], ["Last registry verification", "2026-01-15"], ["Unknown value", "Not available"],
      ]} />
      <div className="mt-4"><Card><ExistenceEvidence excerpt="DEMO excerpt naming the entity." document={demoEvidenceDocument} reviewedAt="2026-01-16T00:00:00Z" /></Card></div>
    </Section>}

    {show("states") && <Section title="Empty & loading states" className="scroll-mt-24"><span id="states" />
      <div className="space-y-4">
        <EmptyState title="DEMO empty state with title" action={<Link href="#states" className={`${textLink} text-[15px]`}>DEMO action</Link>}>Explains why nothing is shown, without inventing content.</EmptyState>
        <EmptyState>Chưa có dữ liệu.</EmptyState>
        <Card><LoadingState label="DEMO loading" /></Card>
      </div>
    </Section>}
  </>;
}
