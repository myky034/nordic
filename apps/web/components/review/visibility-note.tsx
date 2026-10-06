import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import Link from "next/link";
import { Notice } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { blockerLabel, needsSourceVerification, type Blocker, type Visibility } from "@/lib/review/visibility";

/**
 * Tells a reviewer whether a record is visible to signed-out visitors, and if
 * not, why and what to do. Before this, a reviewed immigration rule whose
 * source was still unverified simply never appeared publicly, with no
 * explanation — it looked like a bug.
 */
export function VisibilityNote({ visibility, publicHref, locale = defaultLocale }: { visibility: Visibility | null; publicHref?: string; locale?: Locale }) {
  if (!visibility) return null;
  const t = dictionaries[locale].review;
  switch (visibility.state) {
    case "public":
      return <p className="flex items-center gap-2 text-[13px] text-ink-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-positive" />{t.publicNow}
        {publicHref && <Link href={publicHref} className={textLink}>{t.view}</Link>}
      </p>;
    case "will_be_public":
      return <p className="text-[13px] text-ink-3">{t.willBePublic}</p>;
    case "unknown":
      return <p className="text-[13px] text-ink-3">{t.visibilityUnknown}</p>;
    case "hidden":
      return <Reasons title={t.hiddenTitle} blockers={visibility.blockers} locale={locale} />;
    case "will_stay_hidden":
      return <Reasons title={t.willStayHiddenTitle} blockers={visibility.blockers} locale={locale} />;
  }
}

function Reasons({ title, blockers, locale }: { title: string; blockers: Blocker[]; locale: Locale }) {
  const t = dictionaries[locale].review;
  return <Notice tone="caution" title={title}>
    {blockers.length
      ? <ul className="list-disc space-y-1 pl-5">{blockers.map((b) => <li key={b}>{blockerLabel(b, locale)}</li>)}</ul>
      : <p>{t.noReason}</p>}
    {needsSourceVerification(blockers) && <p className="mt-2"><Link href="/admin/sources" className={textLink}>{t.verifySource}</Link></p>}
  </Notice>;
}
