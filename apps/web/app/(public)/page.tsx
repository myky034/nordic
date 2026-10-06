// =============================================================================
// Landing Page — app/(public)/page.tsx  →  route: /
// =============================================================================
//
// NOTE: No data is displayed here beyond the portal name, its modules and its
// principles. Displaying any country, university, immigration, or labour
// market data requires a source — no fabricated content is shown
// (AGENTS.md rule 1.1).
//
// A first-time visitor is asked what they want to do (study, work, permits,
// compare) and sent to the matching pages, instead of a list of module names.
// =============================================================================

import Link from "next/link";
import { AppIcon } from "@/app/(app)/dashboard/tiles";
import type { IconName, Tint } from "@/lib/dashboard/items";
import { countrySlugs } from "@/lib/registry/domain";
import { getDictionary } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Chevron } from "@/components/ui";
import { buttonPrimary, buttonSecondary } from "@/components/ui/styles";

// Goal cards: icon and destinations are fixed here; titles, texts and link
// labels come from the viewer's dictionary (lib/i18n).
const goals: { key: keyof Dictionary["home"]["goals"]; icon: IconName; tint: Tint; links: { href: string; label: (t: Dictionary) => string }[] }[] = [
  { key: "study", icon: "education", tint: "orange", links: [{ href: "/universities", label: (t) => t.nav.universities.label }, { href: "/programmes", label: (t) => t.nav.programmes.label }] },
  { key: "work", icon: "labour", tint: "brown", links: [{ href: "/occupations", label: (t) => t.nav.occupations.label }] },
  { key: "permits", icon: "immigration", tint: "teal", links: [{ href: "/immigration", label: (t) => t.nav.immigration.label }] },
  { key: "compare", icon: "chart", tint: "pink", links: [{ href: "/compare", label: (t) => t.nav.compare }] },
];

export default async function LandingPage() {
  const t = await getDictionary();
  const h = t.home;
  return (
    <main className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <section className="py-16 text-center sm:py-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">{h.eyebrow}</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[60px]">
          {h.title}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[19px] leading-relaxed text-ink-2">
          {h.intro}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/countries" className={buttonPrimary}>{h.start}</Link>
          <Link href="/search" className={buttonSecondary}>{h.search}</Link>
        </div>
      </section>

      <section aria-labelledby="goals" className="pb-6">
        <h2 id="goals" className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">{h.goalsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => <div key={g.key} className="flex flex-col rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
            <div className="flex items-center gap-3"><AppIcon icon={g.icon} tint={g.tint} /><h3 className="text-[19px] font-semibold text-ink">{h.goals[g.key].title}</h3></div>
            <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-2">{h.goals[g.key].text}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {g.links.map(({ href, label }) => <Link key={href} href={href} className="inline-flex items-center gap-1 text-[15px] font-medium text-accent hover:underline underline-offset-4">{label(t)}<Chevron className="text-accent" /></Link>)}
            </div>
          </div>)}
        </div>
      </section>

      <section aria-labelledby="countries" className="py-10">
        <h2 id="countries" className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">{h.countriesTitle}</h2>
        <div className="flex flex-wrap gap-2">
          {countrySlugs.map((slug) => <Link key={slug} href={`/countries/${slug}`} className="rounded-full bg-surface px-4 py-2 text-[15px] font-medium text-ink ring-1 ring-hairline transition hover:bg-fill">{t.countryNames[slug] ?? slug}</Link>)}
        </div>
      </section>

      <section aria-labelledby="principles" className="py-12">
        <h2 id="principles" className="sr-only">{h.principlesTitle}</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {h.principles.map(([title, text]) => <div key={title}>
            <p className="text-[17px] font-semibold text-ink">{title}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
          </div>)}
        </div>
      </section>
    </main>
  );
}
