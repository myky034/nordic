// =============================================================================
// Development-only layout patterns — /dev/preview/patterns
//
// WHY: to compare layout options side by side before choosing one for a real
// page (the owner asked to see every option). Same rules as /dev/preview:
// DEMO fixtures only, no database access, 404 in production builds. State
// lives in the URL (?p=…&open=…&sort=…), like the real pages.
// =============================================================================
import Link from "next/link";
import { notFound } from "next/navigation";
import { FactCard } from "@/lib/facts/view";
import { demoFacts } from "@/lib/dev/demo-fixtures";
import { verificationLabel } from "@/lib/registry/domain";
import { decisionLabel, decisionTime } from "@/lib/review/history";
import { Badge, Chevron, DescriptionList, List, ListRow, Notice, PageHeader, Segmented } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { buttonDestructive, buttonPrimary, buttonSecondary, control, textLink } from "@/components/ui/styles";
import { AppIcon } from "@/app/(app)/dashboard/tiles";
import type { IconName, Tint } from "@/lib/dashboard/items";
import { SourceForm } from "@/app/(app)/admin/sources/forms";
import { KeyNav } from "@/components/key-nav";
import { Inspector } from "@/components/ui/inspector";
import { patternLog, patternSources, patternUniversities, type DemoSource } from "./data";

export const metadata = { title: "Layout patterns (DEMO)", robots: { index: false, follow: false } };

type Query = Record<string, string | string[] | undefined>;
const patterns = [
  ["inspector", "1 · Danh sách + khung trượt"], ["table", "2 · Bảng"], ["focus", "3 · Tập trung"],
  ["three", "4 · Ba cột"], ["cards", "5 · Lưới thẻ"], ["accordion", "6 · Mở rộng tại chỗ"],
] as const;
type Pattern = (typeof patterns)[number][0];
const one = (q: Query, k: string) => (typeof q[k] === "string" ? (q[k] as string) : "");
/** Build a patterns URL from the current query plus changes (null removes a key). */
function href(q: Query, change: Record<string, string | null>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...Object.fromEntries(Object.entries(q).filter(([, v]) => typeof v === "string")), ...change })) if (v) u.set(k, v as string);
  return `/dev/preview/patterns?${u.toString()}`;
}

function Fit({ good, bad }: { good: string; bad: string }) {
  return <div className="mb-6 grid gap-3 sm:grid-cols-2">
    <Notice tone="positive" title="Hợp với">{good}</Notice>
    <Notice tone="caution" title="Không hợp với">{bad}</Notice>
  </div>;
}

function SourceBadges({ s }: { s: DemoSource }) {
  return <><TierBadge tier={s.tier} /><SourceStatusBadge status={s.status}>{verificationLabel(s.status, s.verifiedAt ? new Date(s.verifiedAt) : null)}</SourceStatusBadge>{s.crawl && <Badge tone="accent">Đang crawl</Badge>}</>;
}

/** Pattern 1 and 2: the shared slide-over Inspector (components/ui/inspector.tsx). */
function SourceInspector({ s, closeHref }: { s: DemoSource; closeHref: string }) {
  return <Inspector title={s.name} subtitle={s.url} closeHref={closeHref}>
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><SourceBadges s={s} /></div>
      <DescriptionList items={[["Quốc gia", s.country ?? "Chưa gán"], ["Xác minh gần nhất", s.verifiedAt ?? "Chưa có"], ["Số tài liệu", String(s.documents)]]} />
      <fieldset disabled><SourceForm countries={[]} source={{ id: s.id, name: s.name, canonicalUrl: s.url, countryId: null, sourceTier: s.tier, sourceType: "demo", topics: ["demo"], language: "en", authorityNotes: null, status: s.status, crawlPolicy: "not_reviewed", crawlEnabled: s.crawl, crawlFrequency: null, notes: null }} /></fieldset>
    </div>
  </Inspector>;
}

