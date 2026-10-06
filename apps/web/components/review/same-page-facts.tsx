import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { Badge } from "@/components/ui";
import { ReviewBadge } from "@/components/ui/badges";
import { statusLabel } from "@/lib/facts/domain";
import { sameDocumentClaims, type Sibling } from "@/lib/review/siblings";

/**
 * "Các thông tin khác từ cùng trang này" — shown above the decision so the
 * reviewer can tell "same page" (normal) from "same claim" (possible
 * duplicate). `others === null` means they could not be loaded; that is said,
 * not hidden (AGENTS.md 13).
 */
export function SamePageFacts({ current, others, locale = defaultLocale }: { current: { subject: string; predicate: string }; others: Sibling[] | null; locale?: Locale }) {
  const t = dictionaries[locale].review;
  if (others === null) return <p className="text-[13px] text-ink-3">{t.samePageUnavailable}</p>;
  const rows = sameDocumentClaims(current, others);
  if (!rows.length) return null;
  const dupes = rows.filter((r) => r.possibleDuplicate).length;
  return <section aria-label={t.samePage} className="rounded-2xl bg-surface p-4 ring-1 ring-hairline sm:p-5">
    <p className="text-[15px] font-semibold text-ink">{t.samePage} <span className="font-normal text-ink-3">{rows.length}</span></p>
    <p className="mt-1 text-[13px] leading-snug text-ink-2">
      {t.samePageIntro}
      {dupes ? t.samePageDupes : t.samePageNoDupes}
    </p>
    <ul className="mt-3 space-y-2">
      {rows.map((r) => <li key={r.id} className={`rounded-xl px-3 py-2 ${r.possibleDuplicate ? "bg-caution/[0.08] ring-1 ring-caution/25" : "bg-fill/50"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium text-ink">{r.subject} — {r.predicate}</span>
          <ReviewBadge status={r.status}>{statusLabel(r.status, locale)}</ReviewBadge>
          {r.possibleDuplicate && <Badge tone="caution">{t.possibleDuplicate}</Badge>}
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-2">{r.value}{r.unit ? ` ${r.unit}` : ""}</p>
      </li>)}
    </ul>
  </section>;
}
