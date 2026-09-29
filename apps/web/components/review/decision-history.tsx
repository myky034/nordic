import { Badge, Disclosure, EmptyState, List, ListRow } from "@/components/ui";
import { decisionLabel, decisionTime } from "@/lib/review/history";

export type HistoryItem = { id: string; title: string; decision: string; note: string; createdAt: string; detail?: string };

/**
 * The latest decisions on one workspace: the item's name, a plain decision
 * label, when (UTC), and the reviewer's note. Replaces rows that showed the
 * raw code ("reviewed") and a UUID.
 */
export function DecisionHistory({ items, summary = "20 quyết định gần nhất" }: { items: HistoryItem[]; summary?: string }) {
  return <Disclosure summary={summary}>
    {items.length ? <List label="Lịch sử quyết định">{items.map((r) => {
      const d = decisionLabel(r.decision);
      return <ListRow key={r.id} title={r.title} badges={<Badge tone={d.tone}>{d.label}</Badge>}
        subtitle={r.note} meta={r.detail ? `${decisionTime(r.createdAt)} · ${r.detail}` : decisionTime(r.createdAt)} />;
    })}</List> : <EmptyState>Chưa có quyết định nào.</EmptyState>}
  </Disclosure>;
}
