"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Client component only because the active tab depends on the current path.
const links = [
  ["/countries", "Countries"], ["/universities", "Universities"], ["/programmes", "Programmes"],
  ["/immigration", "Immigration"], ["/facts", "Facts"], ["/sources", "Sources"], ["/documents", "Documents"],
] as const;

export function NavLinks() {
  const path = usePathname();
  return <nav aria-label="Explore" className="-mx-1 flex gap-1 overflow-x-auto [scrollbar-width:none]">
    {links.map(([href, label]) => {
      const active = path === href || path.startsWith(`${href}/`);
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}
        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors ${active ? "bg-fill text-ink" : "text-ink-2 hover:text-ink"}`}>{label}</Link>;
    })}
  </nav>;
}
