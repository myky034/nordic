import type { DocumentStructure } from "@nordic/db/document-structure";
import { Badge, DescriptionList, EmptyState, Notice } from "@/components/ui";
import { Cell, DataRow, DataTable } from "@/components/ui/data-table";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { sectionLabel, type StructureDiff } from "@/lib/crawler/structure-view";

// PR 1.5: read-only views of one structure snapshot, built only from the
// existing design system (DataTable, DataRow, Badge, Notice, DescriptionList).
// Everything is rendered as text by React; nothing from a page becomes HTML.

export const ROW_LIMIT = 200;
type T = (typeof dictionaries)["vi"]["structurePreview"];
const text = (locale: Locale): T => dictionaries[locale].structurePreview as T;
const Sec = ({ s }: { s: readonly string[] }) => <span className="text-[13px] text-ink-3">{sectionLabel(s) || "—"}</span>;
const Lines = ({ v }: { v: string }) => <span className="whitespace-pre-wrap break-words">{v}</span>;
const Shown = ({ shown, total, locale }: { shown: number; total: number; locale: Locale }) =>
  shown < total ? <p className="mt-2 px-1 text-[13px] text-ink-3">{text(locale).showing(shown, total)}</p> : null;

export function OverviewView({ s, locale }: { s: DocumentStructure; locale: Locale }) {
  const t = text(locale);
  const dropped = Object.entries(s.limits.dropped).map(([k, n]) => `${k}: ${n}`).join(", ");
  return <DescriptionList items={[
    [t.pageTitle, s.title ?? "—"],
    [t.lang, s.lang ?? "—"],
    [t.canonical, s.canonicalUrl ? <span className="break-all">{s.canonicalUrl}</span> : "—"],
    [t.root, `${s.root.kind}${s.root.selector ? ` (${s.root.selector})` : ""}`],
    [t.counts, `${t.headings} ${s.headings.length} · ${t.tabs.blocks} ${s.blocks.length} · ${t.tabs.pairs} ${s.pairs.length} · ${t.tabs.tables} ${s.tables.length} · ${t.tabs.links} ${s.links.length} · JSON-LD ${s.structuredData.reduce((a, d) => a + d.items.length, 0)}`],
    [t.truncated, s.limits.truncated ? <Badge tone="caution">{dropped}</Badge> : t.none],
    [t.headings, s.headings.length ? <ul className="space-y-1">{s.headings.map((h) => <li key={h.ref} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}>
      <span className="font-mono text-[12px] text-ink-3">{h.ref}</span> {h.text}</li>)}</ul> : "—"],
  ]} />;
}

export function PairsView({ s, href, selected, locale }: { s: DocumentStructure; href: (ref: string) => string; selected?: string; locale: Locale }) {
  const t = text(locale);
  const rows = s.pairs.slice(0, ROW_LIMIT);
  return <><DataTable locale={locale} label={t.tabs.pairs} minWidth="52rem" columns={[{ label: t.col.ref }, { label: t.col.label }, { label: t.col.value }, { label: t.col.section }, { label: t.col.from }]}
    empty={!rows.length && <EmptyState>{t.empty}</EmptyState>}>
    {rows.map((p) => <DataRow key={p.ref} href={href(p.ref)} selected={p.ref === selected} title={<span className="font-mono text-[13px]">{p.ref}</span>}>
      <Cell className="font-medium text-ink">{p.label}</Cell><Cell className="max-w-md"><Lines v={p.value} /></Cell><Cell><Sec s={p.section} /></Cell>
      <Cell><Badge tone={p.from === "label_value" ? "caution" : "neutral"}>{t.from[p.from]}</Badge></Cell>
    </DataRow>)}
  </DataTable><Shown shown={rows.length} total={s.pairs.length} locale={locale} /></>;
}

