import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import Link from "next/link";
import { Chevron } from "@/components/ui";

/**
 * Master–detail layout in the style of Apple Mail: a compact list on the left
 * with its own scroll, the selected item on the right. Selection lives in the
 * URL (?fact=…), so it survives reloads and works without client JavaScript.
 *
 * WHY: the review queue used to render up to 25 full cards with open forms,
 * so reviewers scrolled a very long page to reach the pager and back up to
 * the tabs. Here the list stays in view (sticky) and only one item is open.
 *
 * On wide screens both panes are sticky with their own scroll.
 * Below 1024px there is room for one pane: without an explicit selection the
 * list shows; with one, the detail shows with a "Danh sách" back link.
 */
export function SplitView({ list, detail, detailKey, detailOnMobile, backHref, paneScroll = true }: {
  list: React.ReactNode; detail: React.ReactNode; detailKey?: string; detailOnMobile: boolean; backHref: string;
  /** false: the detail scrolls with the page (for long forms whose save bar sticks to the bottom of the window). */
  paneScroll?: boolean;
}) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
    <div className={`${detailOnMobile ? "hidden lg:block" : ""} lg:sticky lg:top-20`}>
      <div className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline lg:max-h-[calc(100vh-7rem)]">
        {list}
      </div>
    </div>
    {/* On wide screens both panes scroll on their own, like Mail, so the page
        never has to move. `key` remounts the pane for each item, which resets
        its scroll to the top when the queue advances after a decision. */}
    <div key={detailKey} className={`min-w-0 ${paneScroll ? "lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1" : ""} ${detailOnMobile ? "" : "hidden lg:block"}`}>
      {detailOnMobile && <Link href={backHref} scroll={false} className="mb-4 inline-flex items-center gap-1.5 text-[15px] text-accent lg:hidden">
        <Chevron className="rotate-180 text-accent" />Danh sách
      </Link>}
      {detail}
    </div>
  </div>;
}

/** The scrolling list inside the left pane, with a footer that stays visible. */
export function SplitList({ label, children, footer }: { label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return <>
    <ul aria-label={label} className="min-h-0 flex-1 overflow-y-auto [&>li+li]:border-t [&>li+li]:border-hairline">{children}</ul>
    {footer && <div className="border-t border-hairline bg-surface px-4 py-2.5">{footer}</div>}
  </>;
}

/**
 * One selectable row: title, one quiet line, small badges. `scroll={false}`
 * keeps the page where it is when switching items.
 */
export function SplitRow({ href, selected, explicit = true, title, subtitle, badges }: {
  href: string; selected: boolean; title: React.ReactNode; subtitle?: React.ReactNode; badges?: React.ReactNode;
  /** false when the row is only the default pick: on narrow screens no detail is open, so it is not highlighted there. */
  explicit?: boolean;
}) {
  const hl = selected ? (explicit ? "bg-accent/10" : "hover:bg-fill/60 lg:bg-accent/10") : "hover:bg-fill/60";
  return <li>
    <Link href={href} scroll={false} aria-current={selected ? "true" : undefined}
      className={`block px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent active:bg-fill/70 ${hl}`}>
      <span className={`block truncate text-[15px] leading-snug ${selected ? "font-semibold text-ink" : "font-medium text-ink"}`}>{title}</span>
      {subtitle && <span className="mt-0.5 block truncate text-[13px] leading-snug text-ink-2">{subtitle}</span>}
      {badges && <span className="mt-1.5 flex flex-wrap gap-1.5">{badges}</span>}
    </Link>
  </li>;
}

type PageSummary = { pages: number; current: number; first: number; last: number; total: number; hasPrev: boolean; hasNext: boolean };

/** Compact pager for the list footer: "1–25 / 60" with previous/next. */
export function SplitPager({ summary, href, locale = defaultLocale }: { summary: PageSummary; href: (page: number) => string; locale?: Locale }) {
  if (summary.total === 0) return null;
  const c = dictionaries[locale].common;
  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-full";
  return <nav aria-label={c.pagination} className="flex items-center justify-between gap-3">
    <span className="text-[13px] text-ink-3 tabular-nums">{summary.first}–{summary.last} / {summary.total}</span>
    {summary.pages > 1 && <span className="flex items-center gap-1">
      {summary.hasPrev ? <Link href={href(summary.current - 1)} scroll={false} aria-label={c.previous} className={`${btn} bg-fill hover:bg-fill-strong`}><Chevron className="rotate-180 text-ink" /></Link>
        : <span aria-disabled="true" className={`${btn} bg-fill/50`}><Chevron className="rotate-180 text-ink-3" /></span>}
      <span className="px-1 text-[13px] text-ink-2 tabular-nums">{summary.current}/{summary.pages}</span>
      {summary.hasNext ? <Link href={href(summary.current + 1)} scroll={false} aria-label={c.next} className={`${btn} bg-fill hover:bg-fill-strong`}><Chevron className="text-ink" /></Link>
        : <span aria-disabled="true" className={`${btn} bg-fill/50`}><Chevron className="text-ink-3" /></span>}
    </span>}
  </nav>;
}

/** "‹ 3 / 25 ›" above the detail: move through the page without the list. */
export function ItemStepper({ index, count, prevHref, nextHref, locale = defaultLocale }: { index: number; count: number; prevHref: string | null; nextHref: string | null; locale?: Locale }) {
  const t = dictionaries[locale].review;
  const btn = "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium";
  return <div className="mb-4 flex items-center justify-end gap-2">
    {prevHref ? <Link href={prevHref} scroll={false} className={`${btn} bg-fill text-ink hover:bg-fill-strong`}><Chevron className="rotate-180 text-ink" />{t.previous}</Link>
      : <span aria-disabled="true" className={`${btn} bg-fill/50 text-ink-3`}>{t.previous}</span>}
    <span className="px-1 text-[13px] text-ink-3 tabular-nums">{index + 1} / {count}</span>
    {nextHref ? <Link href={nextHref} scroll={false} className={`${btn} bg-fill text-ink hover:bg-fill-strong`}>{t.next}<Chevron className="text-ink" /></Link>
      : <span aria-disabled="true" className={`${btn} bg-fill/50 text-ink-3`}>{t.next}</span>}
  </div>;
}
