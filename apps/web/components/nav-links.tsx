"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { entryActive, isActive, type NavEntry } from "@/lib/navigation/menu";

// Client component: the active entry depends on the path, and the group menus
// hold open/closed state. Menus open on click (not hover only) so they work
// with touch and keyboard; Escape, an outside click or navigation closes them.
// Entries and labels arrive already translated from the server header
// (navigationFor + the dictionary), so these client components hold no text.

const item = (active: boolean) =>
  `inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors ${active ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"}`;

function Chevron({ open }: { open: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Desktop bar (md and up): top-level entries with full-width group panels. */
export function NavLinks({ entries, label }: { entries: NavEntry[]; label: string }) {
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLElement>(null);
  const base = useId();

  // Close on navigation. Adjusting state during render (not in an effect) is
  // React's recommended way to reset state when an input changes.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setOpen(null); }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    const onClick = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onClick); };
  }, [open]);

  return <nav ref={ref} aria-label={label} className="hidden lg:block">
    <ul className="flex items-center gap-1">
      {entries.map((entry) => {
        const active = entryActive(path, entry);
        if (entry.href) return <li key={entry.id}><Link href={entry.href} aria-current={isActive(path, entry.href) ? "page" : undefined} className={item(active)}>{entry.label}</Link></li>;
        const isOpen = open === entry.id, panel = `${base}-${entry.id}`;
        return <li key={entry.id}>
          <button type="button" aria-expanded={isOpen} aria-controls={panel} onClick={() => setOpen(isOpen ? null : entry.id)} className={item(active || isOpen)}>
            {entry.label}<Chevron open={isOpen} />
          </button>
          <GroupPanel id={panel} entry={entry} path={path} hidden={!isOpen} />
        </li>;
      })}
    </ul>
  </nav>;
}

function GroupPanel({ id, entry, path, hidden }: { id: string; entry: NavEntry; path: string; hidden: boolean }) {
  // Full-width flyout under the bar, like apple.com: a quiet surface, the
  // group name as a small caption, then large tappable destinations.
  return <div id={id} hidden={hidden} className="absolute inset-x-0 top-full border-b border-hairline bg-canvas shadow-[0_16px_32px_rgb(0_0_0/0.08)]">
    <div className="mx-auto max-w-6xl px-8 pb-8 pt-6">
      <p className="mb-3 text-[12px] font-medium text-ink-3">{entry.label}</p>
      <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-3">
        {entry.links!.map((l) => <li key={l.href}>
          <Link href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined} className="group block rounded-xl">
            <span className={`block text-[21px] font-semibold tracking-[-0.01em] ${isActive(path, l.href) ? "text-accent" : "text-ink group-hover:text-accent"}`}>{l.label}</span>
            <span className="mt-0.5 block text-[13px] text-ink-2">{l.description}</span>
          </Link>
        </li>)}
      </ul>
    </div>
  </div>;
}

/** Narrow screens: a Menu button opening every destination, grouped. */
export type MenuLabels = { main: string; openMenu: string; closeMenu: string };
/** `footer`: server-rendered extras for the sheet (the language switch on phones). */
export function MobileMenu({ entries, labels, footer }: { entries: NavEntry[]; labels: MenuLabels; footer?: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setOpen(false); }
  const panel = useId();
  // The sheet is portalled to <body>: the header's backdrop-filter would
  // otherwise become the containing block of a position:fixed child and
  // squeeze the sheet into the 56px bar. Portals need the DOM, so render it
  // only on the client (false during server rendering and hydration).
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    // Keep the page behind the sheet from scrolling while it is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open]);

  return <div className="lg:hidden">
    <button type="button" aria-expanded={open} aria-controls={panel} aria-label={open ? labels.closeMenu : labels.openMenu} onClick={() => setOpen(!open)}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition hover:bg-fill hover:text-ink">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
        {open ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          : <path d="M2.5 5.5h11M2.5 10.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
    </button>
    {mounted && createPortal(<div id={panel} hidden={!open} className="fixed inset-x-0 bottom-0 top-[57px] z-30 overflow-y-auto bg-canvas px-5 pb-10 pt-4 lg:hidden">
      <MobileNavList path={path} entries={entries} label={labels.main} />
      {footer && <div className="mt-6 flex justify-start sm:hidden">{footer}</div>}
    </div>, document.body)}
  </div>;
}

/** Every destination, grouped; the content of the narrow-screen sheet. */
export function MobileNavList({ path, entries, label }: { path: string; entries: NavEntry[]; label: string }) {
  return <nav aria-label={label}>
    {entries.map((entry) => entry.href
      ? <Link key={entry.id} href={entry.href} aria-current={isActive(path, entry.href) ? "page" : undefined}
          className={`block border-b border-hairline py-3 text-[21px] font-semibold ${isActive(path, entry.href) ? "text-accent" : "text-ink"}`}>{entry.label}</Link>
      : <div key={entry.id} className="border-b border-hairline py-3">
          <p className="text-[12px] font-medium text-ink-3">{entry.label}</p>
          <ul className="mt-1">{entry.links!.map((l) => <li key={l.href}>
            <Link href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}
              className={`block py-1.5 text-[19px] font-semibold ${isActive(path, l.href) ? "text-accent" : "text-ink"}`}>{l.label}</Link>
          </li>)}</ul>
        </div>)}
  </nav>;
}
