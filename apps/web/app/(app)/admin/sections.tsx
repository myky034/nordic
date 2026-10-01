import Link from "next/link";
import { accessContext, logAccessError, type PermissionKey } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { activity, complete, coverage, crawlerState, dayKeys, dayLabel, daysSince, perDay, decisionLabels, decisions, extractionState, reviewKinds, ROW_LIMIT, sinceIso,
  CRAWLER_STALE_DAYS, type Country, type ExtractionRunRow, type ReviewKind, type RunRow } from "@/lib/admin/overview";
import { crawlOutcomes, runStatuses } from "@/lib/crawler/domain";
import { runStatuses as extractionRunStatuses } from "@/lib/extraction/domain";
import { countryName } from "@/lib/registry/domain";
import { Badge, Card, Notice } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { textLink } from "@/components/ui/styles";
import { BarChart, ColumnChart, type Series } from "@/components/ui/charts";

// Each section of /admin loads its own data through the viewer's client, so
// RLS decides what is counted (no service role, no SECURITY DEFINER shortcut).
// A section the viewer may not read says which permission it needs instead of
// showing zeros; a failed or truncated load says so instead of a wrong number
// (AGENTS.md §5.3, §13). Each async section is wrapped in <Suspense> by the
// page, so a slow query delays only its own block.

type Client = Awaited<ReturnType<typeof accessContext>>["client"];
type Props = { client: Client; permissions: string[]; now: Date };
const when = (v: string) => new Date(v).toISOString().replace("T", " ").slice(0, 16);
const n = (v: number) => v.toLocaleString("vi-VN");
const ago = (days: number | null) => days === null ? "" : days === 0 ? "hôm nay" : `${days} ngày trước`;

export function NeedsPermission({ keys }: { keys: PermissionKey[] }) {
  return <Notice tone="neutral">{`Cần quyền ${keys.map((k) => `“${permissionName(k)}”`).join(" hoặc ")} để xem phần này.`}</Notice>;
}
export function LoadFailed() {
  return <Notice tone="critical" role="alert" title="Không tải được phần này">Hãy tải lại trang. Lỗi đã được ghi vào log máy chủ.</Notice>;
}
export function Incomplete() {
  return <Notice tone="caution" title="Chưa đếm đủ">{`Có bảng nhiều hơn ${n(ROW_LIMIT)} dòng nên số liệu dưới đây có thể thiếu. Cần chuyển sang đếm trong cơ sở dữ liệu trước khi dùng các con số này.`}</Notice>;
}
export function SectionPlaceholder() {
  return <div aria-hidden="true" className="h-40 animate-pulse rounded-2xl bg-fill/60" />;
}

function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "caution" | "critical" }) {
  return <div>
    <dt className="text-[13px] text-ink-3">{label}</dt>
    <dd className={`mt-0.5 text-[22px] font-semibold tabular-nums tracking-[-0.01em] ${tone === "critical" ? "text-critical" : tone === "caution" ? "text-caution" : "text-ink"}`}>{value}</dd>
    {hint && <dd className="mt-0.5 text-[12px] leading-snug text-ink-3">{hint}</dd>}
  </div>;
}

// ------------------------------------------------------------------ crawler