function PatternInspector({ q }: { q: Query }) {
  const open = patternSources.find((s) => s.id === one(q, "open"));
  return <>
    <Fit good="Xem nhiều, sửa ít: danh sách dùng hết chiều rộng để hiện thêm thông tin; chỉ mở khung khi cần sửa. Trên điện thoại khung hiện như bảng trượt từ dưới lên. Nhấn Esc hoặc bấm ra ngoài để đóng."
      bad="Sửa liên tục nhiều mục (khung che một phần danh sách mỗi lần mở)." />
    <List label="DEMO nguồn">{patternSources.map((s) => <ListRow key={s.id} href={href(q, { open: s.id })} title={s.name} badges={<SourceBadges s={s} />}
      subtitle={`${s.url.replace("https://", "")} · ${s.country ?? "Chưa gán quốc gia"}`}
      trailing={<span className="hidden text-[13px] sm:block">{s.verifiedAt ? `Xác minh ${s.verifiedAt}` : "Chưa xác minh"}<span className="block text-ink-3">{s.documents} tài liệu</span></span>} />)}</List>
    {open && <SourceInspector s={open} closeHref={href(q, { open: null })} />}
  </>;
}

const tierOrder = (t: string | null) => (t ? Number(t.slice(1)) : 9);
const sorters: Record<string, (a: DemoSource, b: DemoSource) => number> = {
  name: (a, b) => a.name.localeCompare(b.name),
  tier: (a, b) => tierOrder(a.tier) - tierOrder(b.tier),
  status: (a, b) => a.status.localeCompare(b.status),
  country: (a, b) => (a.country ?? "~").localeCompare(b.country ?? "~"),
  verified: (a, b) => (b.verifiedAt ?? "").localeCompare(a.verifiedAt ?? ""),
  documents: (a, b) => b.documents - a.documents,
};

function PatternTable({ q }: { q: Query }) {
  const sort = sorters[one(q, "sort")] ? one(q, "sort") : "name";
  const desc = one(q, "dir") === "desc";
  const tier = one(q, "tier"), status = one(q, "status");
  const rows = patternSources.filter((s) => (!tier || (tier === "none" ? !s.tier : s.tier === tier)) && (!status || s.status === status))
    .sort((a, b) => (desc ? -1 : 1) * sorters[sort](a, b));
  const open = patternSources.find((s) => s.id === one(q, "open"));
  const col = (key: string, label: string) => <th scope="col" className="whitespace-nowrap px-4 py-2.5 text-left text-[13px] font-semibold text-ink-2">
    <Link scroll={false} href={href(q, { sort: key, dir: sort === key && !desc ? "desc" : null, open: null })} className="inline-flex items-center gap-1 hover:text-ink">
      {label}{sort === key && <span aria-hidden="true">{desc ? "↓" : "↑"}</span>}
    </Link></th>;
  const chip = (key: string, value: string, label: string) => <Link scroll={false} href={href(q, { [key]: one(q, key) === value ? null : value, open: null })}
    className={`rounded-full px-3 py-1 text-[13px] font-medium ${one(q, key) === value ? "bg-ink text-canvas" : "bg-fill text-ink-2 hover:bg-fill-strong"}`}>{label}</Link>;
  return <>
    <Fit good="So sánh nhiều nguồn cùng lúc, sắp xếp (bấm tiêu đề cột) và lọc nhanh, ví dụ tìm nguồn “Đã xác minh” nhưng “Chưa phân loại”. Bấm tên để mở khung sửa."
      bad="Màn hình điện thoại (phải cuộn ngang); danh sách ít mục." />
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-ink-3">Tier:</span>{chip("tier", "T1", "T1")}{chip("tier", "T2", "T2")}{chip("tier", "T3", "T3")}{chip("tier", "T4", "T4")}{chip("tier", "none", "Chưa phân loại")}
      <span className="ml-3 text-[13px] text-ink-3">Trạng thái:</span>{chip("status", "verified", "Đã xác minh")}{chip("status", "needs_verification", "Chưa xác minh")}{chip("status", "review_required", "Cần xem xét lại")}
    </div>
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
      <table className="w-full min-w-[46rem] border-collapse text-[15px]">
        <thead className="bg-fill/40"><tr className="border-b border-hairline">
          {col("name", "Tên")}{col("tier", "Tier")}{col("status", "Trạng thái")}{col("country", "Quốc gia")}{col("verified", "Xác minh")}{col("documents", "Tài liệu")}
          <th scope="col" className="px-4 py-2.5 text-left text-[13px] font-semibold text-ink-2">Crawl</th>
        </tr></thead>
        <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-hairline">{rows.map((s) => <tr key={s.id} className="hover:bg-fill/40">
          <td className="px-4 py-2.5"><Link scroll={false} href={href(q, { open: s.id })} className="font-medium text-ink hover:text-accent">{s.name}</Link></td>
          <td className="px-4 py-2.5"><TierBadge tier={s.tier} /></td>
          <td className="px-4 py-2.5"><SourceStatusBadge status={s.status}>{s.status === "verified" ? "Đã xác minh" : s.status === "review_required" ? "Cần xem xét lại" : "Chưa xác minh"}</SourceStatusBadge></td>
          <td className="px-4 py-2.5 text-ink-2">{s.country ?? "—"}</td>
          <td className="px-4 py-2.5 tabular-nums text-ink-2">{s.verifiedAt ?? "—"}</td>
          <td className="px-4 py-2.5 tabular-nums text-ink-2">{s.documents}</td>
          <td className="px-4 py-2.5 text-ink-2">{s.crawl ? "Bật" : "Tắt"}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="p-5 text-[15px] text-ink-2">Không có nguồn nào khớp bộ lọc.</p>}
    </div>
    <p className="mt-2 px-1 text-[13px] text-ink-3">{rows.length} / {patternSources.length} nguồn</p>
    {open && <SourceInspector s={open} closeHref={href(q, { open: null })} />}
  </>;
}

