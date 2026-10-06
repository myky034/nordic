import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, type Locale } from "@/lib/i18n/locales";
import { Badge, Disclosure, EmptyState, List, ListRow } from "@/components/ui";
import { decisionLabel, decisionTime } from "@/lib/review/history";

export type HistoryItem = { id: string; title: string; decision: string; note: string; createdAt: string; detail?: string };

/**
 * The latest decisions on one workspace: the item's name, a plain decision
 * label, when (UTC), and the reviewer's note. Replaces rows that showed the
 * raw code ("reviewed") and a UUID.
 */
export function DecisionHistory({ items, summary, locale = defaultLocale }: { items: HistoryItem[]; summary?: string; locale?: Locale }) {
  const t = dictionaries[locale].review;
  return <Disclosure summary={summary ?? t.history}>
    {items.length ? <List label={t.historyLabel}>{items.map((r) => {
      const d = decisionLabel(r.decision, locale);
      return <ListRow key={r.id} title={r.title} badges={<Badge tone={d.tone}>{d.label}</Badge>}
        subtitle={r.note} meta={r.detail ? `${decisionTime(r.createdAt, locale)} · ${r.detail}` : decisionTime(r.createdAt, locale)} />;
    })}</List> : <EmptyState>{t.noHistory}</EmptyState>}
  </Disclosure>;
}
