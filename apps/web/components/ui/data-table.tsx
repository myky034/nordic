import Link from "next/link";
import { Chevron } from "./index";
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";

export type Column = { label: string; sortHref?: string; sorted?: "asc" | "desc" | null; className?: string };

/**
 * A data table in the style of Numbers: sortable headers (links, so sorting
 * lives in the URL), hairline rows, and horizontal scroll on narrow screens.
 * The header is not sticky: inside a horizontally scrolling box, sticky would
 * follow the box, not the window.
 */
export function DataTable({ label, columns, minWidth = "40rem", children, empty, locale = defaultLocale }: {
  label: string; columns: Column[]; minWidth?: string; children: React.ReactNode; empty?: React.ReactNode; locale?: Locale;
}) {
  return <div className="overflow-x-auto rounded-2xl bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
    <table aria-label={label} className="w-full border-collapse text-[15px]" style={{ minWidth }}>
      <thead className="bg-fill/40"><tr className="border-b border-hairline">
        {columns.map((c) => <th key={c.label} scope="col" aria-sort={c.sorted === "asc" ? "ascending" : c.sorted === "desc" ? "descending" : undefined}
          className={`whitespace-nowrap px-4 py-2.5 text-left text-[13px] font-semibold text-ink-2 ${c.className ?? ""}`}>
          {c.sortHref ? <Link scroll={false} href={c.sortHref} className="inline-flex items-center gap-1 hover:text-ink">
            {c.label}{c.sorted && <span aria-hidden="true">{c.sorted === "desc" ? "↓" : "↑"}</span>}
          </Link> : c.label}
        </th>)}
        <th scope="col" className="w-10"><span className="sr-only">{dictionaries[locale].common.open}</span></th>
      </tr></thead>
      <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-hairline">{children}</tbody>
    </table>
    {empty}
  </div>;
}

/**
 * One row that opens its item: the first cell holds the link and its
 * `after:` pseudo-element stretches over the whole row, so the row is one
 * large click target while screen readers still meet a single named link.
 */
export function DataRow({ href, title, selected, children }: { href: string; title: React.ReactNode; selected?: boolean; children?: React.ReactNode }) {
  return <tr className={`relative ${selected ? "bg-accent/10" : "hover:bg-fill/40 active:bg-fill/70"}`}>
    <td className="px-4 py-3"><Link scroll={false} href={href} className="font-medium text-ink after:absolute after:inset-0 hover:text-accent">{title}</Link></td>
    {children}
    <td className="pr-4 text-right"><Chevron /></td>
  </tr>;
}

export function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-ink-2 ${className}`}>{children}</td>;
}