function PatternFocus({ q }: { q: Query }) {
  const n = demoFacts.length;
  const i = Math.min(Math.max(Number(one(q, "i")) || 0, 0), n);
  const done = one(q, "done");
  const at = (k: number) => href(q, { i: String(k), done: null });
  const next = (d: string) => href(q, { i: String(i + 1), done: d });
  if (i >= n) return <div className="mx-auto max-w-xl py-16 text-center">
    <p className="text-[34px]" aria-hidden="true">✓</p>
    <p className="mt-2 text-[22px] font-semibold text-ink">Đã xem hết {n} mục</p>
    <p className="mt-2 text-[15px] text-ink-2">Trên trang thật, danh sách “Chờ duyệt” lúc này sẽ trống.</p>
    <Link href={at(0)} className={`${buttonSecondary} mt-6`}>Xem lại từ đầu</Link>
  </div>;
  const fact = demoFacts[i].fact;
  return <div className="pb-40">
    <Fit good="Duyệt cả lô nhanh: một mục mỗi màn hình, nút cố định ở đáy, phím tắt A (duyệt), R (từ chối), J / → (bỏ qua), K / ← (quay lại). Nên là một nút chuyển chế độ bên cạnh bố cục chia đôi."
      bad="Khi cần nhìn toàn cảnh hàng chờ hoặc so sánh nhiều mục." />
    <div className="mb-5 flex items-center gap-4">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill" role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={i} aria-label="Tiến độ">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(i / n) * 100}%` }} />
      </div>
      <span className="text-[13px] tabular-nums text-ink-2">{i + 1} / {n}</span>
      <Link href="/dev/preview?section=review" className={`${textLink} text-[13px]`}>Thoát chế độ tập trung</Link>
    </div>
    {done && <p role="status" className="mb-4 rounded-xl bg-fill/60 px-4 py-2 text-[13px] text-ink-2">DEMO: mục trước được ghi “{decisionLabel(done).label}” (không lưu gì).</p>}
    <div className="mx-auto max-w-2xl"><FactCard fact={fact} internal /></div>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-canvas">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-5 py-3">
        <input aria-label="Ghi chú kiểm tra" placeholder="Ghi chú kiểm tra (bắt buộc trên trang thật)" className={`${control} mt-0 min-w-0 flex-1 basis-60`} />
        <Link href={at(Math.max(0, i - 1))} className={buttonSecondary} aria-label="Mục trước (K)">‹ <kbd className="text-[11px] text-ink-3">K</kbd></Link>
        <Link href={next("")} className={buttonSecondary}>Bỏ qua <kbd className="text-[11px] text-ink-3">J</kbd></Link>
        <Link href={next("rejected")} className={buttonDestructive}>Từ chối <kbd className="text-[11px] opacity-60">R</kbd></Link>
        <Link href={next("reviewed")} className={buttonPrimary}>Duyệt <kbd className="text-[11px] opacity-70">A</kbd></Link>
      </div>
    </div>
    <KeyNav keys={{ a: next("reviewed"), r: next("rejected"), j: next(""), ArrowRight: next(""), k: at(Math.max(0, i - 1)), ArrowLeft: at(Math.max(0, i - 1)) }} />
  </div>;
}

