import Link from "next/link";
import type { IconName, Tint, Tile } from "@/lib/dashboard/items";
import { Chevron } from "@/components/ui";

// App-icon style glyphs: white strokes on a rounded, tinted square, like the
// icons in iOS Settings / iCloud. Decorative only (the title carries meaning).
// Tints are Apple's system colours; white-on-colour is used for the glyph only.
const tints: Record<Tint, string> = {
  blue: "#007aff", green: "#34c759", orange: "#ff9500", indigo: "#5856d6", teal: "#30b0c7",
  purple: "#af52de", pink: "#ff2d55", gray: "#8e8e93", red: "#ff3b30", brown: "#a2845e",
};
const paths: Record<IconName, string> = {
  person: "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 6.5c.6-2.6 2.8-4 5.5-4s4.9 1.4 5.5 4",
  plan: "M5 17V3.5M5 4h8.5l-1.8 3 1.8 3H5",
  facts: "M6 3.5h6l3 3V16.5H6ZM12 3.5v3h3M8.5 11l1.5 1.5 3-3.5",
  education: "M2.5 8 10 4.5 17.5 8 10 11.5ZM5.5 9.5V13c1.2 1.2 2.7 1.8 4.5 1.8s3.3-.6 4.5-1.8V9.5",
  immigration: "M5.5 3.5h9v13h-9ZM10 11a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM8 14h4",
  labour: "M3.5 7h13v8.5h-13ZM7.5 7V5h5v2M3.5 11h13",
  import: "M10 3.5v8M7 8.5l3 3 3-3M4 12v3.5h12V12",
  registry: "M4 5.5c0-1.1 2.7-2 6-2s6 .9 6 2-2.7 2-6 2-6-.9-6-2Zm0 0v9c0 1.1 2.7 2 6 2s6-.9 6-2v-9M4 10c0 1.1 2.7 2 6 2s6-.9 6-2",
  sparkles: "M9 3.5l1.4 3.6L14 8.5l-3.6 1.4L9 13.5l-1.4-3.6L4 8.5l3.6-1.4ZM14.5 12.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6Z",
  crawler: "M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM3.5 10h13M10 3.5c1.8 1.8 2.6 4 2.6 6.5S11.8 14.7 10 16.5M10 3.5C8.2 5.3 7.4 7.5 7.4 10s.8 4.7 2.6 6.5",
  chart: "M4 16V9.5M8 16V5M12 16v-4.5M16 16V7.5",
  access: "M8 10a2.7 2.7 0 1 0 0-5.4A2.7 2.7 0 0 0 8 10Zm-4.5 6c.5-2.3 2.3-3.6 4.5-3.6s4 1.3 4.5 3.6M13.5 9.5a2.2 2.2 0 1 0 0-4.4M14.5 12.6c1.2.4 2 1.4 2.3 2.9",
  globe: "M10 16.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM3.5 10h13M10 3.5c1.8 1.8 2.6 4 2.6 6.5S11.8 14.7 10 16.5M10 3.5C8.2 5.3 7.4 7.5 7.4 10s.8 4.7 2.6 6.5",
  document: "M6 3.5h6l3 3V16.5H6ZM12 3.5v3h3M8 10h5M8 13h5",
  gauge: "M3.5 13.5a6.5 6.5 0 1 1 13 0M10 13.5l3-4M5.5 13.5h1M13.5 13.5h1",
  books: "M4 4.5h3.5v11H4ZM8.5 4.5H12v11H8.5ZM13 5.2l3.2-.8 2.3 10.4-3.2.8Z",
};

export function AppIcon({ icon, tint, size = 40 }: { icon: IconName; tint: Tint; size?: number }) {
  return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-[22%] shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)]"
    style={{ width: size, height: size, background: tints[tint] }}>
    <svg viewBox="0 0 20 20" style={{ width: size * 0.55, height: size * 0.55 }}>
      <path d={paths[icon]} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>;
}

/** One destination: icon, title, one line of description, whole tile clickable. */
export function TileLink({ tile }: { tile: Tile }) {
  return <Link href={tile.href}
    className="group flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_6px_18px_rgb(0_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
    <AppIcon icon={tile.icon} tint={tile.tint} />
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold text-ink">{tile.title}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{tile.description}</span>
    </span>
    <Chevron className="transition-transform group-hover:translate-x-0.5" />
  </Link>;
}

/**
 * "Needs attention" figure, like an Apple Health summary: the number is the
 * headline. Zero stays calm (no colour); a pending count uses the accent.
 * `null` means the count could not be loaded — shown as "—", never as 0.
 */
export function CounterTile({ label, href, value }: { label: string; href: string; value: number | null }) {
  const pending = (value ?? 0) > 0;
  return <Link href={href} className="group flex flex-col justify-between rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_6px_18px_rgb(0_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
    <span className="flex items-start justify-between gap-2 text-[13px] font-medium leading-snug text-ink-2">{label}<Chevron className="mt-0.5" /></span>
    <span className={`mt-3 text-[34px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${pending ? "text-accent" : "text-ink"}`}>
      {value === null ? "—" : value.toLocaleString("vi-VN")}
    </span>
    <span className="mt-1.5 text-[12px] text-ink-3">{value === null ? "Không tải được" : pending ? "Cần xử lý" : "Không có gì đang chờ"}</span>
  </Link>;
}
