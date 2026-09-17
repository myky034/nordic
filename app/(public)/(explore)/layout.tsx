import Link from "next/link";
export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">
    <header className="border-b border-zinc-200 dark:border-zinc-800"><nav aria-label="Explore" className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-5 text-sm"><Link href="/" className="mr-auto font-semibold tracking-widest">NORDIC</Link><Link href="/countries">Countries</Link><Link href="/sources">Sources</Link><Link href="/dashboard">My workspace</Link></nav></header>
    <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">{children}</main>
  </div>;
}