const sidebar: { id: string; label: string; icon: IconName; tint: Tint; count: number | null }[] = [
  { id: "facts", label: "Thông tin", icon: "facts", tint: "blue", count: 16 },
  { id: "education", label: "Trường & chương trình", icon: "education", tint: "orange", count: 12 },
  { id: "immigration", label: "Quy định nhập cư", icon: "immigration", tint: "teal", count: 3 },
  { id: "labour", label: "Nghề", icon: "labour", tint: "brown", count: 0 },
  { id: "sources", label: "Nguồn", icon: "registry", tint: "gray", count: 5 },
  { id: "access", label: "Phân quyền", icon: "access", tint: "red", count: null },
];

function PatternThree({ q }: { q: Query }) {
  const sec = sidebar.some((s) => s.id === one(q, "sec")) ? one(q, "sec") : "facts";
  const items = sec === "sources"
    ? patternSources.map((s) => ({ id: s.id, title: s.name, subtitle: s.country ?? "Chưa gán quốc gia" }))
    : demoFacts.map(({ fact: f }) => ({ id: f.id, title: `${f.subject} — ${f.predicate}`, subtitle: `${f.value}${f.unit ? " " + f.unit : ""}` }));
  const sel = items.find((it) => it.id === one(q, "item")) ?? items[0];
  const source = patternSources.find((s) => s.id === sel.id);
  const fact = demoFacts.find((d) => d.fact.id === sel.id)?.fact;
  return <>
    <Fit good="Làm việc hằng ngày trong khu biên tập: chuyển giữa các khu vực ngay ở cột trái (kèm số việc chờ), không phải quay về dashboard; thay được thanh “Quy trình duyệt”."
      bad="Laptop nhỏ (ba cột chật); người chỉ vào thỉnh thoảng." />
    <div className="grid gap-4 lg:grid-cols-[13rem_18rem_minmax(0,1fr)] lg:items-start">
      <nav aria-label="Khu vực" className="flex gap-2 overflow-x-auto lg:sticky lg:top-20 lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {sidebar.map((s) => <Link key={s.id} scroll={false} href={href(q, { sec: s.id, item: null })} aria-current={s.id === sec ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[14px] ${s.id === sec ? "bg-fill font-semibold text-ink" : "text-ink-2 hover:bg-fill/60"}`}>
          <AppIcon icon={s.icon} tint={s.tint} size={24} /><span className="flex-1 whitespace-nowrap">{s.label}</span>
          {s.count !== null && <span className={`text-[12px] tabular-nums ${s.count ? "font-semibold text-accent" : "text-ink-3"}`}>{s.count || "✓"}</span>}
        </Link>)}
      </nav>
      <ul aria-label="Danh sách" className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto [&>li+li]:border-t [&>li+li]:border-hairline">
        {items.map((it) => <li key={it.id}><Link scroll={false} href={href(q, { item: it.id })} aria-current={it.id === sel.id ? "true" : undefined}
          className={`block px-4 py-3 ${it.id === sel.id ? "bg-accent/10" : "hover:bg-fill/60"}`}>
          <span className="block truncate text-[14px] font-medium text-ink">{it.title}</span><span className="block truncate text-[12px] text-ink-2">{it.subtitle}</span>
        </Link></li>)}
      </ul>
      <div className="min-w-0">
        {fact && <FactCard fact={fact} internal />}
        {source && <div className="space-y-3"><div className="flex flex-wrap gap-2"><SourceBadges s={source} /></div>
          <DescriptionList items={[["Tên", source.name], ["URL", source.url], ["Quốc gia", source.country ?? "Chưa gán"], ["Xác minh gần nhất", source.verifiedAt ?? "Chưa có"]]} /></div>}
      </div>
    </div>
  </>;
}

