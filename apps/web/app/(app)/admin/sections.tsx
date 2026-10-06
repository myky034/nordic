import { accessContext, logAccessError, type PermissionKey } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { activity, complete, coverage, crawlerState, dayKeys, extractionState, perDay, reviewKinds, ROW_LIMIT, sinceIso,
  daysSince, type Country, type ExtractionRunRow, type ReviewKind, type RunRow } from "@/lib/admin/overview";
import { Notice } from "@/components/ui";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { ActivityView, CoverageView, CrawlerView, ExtractionView } from "./views";

// Each section of /admin loads its own data through the viewer's client, so
// RLS decides what is counted (no service role, no SECURITY DEFINER shortcut).
// A section the viewer may not read says which permission it needs instead of
// showing zeros; a failed or truncated load says so instead of a wrong number
// (AGENTS.md §5.3, §13). Each async section is wrapped in <Suspense> by the
// page, so a slow query delays only its own block.

type Client = Awaited<ReturnType<typeof accessContext>>["client"];
type Props = { client: Client; permissions: string[]; now: Date; locale?: Locale };

export function NeedsPermission({ keys, locale = defaultLocale }: { keys: PermissionKey[]; locale?: Locale }) {
  return <Notice tone="neutral">{dictionaries[locale].adminOverview.needsPermission(keys.map((k) => permissionName(k, locale)))}</Notice>;
}
export function LoadFailed({ locale = defaultLocale }: { locale?: Locale }) {
  const t = dictionaries[locale].adminOverview;
  return <Notice tone="critical" role="alert" title={t.loadFailedTitle}>{t.loadFailedText}</Notice>;
}

// ------------------------------------------------------------------ crawler

