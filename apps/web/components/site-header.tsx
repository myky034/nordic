import Link from "next/link";
import { NavLinks } from "./nav-links";

// One global navigation bar for public and signed-in pages. A light
// translucent surface with backdrop blur, used only here (spec: blur sparingly).
function SearchLink() {
  return <Link href="/search" aria-label="Search" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition hover:bg-fill hover:text-ink">
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  </Link>;
}

export function SiteHeader({ right }: { right?: React.ReactNode }) {
  return <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
    <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-[15px] font-semibold tracking-[0.18em] text-ink">NORDIC</Link>
        <div className="flex items-center gap-1 sm:hidden"><SearchLink />{right}</div>
      </div>
      <div className="min-w-0 flex-1"><NavLinks /></div>
      <div className="hidden items-center gap-1 sm:flex"><SearchLink />{right}</div>
    </div>
  </header>;
}

export function SiteFooter() {
  return <footer className="mt-24 border-t border-hairline">
    <div className="mx-auto max-w-6xl px-5 py-8 text-[13px] leading-relaxed text-ink-3 sm:px-8">
      <p>Nordic is a research tool. Every claim links to its source; nothing here is legal, immigration or financial advice.</p>
      <p className="mt-1">Thông tin nghiên cứu — luôn kiểm tra lại tại nguồn chính thức.</p>
    </div>
  </footer>;
}

export function WorkspaceLink() {
  return <Link href="/dashboard" className="inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-[13px] font-medium text-canvas transition hover:opacity-85">Workspace</Link>;
}
