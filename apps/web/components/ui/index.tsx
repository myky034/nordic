import Link from "next/link";
import { label as labelClass } from "./styles";

// Small, dependency-free UI primitives (Apple-HIG-inspired):
// large titles, inset grouped lists, hairline separators, restrained colour.
// Keep business rules out of here — these only lay out what they are given.

export function Chevron({ className = "" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 8 14" className={`h-3.5 w-2 shrink-0 text-ink-3 ${className}`}><path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1.5 text-[15px] text-accent hover:underline underline-offset-4">
    <Chevron className="rotate-180 text-accent" />{children}
  </Link>;
}

export function PageHeader({ eyebrow, title, description, actions, back }: {
  eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode;
}) {
  return <header className="mb-10">
    {back && <div className="mb-6">{back}</div>}
    {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-3">{eyebrow}</p>}
    <div className="mt-1.5 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.022em] text-ink sm:text-[40px]">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
    {description && <div className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-2">{description}</div>}
  </header>;
}

export function Section({ title, description, actions, children, className = "" }: {
  title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return <section className={`mt-12 first:mt-0 ${className}`}>
    {(title || actions) && <div className="mb-3 flex flex-wrap items-end justify-between gap-3 px-1">
      {title && <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>}
      {actions}
    </div>}
    {description && <div className="mb-4 max-w-2xl px-1 text-[15px] leading-relaxed text-ink-2">{description}</div>}
    {children}
  </section>;
}

/** Inset grouped list: one rounded surface, rows split by inset hairlines. */
export function List({ children, label }: { children: React.ReactNode; label?: string }) {
  return <ul aria-label={label} className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline [&>li+li]:border-t [&>li+li]:border-hairline">{children}</ul>;
}

/**
 * One list row. With `href` the whole row is a link (chevron on the right);
 * without it the row is static and may contain its own controls in `children`.
 */
export function ListRow({ href, title, subtitle, meta, badges, trailing, children }: {
  href?: string; title: React.ReactNode; subtitle?: React.ReactNode; meta?: React.ReactNode;
  badges?: React.ReactNode; trailing?: React.ReactNode; children?: React.ReactNode;
}) {
  // Compact (about 60px for two lines) so a screen shows roughly twice as many
  // rows as a card layout. Put extra detail on the detail page, not in the row.
  const body = <div className="flex items-center gap-4 px-5 py-3">
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[16px] font-medium leading-snug text-ink">{title}</span>
        {badges}
      </div>
      {subtitle && <div className="mt-0.5 truncate text-[14px] leading-snug text-ink-2">{subtitle}</div>}
      {meta && <div className="mt-0.5 text-[13px] leading-snug text-ink-3">{meta}</div>}
    </div>
    {trailing && <div className="shrink-0 text-right text-[15px] text-ink-2">{trailing}</div>}
    {href && <Chevron />}
  </div>;
  return <li>
    {href ? <Link href={href} className="block transition-colors hover:bg-fill/60 focus-visible:bg-fill/60">{body}</Link> : body}
    {children && <div className="px-5 pb-3">{children}</div>}
  </li>;
}

export type Tone = "neutral" | "accent" | "positive" | "caution" | "critical";
const tones: Record<Tone, string> = {
  neutral: "bg-fill text-ink-2",
  accent: "bg-accent/10 text-accent",
  positive: "bg-positive/12 text-positive",
  caution: "bg-caution/12 text-caution",
  critical: "bg-critical/10 text-critical",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium leading-5 ${tones[tone]}`}>{children}</span>;
}

export function EmptyState({ title, children, action }: { title?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-hairline bg-surface/60 px-6 py-10 text-center">
    {title && <p className="text-[17px] font-medium text-ink">{title}</p>}
    <div className={`mx-auto max-w-lg text-[15px] leading-relaxed text-ink-2 ${title ? "mt-2" : ""}`}>{children}</div>
    {action && <div className="mt-5">{action}</div>}
  </div>;
}

const noticeTones: Record<Tone, string> = {
  neutral: "bg-surface ring-hairline text-ink",
  accent: "bg-accent/[0.06] ring-accent/20 text-ink",
  positive: "bg-positive/[0.07] ring-positive/25 text-ink",
  caution: "bg-caution/[0.08] ring-caution/25 text-ink",
  critical: "bg-critical/[0.06] ring-critical/25 text-ink",
};
/** Callout for disclaimers, warnings and conflicts. `role` is chosen by the caller. */
export function Notice({ tone = "neutral", title, children, role = "note" }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode; role?: "note" | "alert" | "status" }) {
  return <div role={role} className={`rounded-2xl px-5 py-4 text-[15px] leading-relaxed ring-1 ${noticeTones[tone]}`}>
    {title && <p className="font-semibold">{title}</p>}
    {children && <div className={title ? "mt-1 text-ink-2" : ""}>{children}</div>}
  </div>;
}

/** Plain surface for forms and detail blocks. Do not nest cards inside cards. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline sm:p-7 ${className}`}>{children}</div>;
}

export function DescriptionList({ items }: { items: [React.ReactNode, React.ReactNode][] }) {
  return <dl className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline [&>div+div]:border-t [&>div+div]:border-hairline">
    {items.map(([term, value], i) => <div key={i} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[minmax(10rem,14rem)_1fr] sm:gap-6">
      <dt className="text-[15px] text-ink-2">{term}</dt>
      <dd className="min-w-0 break-words text-[15px] text-ink">{value}</dd>
    </div>)}
  </dl>;
}

/** Native <details> styled as a disclosure row: progressive disclosure without JS. */
export function Disclosure({ summary, children, className = "", small = false, open }: { summary: React.ReactNode; children: React.ReactNode; className?: string; small?: boolean; open?: boolean }) {
  return <details open={open} className={`group ${className}`}>
    <summary className={`inline-flex cursor-pointer select-none items-center gap-1.5 font-medium text-accent ${small ? "text-[13px]" : "text-[15px]"}`}>
      <Chevron className="text-accent transition-transform group-open:rotate-90" />{summary}
    </summary>
    <div className="mt-4">{children}</div>
  </details>;
}

export function Field({ label, hint, children, className = "" }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <label className={`block ${className}`}>
    <span className={labelClass}>{label}</span>
    {children}
    {hint && <span className="mt-1.5 block text-[13px] leading-snug text-ink-3">{hint}</span>}
  </label>;
}

export function FormMessage({ error, message }: { error?: string; message?: string }) {
  return <>
    {error && <p role="alert" className="rounded-xl bg-critical/[0.07] px-4 py-3 text-[15px] text-critical">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-positive/[0.08] px-4 py-3 text-[15px] text-positive">{message}</p>}
  </>;
}

/** Filter bar surface for GET filter forms. */
export const filterBar = "mb-8 grid items-end gap-4 rounded-2xl bg-surface p-5 ring-1 ring-hairline sm:grid-cols-2 lg:grid-cols-4";

export function ResultCount({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 px-1 text-[13px] text-ink-3">{children}</p>;
}

/** `quiet` is for URLs shown as data inside list rows, so rows are not a wall of blue. */
export function ExternalLink({ href, children, className = "", quiet = false }: { href: string; children: React.ReactNode; className?: string; quiet?: boolean }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`break-all underline-offset-4 hover:underline ${quiet ? "text-ink-2 hover:text-accent" : "text-accent"} ${className}`}>
    {children}<span aria-hidden="true"> ↗</span><span className="sr-only"> (opens in a new tab)</span>
  </a>;
}

export function Quote({ children }: { children: React.ReactNode }) {
  return <blockquote className="whitespace-pre-wrap break-words rounded-xl bg-fill/50 px-4 py-3 text-[15px] leading-relaxed text-ink">{children}</blockquote>;
}

/** Shown when a signed-in user lacks the capability for a workspace page. */
export function NoAccess({ title, children, back = "/dashboard", backLabel = "Về workspace" }: { title: string; children: React.ReactNode; back?: string; backLabel?: string }) {
  return <section className="py-10">
    <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
    <div className="mt-3 max-w-xl text-[17px] leading-relaxed text-ink-2">{children}</div>
    <Link href={back} className="mt-6 inline-block text-[15px] text-accent hover:underline underline-offset-4">{backLabel}</Link>
  </section>;
}

/** "1 programme" / "3 programmes" — counts read naturally in result lines. */
export function countLabel(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Page navigation for server-paginated lists. Links (not buttons) so every page
 * has a shareable URL and the browser Back button returns to the same page.
 */
export function Pagination({ summary, href }: {
  summary: { pages: number; current: number; first: number; last: number; total: number; hasPrev: boolean; hasNext: boolean };
  href: (page: number) => string;
}) {
  if (summary.total === 0) return null;
  const link = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-medium transition";
  return <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 px-1">
    <p className="text-[13px] text-ink-3">{summary.first}–{summary.last} of {summary.total}</p>
    {summary.pages > 1 && <div className="flex items-center gap-2">
      {summary.hasPrev ? <Link href={href(summary.current - 1)} className={`${link} bg-fill text-ink hover:bg-fill-strong`}><Chevron className="rotate-180 text-ink" />Previous</Link>
        : <span aria-disabled="true" className={`${link} bg-fill/50 text-ink-3`}>Previous</span>}
      <span className="px-2 text-[13px] text-ink-2">Page {summary.current} of {summary.pages}</span>
      {summary.hasNext ? <Link href={href(summary.current + 1)} className={`${link} bg-fill text-ink hover:bg-fill-strong`}>Next<Chevron className="text-ink" /></Link>
        : <span aria-disabled="true" className={`${link} bg-fill/50 text-ink-3`}>Next</span>}
    </div>}
  </nav>;
}

/** iOS-style segmented control rendered as links (state lives in the URL). */
export function Segmented({ items, label }: { items: { href: string; label: React.ReactNode; count?: number; active: boolean }[]; label: string }) {
  return <nav aria-label={label} className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-fill p-1 [scrollbar-width:none]">
    {items.map((item, i) => <Link key={i} href={item.href} aria-current={item.active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-medium transition ${item.active ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink"}`}>
      {item.label}{item.count !== undefined && <span className={`text-[12px] tabular-nums ${item.active ? "text-ink-2" : "text-ink-3"}`}>{item.count}</span>}
    </Link>)}
  </nav>;
}

/** Search input with a magnifier icon; submit happens through the parent GET form. */
export function SearchInput({ defaultValue, placeholder, name = "q" }: { defaultValue: string; placeholder: string; name?: string }) {
  return <div className="relative">
    <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    <input type="search" name={name} defaultValue={defaultValue} placeholder={placeholder} maxLength={100} aria-label={placeholder}
      className="block w-full rounded-xl border border-hairline bg-surface py-2.5 pl-10 pr-3.5 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15" />
  </div>;
}