export async function CrawlerSection({ client, permissions, now, locale }: Props) {
  if (!permissions.includes("crawler.manage")) return <NeedsPermission keys={["crawler.manage"]} locale={locale} />;
  const [run, states, targets] = await Promise.all([
    client.from("crawler_runs").select("status,started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("crawl_url_states").select("last_outcome", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("crawl_targets").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  if (run.error || states.error || targets.error) { logAccessError("admin_overview_crawler"); return <LoadFailed locale={locale} />; }
  return <CrawlerView state={crawlerState(run.data as RunRow | null, states.data ?? [], now)} activeTargets={targets.count ?? 0}
    complete={complete(states.data, states.count)} locale={locale} />;
}

// ------------------------------------------------------------------ AI extraction

export async function ExtractionSection({ client, permissions, now, locale }: Props) {
  if (!permissions.includes("facts.propose") && !permissions.includes("facts.review")) return <NeedsPermission keys={["facts.propose", "facts.review"]} locale={locale} />;
  const [runs, pending, settings] = await Promise.all([
    client.from("extraction_runs").select("status,started_at,input_tokens,output_tokens", { count: "exact" })
      .gte("started_at", sinceIso(30, now)).order("started_at", { ascending: false }).range(0, ROW_LIMIT - 1),
    client.from("extraction_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]),
    client.from("extraction_settings").select("ai_user_id").maybeSingle(),
  ]);
  if (runs.error || pending.error || settings.error) { logAccessError("admin_overview_extraction"); return <LoadFailed locale={locale} />; }
  const rows = (runs.data ?? []) as ExtractionRunRow[];
  const daily = perDay(rows, (r) => r.started_at, dayKeys(30, now), (r) => ({ input: r.input_tokens ?? 0, output: r.output_tokens ?? 0 }));
  return <ExtractionView state={extractionState(rows)} daily={daily} pending={pending.count ?? 0}
    accountSet={Boolean(settings.data)} complete={complete(runs.data, runs.count)} now={now} locale={locale} />;
}

// ------------------------------------------------------------------ coverage

type Keyed = { country_id: string | null; status: string };
export async function CoverageSection({ client, permissions, locale }: Omit<Props, "now">) {
  // Editors' read policies (facts, universities, programmes, rules,
  // occupations) all admit facts.propose / facts.review; without one of
  // them only public rows are visible and the counts would be misleading.
  if (!permissions.includes("facts.propose") && !permissions.includes("facts.review")) return <NeedsPermission keys={["facts.propose", "facts.review"]} locale={locale} />;
  const results = await Promise.all([
    client.from("countries").select("id,slug,name").order("name"),
    client.from("sources").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("facts").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("universities").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("programmes").select("status,universities(country_id)", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("immigration_rules").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
    client.from("occupations").select("country_id,status", { count: "exact" }).range(0, ROW_LIMIT - 1),
  ]);
  if (results.some((r) => r.error)) { logAccessError("admin_overview_coverage"); return <LoadFailed locale={locale} />; }
  const [countries, sources, facts, universities, programmes, rules, occupations] = results;
  const counted = [sources, facts, universities, programmes, rules, occupations];
  // A programme's country is its university's country.
  const programmeRows = ((programmes.data ?? []) as unknown as { status: string; universities: { country_id: string } | null }[])
    .map((p) => ({ status: p.status, country_id: p.universities?.country_id ?? null }));
  const result = coverage((countries.data ?? []) as Country[], {
    sources: (sources.data ?? []) as Keyed[], facts: (facts.data ?? []) as Keyed[], universities: (universities.data ?? []) as Keyed[],
    programmes: programmeRows, rules: (rules.data ?? []) as Keyed[], occupations: (occupations.data ?? []) as Keyed[],
  });
  return <CoverageView {...result} complete={counted.every((r) => complete(r.data, r.count))} locale={locale} />;
}

// ------------------------------------------------------------------ review activity

const reviewTables: Record<ReviewKind, string> = { facts: "fact_reviews", education: "education_reviews", immigration: "immigration_rule_reviews", labour: "occupation_reviews" };
const pendingTables = [
  { table: "facts", href: "/facts/workspace" },
  { table: "universities", href: "/education/workspace" },
  { table: "programmes", href: "/education/workspace" },
  { table: "immigration_rules", href: "/immigration/workspace" },
  { table: "occupations", href: "/labour/workspace" },
];

export async function ActivitySection({ client, permissions, now, days, locale }: Props & { days: 7 | 30 }) {
  // Review history tables are readable with facts.review (each also admits
  // its own *.manage permission, but only reviewers see all four).
  if (!permissions.includes("facts.review")) return <NeedsPermission keys={["facts.review"]} locale={locale} />;
  const since = sinceIso(days, now);
  const [reviews, pending] = await Promise.all([
    Promise.all(reviewKinds.map(({ kind }) => client.from(reviewTables[kind]).select("decision,created_at", { count: "exact" }).gte("created_at", since).range(0, ROW_LIMIT - 1))),
    // Oldest proposal first; `count` is the number still waiting.
    Promise.all(pendingTables.map(({ table }) => client.from(table).select("created_at", { count: "exact" }).eq("status", "proposed").order("created_at").limit(1))),
  ]);
  if ([...reviews, ...pending].some((r) => r.error)) { logAccessError("admin_overview_activity"); return <LoadFailed locale={locale} />; }
  type Review = { decision: string; created_at: string };
  const byKind = Object.fromEntries(reviewKinds.map(({ kind }, i) => [kind, (reviews[i].data ?? []) as Review[]])) as Record<ReviewKind, Review[]>;
  const daily = perDay(Object.values(byKind).flat(), (r) => r.created_at, dayKeys(days, now), (r) => ({ [r.decision]: 1 }));
  return <ActivityView locale={locale} rows={activity(byKind, locale)} daily={daily} days={days} complete={reviews.every((r) => complete(r.data, r.count))}
    pending={pendingTables.map((t, i) => ({ ...t, label: dictionaries[locale ?? defaultLocale].adminOverview.pendingKinds[t.table], count: pending[i].count ?? 0, oldestDays: daysSince((pending[i].data?.[0] as { created_at: string } | undefined)?.created_at, now) }))} />;
}
