import Link from "next/link";
import { KeyNav } from "@/components/key-nav";

/**
 * A panel that slides over the page from the right (a bottom sheet on
 * phones), like the Inspector in Finder or Reminders. It is open while its
 * URL parameter is set (e.g. ?user=…): closing is a link that removes it, so
 * it works without client state; Esc does the same through KeyNav.
 *
 * The panel scrolls on its own, so a sticky footer inside it (a save bar)
 * stays in view. No backdrop blur here, on the scrim or on sticky bars: a
 * blur over content that moves repaints every frame and made scrolling
 * stutter (2026-09-30). Solid backgrounds cost nothing.
 */
export function Inspector({ title, subtitle, closeHref, children }: {
  title: React.ReactNode; subtitle?: React.ReactNode; closeHref: string; children: React.ReactNode;
}) {
  return <>
    <Link href={closeHref} scroll={false} aria-label="Đóng khung chi tiết" className="fixed inset-0 z-40 bg-black/30" />
    <aside role="dialog" aria-modal="true" aria-labelledby="inspector-title"
      className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-3xl bg-canvas shadow-[0_-8px_40px_rgb(0_0_0/0.18)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[36rem] lg:rounded-none lg:rounded-l-3xl">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-hairline bg-canvas px-6 py-4">
        <div className="min-w-0">
          <p id="inspector-title" className="truncate text-[17px] font-semibold text-ink">{title}</p>
          {subtitle && <div className="truncate text-[13px] text-ink-3">{subtitle}</div>}
        </div>
        <Link href={closeHref} scroll={false} aria-label="Đóng" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fill text-ink-2 hover:bg-fill-strong">✕</Link>
      </div>
      <div className="px-6 pb-6 pt-5">{children}</div>
    </aside>
    <KeyNav keys={{ Escape: closeHref }} />
  </>;
}
