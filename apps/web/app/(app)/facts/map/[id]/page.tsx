import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { uuidPattern } from "@/lib/documents/domain";
import { factTypeDefinition, factTypeLabel } from "@/lib/compare/domain";
import { findExcerpt, programmeChecklist, type SlotState } from "@/lib/facts/mapping";
import { dateLabel } from "@/lib/registry/domain";
import { Badge, Card, Disclosure, EmptyState, ExternalLink, NoAccess, PageHeader } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { ReviewForm } from "../../workspace/forms";
import { RequestExtractionForm } from "@/app/(public)/(explore)/documents/[id]/extraction-forms";
import { MapView, type Mark, type MapType } from "./map-view";

type Fact = { id: string; document_id: string; source_changed_at: string | null; status: string; origin: string; value: string; unit: string | null; deadline_type: string | null;
  fact_types: { key: string; label_vi: string; label_en: string } | null; evidence: { excerpt: string } | null };
type TypeRow = { id: string; key: string; label_vi: string; label_en: string; definition_vi: string; definition_en: string; value_kind: string;
  applies_to: string; unit_hint: string | null; min_value: number | string | null; max_value: number | string | null; category: string };

// L5 "map facts" (docs/architecture/mapping-screen-plan.md; Decision Log 2026-10-14).
// Editors only: the crawled text is readable to facts.propose / facts.review
// through RLS (document_texts_editors); nothing here is public.
export default async function MapPage({ params }: PageProps<"/facts/map/[id]">) {
  await requireAuth();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const { client, permissions } = await accessContext();
  const propose = permissions.includes("facts.propose"), review = permissions.includes("facts.review");
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.factMap, e = dict.editor, w = dict.factsWorkspace;
  if (!propose && !review) return <NoAccess title={w.noAccessTitle} back="/facts" backLabel={w.seePublic} locale={locale}>
    {e.noAccessHelp(permissionName("facts.propose", locale), permissionName("facts.review", locale))}</NoAccess>;

  // L7a: facts belong to the PAGE (every stored version of this URL), so a
  // fact mapped on the 14 Oct version is not mapped again on the 15 Oct one.
  const doc = await client.from("documents").select("id,source_id,title,canonical_url,retrieved_at,sources(name)").eq("id", id).maybeSingle();
  if (doc.error) { logAccessError("fact_map_document"); throw new Error("Không tải được dữ liệu biên tập."); }
  if (!doc.data) notFound();
  const versions = await client.from("documents").select("id").eq("source_id", (doc.data as { source_id: string }).source_id).eq("canonical_url", (doc.data as { canonical_url: string }).canonical_url);
  if (versions.error) { logAccessError("fact_map_versions"); throw new Error("Không tải được dữ liệu biên tập."); }
  const versionIds = (versions.data as { id: string }[]).map((v) => v.id);
  const [text, entity, facts, types, countries, open] = await Promise.all([
    client.from("document_texts").select("text").eq("document_id", id).maybeSingle(),
    client.rpc("editor_document_entity", { p_document: id }),
    client.from("facts").select("id,document_id,source_changed_at,status,origin,value,unit,deadline_type,fact_types(key,label_vi,label_en),evidence(excerpt)").in("document_id", versionIds).neq("status", "rejected").order("created_at"),
    client.from("fact_types").select("id,key,label_vi,label_en,definition_vi,definition_en,value_kind,applies_to,unit_hint,min_value,max_value,category").eq("active", true).order("label_vi"),
    client.from("countries").select("id,name").order("name"),
    client.from("extraction_requests").select("id").eq("document_id", id).in("status", ["pending", "running"]).limit(1),
  ]);
  if ([text, entity, facts, types, countries, open].some((r) => r.error)) { logAccessError("fact_map"); throw new Error("Không tải được dữ liệu biên tập."); }
  const document = doc.data as unknown as { id: string; title: string | null; canonical_url: string; retrieved_at: string; sources: { name: string } };
  const linked = (entity.data as { kind: string; entity_id: string; name: string | null; country_id: string | null }[])[0] ?? null;
  const rows = facts.data as unknown as Fact[];
  const pageText = (text.data as { text: string } | null)?.text ?? null;

  // Types that fit this page (as set_fact_type / propose_fact require): the
  // linked entity's kind plus country types; without an entity, country types.
  const kinds = linked ? [linked.kind, "country"] : ["country"];
  const typeRows = (types.data as TypeRow[]).filter((m) => kinds.includes(m.applies_to));
  const mapTypes: MapType[] = typeRows.map((m) => ({ ...m, label: factTypeLabel(m, locale), definition: factTypeDefinition(m, locale) }));
  const typeName = new Map(typeRows.map((m) => [m.key, factTypeLabel(m, locale)]));

  // Highlights: where each fact's excerpt sits in this version of the page.
  const located = rows.map((f) => ({ fact: f, range: pageText && f.evidence ? findExcerpt(pageText, f.evidence.excerpt) : null }));
  const marks: Mark[] = located.flatMap(({ fact, range }) => range ? [{ ...range, status: fact.status === "proposed" ? "proposed" : "reviewed" }] : []);
  const missing = new Set(located.filter((l) => !l.range).map((l) => l.fact.id));

  // "Should have": the programme page's key-information slots; for other
  // entities, the active types of their kind.
  const checklist: { key: string; label: string; state: SlotState; facts: Fact[] }[] = linked?.kind === "programme"
    ? programmeChecklist(rows).map((s) => ({ ...s, label: typeName.get(s.key) ?? dict.programmes.slots[s.key] }))
    : typeRows.filter((m) => linked && m.applies_to === linked.kind).map((m) => {
      const own = rows.filter((f) => f.fact_types?.key === m.key);
      return { key: m.key, label: factTypeLabel(m, locale), facts: own,
        state: own.some((f) => f.status !== "proposed") ? "reviewed" : own.length ? "proposed" : "missing" };
    });
  const listed = new Set(checklist.flatMap((c) => c.facts.map((f) => f.id)));
  const others = rows.filter((f) => !listed.has(f.id));
  const tone = { reviewed: "positive", proposed: "caution", missing: "neutral" } as const;

  const factLine = (f: Fact) => <li key={f.id} className="space-y-1">
    <p className="text-[14px] text-ink">{f.value}{f.unit ? ` ${f.unit}` : ""}{f.origin === "ai" && <> <Badge tone="accent">AI</Badge></>}</p>
    {f.document_id !== id && <p className="text-[12px] text-caution">{t.otherVersion}{f.source_changed_at ? ` · ${t.awaitingSourceCheck}` : ""}</p>}
    {missing.has(f.id) && <p className="text-[12px] text-ink-3">{t.notOnPage}</p>}
    {review && f.status === "proposed" && <Disclosure small summary={t.review}><ReviewForm id={f.id} ai={f.origin === "ai"} locale={locale} /></Disclosure>}
  </li>;
  const aside = <>
    {linked && <Card>
      <h2 className="text-[17px] font-semibold">{t.checklist}</h2>
      <ul className="mt-3 divide-y divide-hairline">{checklist.map((c) => <li key={c.key} className="py-3 first:pt-0 last:pb-0">
        <div className="flex items-center justify-between gap-3"><p className="text-[15px] font-medium">{c.label}</p><Badge tone={tone[c.state]}>{t.states[c.state]}</Badge></div>
        {c.facts.length > 0 && <ul className="mt-2 space-y-2">{c.facts.map(factLine)}</ul>}
      </li>)}</ul>
    </Card>}
    <Card>
      <h2 className="text-[17px] font-semibold">{t.others}</h2>
      {others.length ? <ul className="mt-3 space-y-3">{others.map((f) => <li key={f.id} className="space-y-1">
        <p className="text-[13px] text-ink-3">{f.fact_types ? factTypeLabel(f.fact_types, locale) : f.status === "proposed" ? t.states.proposed : t.states.reviewed}</p>
        <ul>{factLine(f)}</ul></li>)}</ul> : <p className="mt-2 text-[14px] text-ink-3">{t.noOthers}</p>}
    </Card>
    {propose && pageText && <Card>{(open.data ?? []).length ? <p className="text-[14px] text-ink-2">{t.aiOpen}</p> : <RequestExtractionForm document={id} locale={locale} />}
      <p className="mt-3"><Link href="/facts/workspace" className={`${textLink} text-[14px]`}>{t.reviewQueue}</Link></p></Card>}
  </>;

  return <>
    <PageHeader eyebrow={t.eyebrow} title={<span className="break-words">{document.title ?? document.canonical_url}</span>}
      description={<>
        <p>{t.description}</p>
        <p className="mt-2 text-[14px] text-ink-3">{document.sources.name} · {t.retrieved(dateLabel(new Date(document.retrieved_at), locale))} · <ExternalLink href={document.canonical_url}>{t.openOriginal}</ExternalLink></p>
        <p className="mt-2 text-[14px] text-ink-2">{linked ? t.belongsTo(linked.name ?? linked.entity_id) : t.noEntity}</p>
      </>} />
    {pageText ? <MapView documentId={id} text={pageText} marks={marks} types={mapTypes} subject={linked?.name ?? document.title ?? ""}
      needsCountry={!linked} countries={countries.data as { id: string; name: string }[]} canPropose={propose} aside={aside} locale={locale} />
      : <><EmptyState>{t.noText}</EmptyState><div className="mt-6 grid gap-5 lg:grid-cols-2">{aside}</div></>}
  </>;
}
