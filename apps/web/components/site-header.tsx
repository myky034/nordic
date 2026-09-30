import Link from "next/link";
import { Suspense } from "react";
import { MobileMenu, NavLinks } from "./nav-links";
import { AccountActions } from "./account-actions";

// One global navigation bar for public and signed-in pages. A light
// translucent surface with backdrop blur, used only here (spec: blur sparingly).
function SearchLink() {
  return <Link href="/search" aria-label="Search" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition hover:bg-fill hover:text-ink">
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  </Link>;
}

export function SiteHeader() {
  // One row at every width: logo, grouped navigation (md+), then search,
  // account and — below 1024px (lg) — the Menu button. lg, not a tablet width,
  // because signed-in pages show two account buttons and the bar must never
  // truncate labels. The sticky header anchors the full-width group panels.
  return <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur-md">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:px-8">
      <Link href="/" className="text-[15px] font-semibold tracking-[0.18em] text-ink">NORDIC</Link>
      <div className="min-w-0 flex-1"><NavLinks /></div>
      <div className="flex items-center gap-1"><SearchLink />
        {/* Account buttons need the session and permissions; stream them so the page is not held back. */}
        <Suspense fallback={<span aria-hidden="true" className="h-8 w-24 animate-pulse rounded-full bg-fill" />}><AccountActions /></Suspense>
        <MobileMenu /></div>
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
