import Link from "next/link";
import { AppIcon } from "@/app/(app)/dashboard/tiles";
import type { IconName, Tint } from "@/lib/dashboard/items";
import { Chevron } from "@/components/ui";

/**
 * One topic of a country (study, permits, work): what exists — counted with
 * the same public conditions as the list it links to — a few recently
 * reviewed items, and the way into the full, filtered list. Same visual
 * language as the home page goal cards.
 */
export function TopicCard({ title, icon, tint, lines, items, links }: {
  title: string; icon: IconName; tint: Tint;
  /** Count sentences from countLine(); a zero reads "Chưa có … được duyệt". */
  lines: string[];
  items: { href: string; label: string }[];
  links: { href: string; label: string }[];
}) {
  return <section aria-label={title} className="flex flex-col rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
    <div className="flex items-center gap-3"><AppIcon icon={icon} tint={tint} size={36} /><h3 className="text-[17px] font-semibold text-ink">{title}</h3></div>
    <ul className="mt-4 space-y-0.5">{lines.map((l) => <li key={l} className="text-[15px] font-medium text-ink">{l}</li>)}</ul>
    {items.length > 0 && <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3 text-[14px]" aria-label="Mới duyệt gần đây">
      {items.map((i) => <li key={i.href} className="truncate"><Link href={i.href} className="text-ink-2 hover:text-accent">{i.label}</Link></li>)}
    </ul>}
    <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4">
      {links.map((l) => <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 text-[15px] font-medium text-accent underline-offset-4 hover:underline">{l.label}<Chevron className="text-accent" /></Link>)}
    </div>
  </section>;
}