function PatternCards({ q }: { q: Query }) {
  const country = one(q, "country");
  const list = patternUniversities.filter((u) => !country || u.country === country);
  return <>
    <Fit good="Trang công khai để khám phá (quốc gia, trường, chương trình): mỗi mục là một thẻ dễ quét, có thông tin nổi bật và nhãn nguồn."
      bad="Trang quản trị hoặc duyệt (tốn diện tích, khó so sánh chi tiết)." />
    <div className="mb-5 flex flex-wrap gap-2">
      {["", "Sweden", "Denmark", "Finland"].map((c) => <Link key={c || "all"} scroll={false} href={href(q, { country: c || null })}
        className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${country === c ? "bg-ink text-canvas" : "bg-fill text-ink-2 hover:bg-fill-strong"}`}>{c || "Tất cả"}</Link>)}
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((u) => <article key={u.id} className="group flex flex-col rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{u.country}</p>
        <h3 className="mt-1 text-[19px] font-semibold leading-snug text-ink">{u.name}</h3>
        <p className="mt-2 text-[14px] text-ink-2">{u.programmes} chương trình · {u.language}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{u.degrees.map((d) => <Badge key={d}>{d}</Badge>)}</div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <span className="flex items-center gap-2 text-[12px] text-ink-3">Nguồn <TierBadge tier={u.source} /></span>
          <span className="inline-flex items-center gap-1 text-[14px] font-medium text-accent">Xem chi tiết<Chevron className="text-accent transition-transform group-hover:translate-x-0.5" /></span>
        </div>
      </article>)}
    </div>
  </>;
}

function PatternAccordion() {
  return <>
    <Fit good="Danh sách ngắn, ít thao tác (nhật ký, lịch sử quyết định, câu hỏi thường gặp): mỗi dòng mở ra tại chỗ, mở dòng này thì dòng kia tự đóng."
      bad="Nội dung dài hoặc có form (trang bị đẩy dài ra như trước đây)." />
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline [&>details+details]:border-t [&>details+details]:border-hairline">
      {/* Native exclusive accordion: <details> sharing a `name` close each other, no JavaScript. */}
      {patternLog.map((e, i) => {
        const d = decisionLabel(e.decision);
        return <details key={e.id} name="demo-log" open={i === 0} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-fill/40 [&::-webkit-details-marker]:hidden">
            <Chevron className="shrink-0 transition-transform group-open:rotate-90" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{e.title}</span>
            <Badge tone={d.tone}>{d.label}</Badge>
            <span className="hidden text-[13px] tabular-nums text-ink-3 sm:block">{decisionTime(e.at)}</span>
          </summary>
          <div className="px-5 pb-4 pl-12 text-[15px] text-ink-2">{e.note}<p className="mt-1 text-[13px] text-ink-3 sm:hidden">{decisionTime(e.at)}</p></div>
        </details>;
      })}
    </div>
  </>;
}

export default async function PatternsPage({ searchParams }: PageProps<"/dev/preview/patterns">) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = (await searchParams) as Query;
  const p: Pattern = patterns.some(([id]) => id === one(q, "p")) ? (one(q, "p") as Pattern) : "inspector";
  return <>
    <div className="mb-8"><Notice tone="caution" role="alert" title="DEMO — dữ liệu giả chỉ để xem giao diện">
      Mọi tên, số và URL trên trang này là hư cấu (domain <code>example.test</code>) và không được ghi vào database. Nút và form không lưu gì. Trang chỉ tồn tại khi chạy dev.
    </Notice></div>
    <PageHeader eyebrow="Development" title="Các kiểu bố cục"
      description={<>Sáu cách trình bày cùng dữ liệu DEMO để so sánh. Bố cục chia đôi đang dùng ở trang thật có tại <Link href="/dev/preview?section=review" className={textLink}>Review split view</Link> và <Link href="/dev/preview?section=sources-admin" className={textLink}>Sources admin</Link>.</>} />
    <Segmented label="Kiểu bố cục" items={patterns.map(([id, label]) => ({ href: `/dev/preview/patterns?p=${id}`, label, active: p === id }))} />
    <div className="mt-2">
      {p === "inspector" && <PatternInspector q={q} />}
      {p === "table" && <PatternTable q={q} />}
      {p === "focus" && <PatternFocus q={q} />}
      {p === "three" && <PatternThree q={q} />}
      {p === "cards" && <PatternCards q={q} />}
      {p === "accordion" && <PatternAccordion />}
    </div>
  </>;
}
