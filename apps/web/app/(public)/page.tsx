// =============================================================================
// Landing Page — app/(public)/page.tsx  →  route: /
// =============================================================================
//
// NOTE: No data is displayed here beyond the portal name, its modules and its
// principles. Displaying any country, university, immigration, or labour
// market data requires a source — no fabricated content is shown
// (AGENTS.md rule 1.1).
// =============================================================================

import Link from "next/link";
import { List, ListRow } from "@/components/ui";
import { buttonPrimary, buttonSecondary } from "@/components/ui/styles";

const modules = [
  ["/countries", "Countries", "Start from Sweden, Denmark, Finland, Norway or the Netherlands."],
  ["/programmes", "Programmes", "Programmes whose existence was checked against a source document."],
  ["/immigration", "Immigration", "Permit rules backed by official (T1) government sources only."],
  ["/facts", "Facts", "Individual claims, each with its excerpt, source and dates."],
  ["/sources", "Source registry", "Where information comes from, and how authoritative it is."],
] as const;

const principles = [
  ["Evidence first", "Every claim links to the document and excerpt it came from."],
  ["Honest about age", "Retrieval, review and verification dates are always shown."],
  ["No invented data", "If a source does not say it, Nordic leaves it empty."],
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <section className="py-20 text-center sm:py-28">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Europe Study &amp; Career Intelligence</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[64px]">
          Research Europe with evidence.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[19px] leading-relaxed text-ink-2">
          One place to research Europe with evidence, compare options, and turn
          research into an actionable study-to-career plan.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/countries" className={buttonPrimary}>Explore countries</Link>
          <Link href="/login" className={buttonSecondary}>Sign in</Link>
        </div>
      </section>

      <section aria-labelledby="modules" className="pb-8">
        <h2 id="modules" className="mb-3 px-1 text-[22px] font-semibold tracking-[-0.015em]">Explore</h2>
        <List>{modules.map(([href, title, text]) => <ListRow key={href} href={href} title={title} subtitle={text} />)}</List>
      </section>

      <section aria-labelledby="principles" className="py-16">
        <h2 id="principles" className="sr-only">Principles</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {principles.map(([title, text]) => <div key={title}>
            <p className="text-[17px] font-semibold text-ink">{title}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
          </div>)}
        </div>
      </section>
    </main>
  );
}
