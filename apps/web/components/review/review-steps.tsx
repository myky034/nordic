import Link from "next/link";
import { Suspense } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reviewSteps, stepLinks, type CountId, type StepPage } from "@/lib/review/steps";
import { pendingCounts } from "@/lib/review/pending-counts";

/**
 * "Where am I in the review work?" — three numbered steps with pending counts,
 * in the style of an Apple setup assistant / the /dashboard counters.
 * Counting (RLS-scoped, failed count = "—") lives in lib/review/pending-counts.ts.
 *
 * The counts take several database round trips, so they stream: the page
 * (and the review list) renders first, with a placeholder of the same size.
 */
export function ReviewSteps(props: { client: SupabaseClient; permissions: readonly string[]; current: StepPage }) {
  return <Suspense fallback={<ReviewStepsPlaceholder />}><ReviewStepsContent {...props} /></Suspense>;
}

export async function ReviewStepsContent({ client, permissions, current }: { client: SupabaseClient; permissions: readonly string[]; current: StepPage }) {
  return <ReviewStepsView counts={await pendingCounts(client)} permissions={permissions} current={current} />;
}

function ReviewStepsPlaceholder() {
  return <div aria-hidden="true" className="mb-10">
    <div className="mb-3 h-4 w-32 rounded bg-fill" />
    <div className="grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface ring-1 ring-hairline" />)}</div>
  </div>;
}

/** Rendering only (no data access), so /dev/preview can show it with DEMO counts. */
export function ReviewStepsView({ counts, permissions, current }: { counts: Record<CountId, number | null>; permissions: readonly string[]; current: StepPage }) {
  return <nav aria-label="Quy trình duyệt" className="mb-10">
    <p className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">Quy trình duyệt</p>
    <ol className="grid gap-3 lg:grid-cols-3">
      {reviewSteps.map((step) => {
        const here = step.links.some((l) => l.page === current);
        return <li key={step.number} className={`rounded-2xl bg-surface p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ${here ? "ring-accent/40" : "ring-hairline"}`}>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${here ? "bg-accent text-white" : "bg-fill text-ink-2"}`}>{step.number}</span>
            <p className="text-[15px] font-semibold text-ink">{step.title}{here && <span className="sr-only"> (bước hiện tại)</span>}</p>
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{step.description}</p>
          <ul className="mt-3 space-y-1">
            {stepLinks(step, permissions).map((l) => {
              const n = counts[l.count];
              const badge = <span className={`tabular-nums text-[13px] ${n ? "font-semibold text-accent" : "text-ink-3"}`}>{n === null ? "—" : n === 0 ? "Xong" : `${n} chờ`}</span>;
              return <li key={l.href}>
                {l.allowed
                  ? <Link href={l.href} aria-current={l.page === current ? "page" : undefined}
                      className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[15px] transition-colors hover:bg-fill/70 ${l.page === current ? "bg-fill/70 font-medium text-ink" : "text-accent"}`}>
                      <span>{l.label}</span>{badge}
                    </Link>
                  : <div className="flex items-center justify-between gap-3 px-2 py-1.5 text-[15px] text-ink-2">
                      <span>{l.label} <span className="block text-[12px] text-ink-3">Người quản lý nguồn thực hiện</span></span>{badge}
                    </div>}
              </li>;
            })}
          </ul>
        </li>;
      })}
    </ol>
  </nav>;
}