export async function CrawlerSection({ client, permissions, now }: Props) {
  if (!permissions.includes("crawler.manage")) return <NeedsPermission keys={["crawler.manage"]} />;
  const [run, states, targets] = await Promise.all([
    client.from("crawler_runs").select("status,started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("crawl_url_states").select("last_outcome", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("crawl_targets").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  if (run.error || states.error || targets.error) { logAccessError("admin_overview_crawler"); return <LoadFailed />; }
  return <CrawlerView state={crawlerState(run.data as RunRow | null, states.data ?? [], now)} activeTargets={targets.count ?? 0}
    complete={complete(states.data, states.count)} />;
}

const outcomeSeries: Series[] = [{ key: "ok", label: "Bình thường", swatch: "bg-accent" }, { key: "problem", label: "Cần xem lại", swatch: "bg-caution" }];

export function CrawlerView({ state, activeTargets, complete: full }: { state: ReturnType<typeof crawlerState>; activeTargets: number; complete: boolean }) {
  const st = state.lastRun ? runStatuses[state.lastRun.status] ?? runStatuses.failed : null;
  return <Card className="h-full">
    <div className="flex items-center justify-between gap-3"><h3 className="text-[17px] font-semibold text-ink">Crawler</h3>
      <Link href="/admin/crawler" className={`${textLink} text-[14px]`}>Mở Crawler</Link></div>
    {!full && <div className="mt-3"><Incomplete /></div>}
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
      <Stat label="Lần chạy gần nhất" value={state.lastRun ? <Badge tone={st!.tone}>{st!.label}</Badge> : "Chưa chạy"}
        hint={state.lastRun ? `${when(state.lastRun.started_at)} UTC · ${ago(state.age)}` : undefined} />
      <Stat label="URL đăng ký đang bật" value={n(activeTargets)} />
      <Stat label="URL đã từng lấy" value={n(state.trackedUrls)} />
      <Stat label="URL cần xem lại" value={n(state.problemUrls)} tone={state.problemUrls ? "caution" : undefined}
        hint={Object.entries(state.problems).map(([k, c]) => `${crawlOutcomes[k]?.label ?? k}: ${c}`).join(" · ") || "Lần lấy gần nhất của mọi URL đều ổn"} />
    </dl>
    {Object.keys(state.outcomes).length > 0 && <div className="mt-5 border-t border-hairline pt-4">
      <h4 className="mb-3 text-[13px] font-semibold text-ink-2">URL theo kết quả lần lấy gần nhất</h4>
      <BarChart title="URL theo kết quả lần lấy gần nhất" summary={`${n(state.trackedUrls)} URL, ${n(state.problemUrls)} cần xem lại`}
        series={outcomeSeries} points={Object.entries(state.outcomes).sort((a, b) => b[1] - a[1])
          .map(([k, c]) => ({ label: crawlOutcomes[k]?.label ?? k, values: { [state.problems[k] ? "problem" : "ok"]: c } }))} />
    </div>}
    {state.stale && <div className="mt-4"><Notice tone="caution">{state.lastRun
      ? `Crawler chưa chạy hơn ${CRAWLER_STALE_DAYS} ngày, dù lịch là hằng tuần. Kiểm tra workflow theo lịch hoặc chạy tay.`
      : "Crawler chưa chạy lần nào."}</Notice></div>}
  </Card>;
}

// ------------------------------------------------------------------ AI extraction

export async function ExtractionSection({ client, permissions, now }: Props) {
  if (!permissions.includes("facts.propose") && !permissions.includes("facts.review")) return <NeedsPermission keys={["facts.propose", "facts.review"]} />;
  const [runs, pending, settings] = await Promise.all([
    client.from("extraction_runs").select("status,started_at,input_tokens,output_tokens", { count: "exact" })
      .gte("started_at", sinceIso(30, now)).order("started_at", { ascending: false }).range(0, ROW_LIMIT - 1),
    client.from("extraction_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]),
    client.from("extraction_settings").select("ai_user_id").maybeSingle(),
  ]);
  if (runs.error || pending.error || settings.error) { logAccessError("admin_overview_extraction"); return <LoadFailed />; }
  const rows = (runs.data ?? []) as ExtractionRunRow[];
  const daily = perDay(rows, (r) => r.started_at, dayKeys(30, now), (r) => ({ input: r.input_tokens ?? 0, output: r.output_tokens ?? 0 }));
  return <ExtractionView state={extractionState(rows)} daily={daily} pending={pending.count ?? 0}
    accountSet={Boolean(settings.data)} complete={complete(runs.data, runs.count)} now={now} />;
}

const tokenSeries: Series[] = [{ key: "input", label: "Token vào", swatch: "bg-accent" }, { key: "output", label: "Token ra", swatch: "bg-accent/40" }];

export function ExtractionView({ state, daily, pending, accountSet, complete: full, now }: { state: ReturnType<typeof extractionState>; daily: ReturnType<typeof perDay>; pending: number; accountSet: boolean; complete: boolean; now: Date }) {
  const st = state.lastRun ? extractionRunStatuses[state.lastRun.status] ?? extractionRunStatuses.failed : null;
  return <Card className="h-full">
    <div className="flex items-center justify-between gap-3"><h3 className="text-[17px] font-semibold text-ink">Trích xuất AI <span className="text-[13px] font-normal text-ink-3">· 30 ngày qua</span></h3>
      <Link href="/admin/extraction" className={`${textLink} text-[14px]`}>Mở Trích xuất AI</Link></div>
    {!full && <div className="mt-3"><Incomplete /></div>}
    {!accountSet && <div className="mt-3"><Notice tone="caution" title="Chưa chọn tài khoản AI">AI sẽ không chạy cho tới khi chọn ở tab Cài đặt của trang Trích xuất AI.</Notice></div>}
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
      <Stat label="Lần chạy gần nhất" value={state.lastRun ? <Badge tone={st!.tone}>{st!.label}</Badge> : "Không có"}
        hint={state.lastRun ? `${when(state.lastRun.started_at)} UTC · ${ago(daysSince(state.lastRun.started_at, now))}` : "Không có lần chạy nào trong 30 ngày"} />
      <Stat label="Yêu cầu đang chờ" value={n(pending)} />
      <Stat label="Lần chạy" value={n(state.runs)} tone={state.failedRuns ? "caution" : undefined}
        hint={state.failedRuns ? `${state.failedRuns} lần thất bại hoặc lỗi một phần` : "Không có lần nào lỗi"} />
      <Stat label="Token vào / ra" value={`${n(state.inputTokens)} / ${n(state.outputTokens)}`} hint="Số token nhà cung cấp AI báo về" />
    </dl>
    <div className="mt-5 border-t border-hairline pt-4">
      <h4 className="mb-3 text-[13px] font-semibold text-ink-2">Token theo ngày (UTC)</h4>
      <ColumnChart title="Token AI theo ngày, 30 ngày qua" summary={`Tổng ${n(state.inputTokens)} token vào, ${n(state.outputTokens)} token ra`} height={110} labelEvery={7}
        series={tokenSeries} points={daily.map((d) => ({ label: dayLabel(d.day), values: d.values }))} />
    </div>
  </Card>;
}

// ------------------------------------------------------------------ coverage

type Keyed = { country_id: string | null; status: string };
export async function CoverageSection({ client, permissions }: Omit<Props, "now">) {
  // Editors' read policies (facts, universities, programmes, rules,
  // occupations) all admit facts.propose / facts.review; without one of
  // them only public rows are visible and the counts would be misleading.
  if (!permissions.includes("facts.propose") && !permissions.includes("facts.review")) return <NeedsPermission keys={["facts.propose", "facts.review"]} />;
  const results = await Promise.all([
    client.from("countries").select("id,slug,name").order("name"),
    client.from("sources").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("facts").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("universities").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("programmes").select("status,universities(country_id)", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("immigration_rules").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("occupations").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
  ]);
  if (results.some((r) => r.error)) { logAccessError("admin_overview_coverage"); return <LoadFailed />; }
  const [countries, sources, facts, universities, programmes, rules, occupations] = results;
  const counted = [sources, facts, universities, programmes, rules, occupations];
  // A programme's country is its university's country.
  const programmeRows = ((programmes.data ?? []) as unknown as { status: string; universities: { country_id: string } | null }[])
    .map((p) => ({ status: p.status, country_id: p.universities?.country_id ?? null }));
  const result = coverage((countries.data ?? []) as Country[], {
    sources: (sources.data ?? []) as Keyed[], facts: (facts.data ?? []) as Keyed[], universities: (universities.data ?? []) as Keyed[],
    programmes: programmeRows, rules: (rules.data ?? []) as Keyed[], occupations: (occupations.data ?? []) as Keyed[],
  });
  return <CoverageView {...result} complete={counted.every((r) => complete(r.data, r.count))} />;
}

const factSeries: Series[] = [{ key: "reviewed", label: "Đã duyệt", swatch: "bg-positive" }, { key: "proposed", label: "Chờ duyệt", swatch: "bg-caution" },
  { key: "conflicted", label: "Mâu thuẫn", swatch: "bg-critical" }];

export function CoverageView({ rows, total, complete: full }: ReturnType<typeof coverage> & { complete: boolean }) {
  const columns = [{ label: "Quốc gia" }, { label: "Nguồn đã xác minh", className: "text-right" }, { label: "Thông tin đã duyệt", className: "text-right" },
    { label: "Chờ duyệt", className: "text-right" }, { label: "Mâu thuẫn", className: "text-right" }, { label: "Trường", className: "text-right" },
    { label: "Chương trình", className: "text-right" }, { label: "Quy định nhập cư", className: "text-right" }, { label: "Nghề", className: "text-right" }];
  const cells = (r: typeof total) => <>
    <Cell className="text-right tabular-nums">{n(r.sourcesVerified)} / {n(r.sourcesTotal)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.factsReviewed)}</Cell>
    <Cell className="text-right tabular-nums">{r.factsProposed ? <Badge tone="caution">{n(r.factsProposed)}</Badge> : "0"}</Cell>
    <Cell className="text-right tabular-nums">{r.factsConflicted ? <Badge tone="critical">{n(r.factsConflicted)}</Badge> : "0"}</Cell>
    <Cell className="text-right tabular-nums">{n(r.universities)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.programmes)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.rules)}</Cell>
    <Cell className="text-right tabular-nums">{n(r.occupations)}</Cell>
  </>;
  const factPoints = rows.map((r) => ({ label: r.country ? countryName(r.country.slug, r.country.name) : "Không gắn quốc gia",
    values: { reviewed: r.factsReviewed, proposed: r.factsProposed, conflicted: r.factsConflicted } }));
  return <>
    {!full && <div className="mb-3"><Incomplete /></div>}
    <Card className="mb-4">
      <h3 className="mb-4 text-[15px] font-semibold text-ink">Thông tin theo quốc gia</h3>
      <BarChart title="Thông tin theo quốc gia" summary={`${n(total.factsReviewed)} đã duyệt, ${n(total.factsProposed)} chờ duyệt, ${n(total.factsConflicted)} mâu thuẫn`}
        series={factSeries} points={factPoints} />
    </Card>
    <DataTable label="Độ phủ dữ liệu theo quốc gia" minWidth="60rem" columns={columns}>
      {rows.map((r) => r.country
        ? <DataRow key={r.key} href={`/countries/${r.country.slug}`} title={<span className="whitespace-nowrap">{countryName(r.country.slug, r.country.name)}</span>}>{cells(r)}</DataRow>
        : <tr key={r.key}><td className="whitespace-nowrap px-4 py-3 text-ink-2">Không gắn quốc gia</td>{cells(r)}<td /></tr>)}
      <tr className="bg-fill/40 font-semibold [&_td]:text-ink"><td className="px-4 py-3">Tổng</td>{cells(total)}<td /></tr>
    </DataTable>
  </>;
}

// ------------------------------------------------------------------ review activity

const reviewTables: Record<ReviewKind, string> = { facts: "fact_reviews", education: "education_reviews", immigration: "immigration_rule_reviews", labour: "occupation_reviews" };
const pendingTables = [
  { table: "facts", label: "Thông tin", href: "/facts/workspace" },
  { table: "universities", label: "Trường", href: "/education/workspace" },
  { table: "programmes", label: "Chương trình", href: "/education/workspace" },
  { table: "immigration_rules", label: "Quy định nhập cư", href: "/immigration/workspace" },
  { table: "occupations", label: "Nghề", href: "/labour/workspace" },
];

export async function ActivitySection({ client, permissions, now, days }: Props & { days: 7 | 30 }) {
  // Review history tables are readable with facts.review (each also admits
  // its own *.manage permission, but only reviewers see all four).
  if (!permissions.includes("facts.review")) return <NeedsPermission keys={["facts.review"]} />;
  const since = sinceIso(days, now);
  const [reviews, pending] = await Promise.all([
    Promise.all(reviewKinds.map(({ kind }) => client.from(reviewTables[kind]).select("decision,created_at", { count: "exact" }).gte("created_at", since).range(0, ROW_LIMIT - 1))),
    // Oldest proposal first; `count` is the number still waiting.
    Promise.all(pendingTables.map(({ table }) => client.from(table).select("created_at", { count: "exact" }).eq("status", "proposed").order("created_at").limit(1))),
  ]);
  if ([...reviews, ...pending].some((r) => r.error)) { logAccessError("admin_overview_activity"); return <LoadFailed />; }
  type Review = { decision: string; created_at: string };
  const byKind = Object.fromEntries(reviewKinds.map(({ kind }, i) => [kind, (reviews[i].data ?? []) as Review[]])) as Record<ReviewKind, Review[]>;
  const daily = perDay(Object.values(byKind).flat(), (r) => r.created_at, dayKeys(days, now), (r) => ({ [r.decision]: 1 }));
  return <ActivityView rows={activity(byKind)} daily={daily} days={days} complete={reviews.every((r) => complete(r.data, r.count))}
    pending={pendingTables.map((t, i) => ({ ...t, count: pending[i].count ?? 0, oldestDays: daysSince((pending[i].data?.[0] as { created_at: string } | undefined)?.created_at, now) }))} />;
}

const decisionSeries: Series[] = [{ key: "reviewed", label: decisionLabels.reviewed, swatch: "bg-positive" }, { key: "rejected", label: decisionLabels.rejected, swatch: "bg-critical" },
  { key: "conflicted", label: decisionLabels.conflicted, swatch: "bg-caution" }, { key: "revalidated", label: decisionLabels.revalidated, swatch: "bg-accent" }];

export function ActivityView({ rows, daily, days, pending, complete: full }: { rows: ReturnType<typeof activity>; daily: ReturnType<typeof perDay>; days: 7 | 30; pending: { table: string; label: string; href: string; count: number; oldestDays: number | null }[]; complete: boolean }) {
  const total = rows.reduce((a, r) => a + r.total, 0);
  return <div className="grid gap-4">
    <Card>
      <h3 className="mb-4 text-[15px] font-semibold text-ink">Quyết định theo ngày (UTC)</h3>
      <ColumnChart title={`Quyết định duyệt theo ngày, ${days} ngày qua`} summary={`${n(total)} quyết định`} labelEvery={days === 30 ? 5 : 1}
        series={decisionSeries} points={daily.map((d) => ({ label: dayLabel(d.day), values: d.values }))} />
    </Card>
    <div>
      {!full && <div className="mb-3"><Incomplete /></div>}
      <DataTable label="Quyết định duyệt" minWidth="36rem" columns={[{ label: "Khu vực" }, ...decisions.map((d) => ({ label: decisionLabels[d], className: "text-right" })), { label: "Tổng", className: "text-right" }]}>
        {rows.map((r) => <DataRow key={r.kind} href={r.href} title={<span className="whitespace-nowrap">{r.label}</span>}>
          {decisions.map((d) => <Cell key={d} className="text-right tabular-nums">{r.kind !== "facts" && (d === "conflicted" || d === "revalidated") ? <span className="text-ink-3">—</span> : n(r.counts[d])}</Cell>)}
          <Cell className="text-right font-semibold tabular-nums text-ink">{n(r.total)}</Cell>
        </DataRow>)}
      </DataTable>
      <p className="mt-2 px-1 text-[12px] text-ink-3">“—”: khu vực này không có loại quyết định đó.</p>
    </div>
    <DataTable label="Đang chờ duyệt" minWidth="20rem" columns={[{ label: "Đang chờ" }, { label: "Số mục", className: "text-right" }, { label: "Chờ lâu nhất", className: "text-right" }]}>
      {pending.map((p) => <DataRow key={p.table} href={p.href} title={<span className="whitespace-nowrap">{p.label}</span>}>
        <Cell className="text-right tabular-nums">{p.count ? <Badge tone="caution">{n(p.count)}</Badge> : "0"}</Cell>
        <Cell className="whitespace-nowrap text-right tabular-nums">{p.oldestDays === null ? "—" : `${p.oldestDays} ngày`}</Cell>
      </DataRow>)}
    </DataTable>
  </div>;
}
