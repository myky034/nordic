import Link from "next/link";
import { Suspense } from "react";
import { MobileMenu, NavLinks } from "./nav-links";
import { AccountActions } from "./account-actions";
import { LanguageSwitch } from "./language-switch";
import { getDictionary } from "@/lib/i18n/server";
import { aboutDataLinks, navigationFor } from "@/lib/navigation/menu";
import { publicCoverage } from "@/lib/coverage/queries";

// One global navigation bar for public and signed-in pages. A light
// translucent surface with backdrop blur, used only here (spec: blur sparingly).
function SearchLink({ label }: { label: string }) {
  return <Link href="/search" aria-label={label} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition hover:bg-fill hover:text-ink">
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
  </Link>;
}

export async function SiteHeader() {
  const t = await getDictionary();
  // Unknown coverage (failed read) keeps the link: never hide content on an error.
  const entries = navigationFor(t.nav, { showCompare: (await publicCoverage())?.compareReady ?? true });
  // One row at every width: logo, grouped navigation (md+), then search,
  // account and — below 1024px (lg) — the Menu button. lg, not a tablet width,
  // because signed-in pages show two account buttons and the bar must never
  // truncate labels. The sticky header anchors the full-width group panels.
  return <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur-md">
    <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:px-8">
      <Link href="/" className="text-[15px] font-semibold tracking-[0.18em] text-ink">NORDIC</Link>
      <div className="min-w-0 flex-1"><NavLinks entries={entries} label={t.nav.main} /></div>
      <div className="flex items-center gap-1"><SearchLink label={t.nav.search} />
        {/* On phones the switch moves into the menu sheet so the bar never overflows. */}
        <div className="hidden sm:block"><LanguageSwitch /></div>
        {/* Account buttons need the session and permissions; stream them so the page is not held back. */}
        <Suspense fallback={<span aria-hidden="true" className="h-8 w-24 animate-pulse rounded-full bg-fill" />}><AccountActions /></Suspense>
        <MobileMenu entries={entries} labels={{ main: t.nav.main, openMenu: t.nav.openMenu, closeMenu: t.nav.closeMenu }} footer={<LanguageSwitch />} /></div>
    </div>
  </header>;
}

export async function SiteFooter() {
  const d = await getDictionary(), t = d.footer;
  return <footer className="mt-24 border-t border-hairline">
    <div className="mx-auto max-w-6xl px-5 py-8 text-[13px] leading-relaxed text-ink-3 sm:px-8">
      {/* The evidence behind every page: one tap away, not in the main menu (UX review C1/B3). */}
      <nav aria-label={d.nav.aboutData} className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-medium text-ink-2">{d.nav.aboutData}</span>
        {aboutDataLinks(d.nav).map((l) => <Link key={l.href} href={l.href} title={l.description} className="hover:text-ink">{l.label}</Link>)}
      </nav>
      <p>{t.disclaimer}</p>
      <p className="mt-1">{t.check}</p>
    </div>
  </footer>;
}