export function BlocksView({ s, href, selected, locale }: { s: DocumentStructure; href: (ref: string) => string; selected?: string; locale: Locale }) {
  const t = text(locale);
  const rows = s.blocks.slice(0, ROW_LIMIT);
  return <><DataTable locale={locale} label={t.tabs.blocks} minWidth="48rem" columns={[{ label: t.col.ref }, { label: t.col.kind }, { label: t.col.text }, { label: t.col.section }]}
    empty={!rows.length && <EmptyState>{t.empty}</EmptyState>}>
    {rows.map((b) => <DataRow key={b.ref} href={href(b.ref)} selected={b.ref === selected} title={<span className="font-mono text-[13px]">{b.ref}</span>}>
      <Cell><Badge>{b.kind}{b.depth ? ` · ${b.depth}` : ""}</Badge></Cell><Cell className="max-w-lg"><Lines v={b.text} /></Cell><Cell><Sec s={b.section} /></Cell>
    </DataRow>)}
  </DataTable><Shown shown={rows.length} total={s.blocks.length} locale={locale} /></>;
}

export function TablesView({ s, locale }: { s: DocumentStructure; locale: Locale }) {
  const t = text(locale);
  if (!s.tables.length) return <EmptyState>{t.empty}</EmptyState>;
  return <div className="space-y-6">{s.tables.map((tb) => <section key={tb.ref} aria-label={tb.ref}>
    <p className="mb-2 px-1 text-[13px] text-ink-3"><span className="font-mono">{tb.ref}</span>{tb.caption ? ` · ${tb.caption}` : ""} · <Sec s={tb.section} /> · <span className="font-mono">{tb.domPath}</span></p>
    <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-hairline">
      <table className="w-full border-collapse text-[14px]">
        {tb.headers.length > 0 && <thead className="bg-fill/40"><tr>{tb.headers.map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left text-[13px] font-semibold text-ink-2">{h}</th>)}</tr></thead>}
        <tbody className="[&>tr+tr]:border-t [&>tr+tr]:border-hairline">{tb.rows.slice(0, ROW_LIMIT).map((r, i) => <tr key={i}>
          {r.cells.map((c, j) => <td key={j} className="px-3 py-2 align-top text-ink-2" title={`${tb.ref}[${i}][${j}]`}><Lines v={c} /></td>)}</tr>)}</tbody>
      </table>
    </div></section>)}</div>;
}

export function LinksView({ s, href, selected, locale }: { s: DocumentStructure; href: (ref: string) => string; selected?: string; locale: Locale }) {
  const t = text(locale);
  const rows = s.links.slice(0, ROW_LIMIT);
  return <><DataTable locale={locale} label={t.tabs.links} minWidth="52rem" columns={[{ label: t.col.ref }, { label: t.col.text }, { label: t.col.href }, { label: t.col.origin }, { label: t.col.section }]}
    empty={!rows.length && <EmptyState>{t.empty}</EmptyState>}>
    {rows.map((l) => <DataRow key={l.ref} href={href(l.ref)} selected={l.ref === selected} title={<span className="font-mono text-[13px]">{l.ref}</span>}>
      <Cell>{l.text || "—"}{l.fileType && <> <Badge tone="accent">{l.fileType.toUpperCase()}</Badge></>}</Cell>
      <Cell className="max-w-sm"><span className="break-all font-mono text-[12px]">{l.href}</span></Cell>
      <Cell>{l.sameOrigin ? t.sameOrigin : t.external}</Cell><Cell><Sec s={l.section} /></Cell>
    </DataRow>)}
  </DataTable><Shown shown={rows.length} total={s.links.length} locale={locale} /></>;
}

export function JsonLdView({ s, locale }: { s: DocumentStructure; locale: Locale }) {
  const t = text(locale);
  if (!s.structuredData.length) return <EmptyState>{t.noJsonLd}</EmptyState>;
  return <div className="space-y-4">{s.structuredData.map((d) => <section key={d.adapter}>
    <p className="mb-2 px-1 text-[13px] text-ink-3">{t.adapter(d.adapter, d.adapterVersion)}</p>
    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-surface p-4 font-mono text-[12px] text-ink ring-1 ring-hairline">{JSON.stringify(d.items, null, 2)}</pre>
  </section>)}</div>;
}

/** Details of one element (opened by ?ref=): traceability fields and its JSON. */
export function ElementDetails({ s, refId, locale }: { s: DocumentStructure; refId: string; locale: Locale }) {
  const t = text(locale);
  const el = [...s.headings, ...s.blocks, ...s.pairs, ...s.tables, ...s.links].find((e) => e.ref === refId);
  if (!el) return <EmptyState>{t.empty}</EmptyState>;
  const items: [string, React.ReactNode][] = [[t.col.ref, <span key="r" className="font-mono">{el.ref}</span>], [t.domPath, <span key="d" className="break-all font-mono text-[12px]">{el.domPath}</span>], [t.col.section, sectionLabel(el.section) || "—"]];
  if ("labelPath" in el) items.push([t.labelPath, <span key="l" className="break-all font-mono text-[12px]">{el.labelPath}</span>], [t.valuePath, <span key="v" className="break-all font-mono text-[12px]">{el.valuePath}</span>]);
  return <div className="space-y-4">
    <DescriptionList items={items} />
    <p className="text-[13px] text-ink-3">{t.refNote}</p>
    <div><p className="mb-2 text-[13px] font-medium text-ink-2">{t.elementJson}</p>
      <pre className="overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-surface p-4 font-mono text-[12px] text-ink ring-1 ring-hairline">{JSON.stringify(el, null, 2)}</pre></div>
  </div>;
}

function List({ title, items, tone }: { title: string; items: React.ReactNode[]; tone: "positive" | "critical" | "caution" }) {
  return items.length ? <div>
    <p className="mb-1 text-[13px] font-medium"><Badge tone={tone}>{title} · {items.length}</Badge></p>
    <ul className="space-y-1 text-[14px] text-ink-2">{items.map((x, i) => <li key={i} className="break-words">{x}</li>)}</ul></div> : null;
}

export function DiffView({ diff, locale }: { diff: StructureDiff | null; locale: Locale }) {
  const t = text(locale);
  if (!diff) return <EmptyState>{t.diffPick}</EmptyState>;
  const group = (name: string, size: number, parts: React.ReactNode[]) => size ? <section className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-hairline">
    <h3 className="text-[15px] font-semibold">{name}</h3>{parts}</section> : null;
  return <div className="space-y-4">
    <p className="px-1 text-[13px] text-ink-3">{t.diffNote}</p>
    {diff.same ? <Notice tone="positive">{t.diffSame}</Notice> : <>
      {group(t.tabs.pairs, diff.pairs.added.length + diff.pairs.removed.length + diff.pairs.changed.length, [
        <List key="a" title={t.added} tone="positive" items={diff.pairs.added.map((p) => `${p.label} → ${p.value}`)} />,
        <List key="r" title={t.removed} tone="critical" items={diff.pairs.removed.map((p) => `${p.label} → ${p.value}`)} />,
        <List key="c" title={t.changed} tone="caution" items={diff.pairs.changed.map((c) => <span key={c.label}><b className="text-ink">{c.label}</b>: {t.before} “{c.before}” · {t.after} “{c.after}”</span>)} />])}
      {group(t.headings, diff.headings.added.length + diff.headings.removed.length, [<List key="a" title={t.added} tone="positive" items={diff.headings.added} />, <List key="r" title={t.removed} tone="critical" items={diff.headings.removed} />])}
      {group(t.tabs.links, diff.links.added.length + diff.links.removed.length, [<List key="a" title={t.added} tone="positive" items={diff.links.added.map((l) => `${l.text} → ${l.href}`)} />,
        <List key="r" title={t.removed} tone="critical" items={diff.links.removed.map((l) => `${l.text} → ${l.href}`)} />])}
      {group(t.tabs.blocks, diff.blocks.added.length + diff.blocks.removed.length, [<List key="a" title={t.added} tone="positive" items={diff.blocks.added} />, <List key="r" title={t.removed} tone="critical" items={diff.blocks.removed} />])}
    </>}
  </div>;
}

