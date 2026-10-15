"use client";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { mapFact } from "./actions";
import { StructuredFields, type FormFactType } from "../../workspace/forms";
import { expandToLines, segments, topicForCategory, type Range } from "@/lib/facts/mapping";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/locales";
import { Card, Field, FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSmall, control } from "@/components/ui/styles";

export type MapType = FormFactType & { category: string; label_en: string };
export type Mark = Range & { status: "reviewed" | "proposed" };

/**
 * L5 mapping screen, client part: the page text with highlighted facts, and
 * the form for the passage the editor selects. Offsets come from the
 * data-start of the span holding each selection end, so the excerpt is
 * always an exact slice of the stored text (propose_fact checks it again).
 */
export function MapView({ documentId, text, marks, types, subject, needsCountry, countries, canPropose, aside, locale }: {
  documentId: string; text: string; marks: Mark[]; types: MapType[]; subject: string; needsCountry: boolean;
  countries: { id: string; name: string }[]; canPropose: boolean; aside: ReactNode; locale: Locale;
}) {
  const d = dictionaries[locale], t = d.factMap, f = d.factsWorkspace.form, e = d.editor;
  const box = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Range | null>(null);
  const [typeId, setTypeId] = useState("");
  // A saved proposal clears the selection; the message stays above the form.
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof mapFact>>, form: FormData) => {
    const result = await mapFact(prev, form);
    if (result.message) { setSel(null); setTypeId(""); }
    return result;
  }, {});

  const offset = (node: Node, off: number) => {
    const el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element)?.closest<HTMLElement>("[data-start]");
    if (!el || !box.current?.contains(el)) return null;
    return Number(el.dataset.start) + (node.nodeType === Node.TEXT_NODE ? off : 0);
  };
  const onSelect = () => {
    if (!canPropose) return;
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.rangeCount) return;
    const r = s.getRangeAt(0);
    let start = offset(r.startContainer, r.startOffset), end = offset(r.endContainer, r.endOffset);
    if (start === null || end === null || end <= start) return;
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (end > start) setSel({ start, end });
  };

  const excerpt = sel ? text.slice(sel.start, sel.end) : "";
  const type = types.find((m) => m.id === typeId);
  const parts = segments(text, [...marks.map((m) => ({ range: m, mark: m.status })), ...(sel ? [{ range: sel, mark: "selected" as const }] : [])]);
  const tone = { reviewed: "bg-positive/15", proposed: "bg-caution/20", selected: "bg-accent/25" } as const;

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
    <Card>
      <h2 className="text-[17px] font-semibold">{t.pageText}</h2>
      <p className="mt-1 text-[13px] text-ink-3">{t.pageTextHint}</p>
      <div ref={box} onMouseUp={onSelect} onKeyUp={onSelect}
        className="mt-4 max-h-[70vh] overflow-y-auto whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink selection:bg-accent/30">
        {parts.map((p) => <span key={p.start} data-start={p.start} className={p.mark ? `rounded ${tone[p.mark]}` : undefined}>{p.text}</span>)}
      </div>
    </Card>
    <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
      {canPropose && <Card>
        <h2 className="text-[17px] font-semibold">{t.mapTitle}</h2>
        <FormMessage error={state.error} message={state.message} />
        {!sel ? <p className="mt-2 text-[14px] text-ink-3">{t.selectPrompt}</p> :
        <form key={`${sel.start}-${sel.end}`} action={action} className="mt-3 space-y-4">
          <input type="hidden" name="document" value={documentId} />
          <input type="hidden" name="excerpt" value={excerpt} />
          <div>
            <p className="text-[13px] font-medium text-ink-2">{t.excerpt}</p>
            <blockquote className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-fill/50 px-3 py-2 text-[14px]">{excerpt}</blockquote>
            {excerpt.length < 20 && <p className="mt-1 text-[13px] text-caution">{t.tooShort} <button type="button" className={buttonSmall}
              onClick={() => setSel(expandToLines(text, sel))}>{t.expand}</button></p>}
            {excerpt.length > 500 && <p className="mt-1 text-[13px] text-critical">{t.tooLong}</p>}
          </div>
          <Field label={t.assign}><select name="factType" value={typeId} onChange={(ev) => setTypeId(ev.target.value)} className={control}>
            <option value="">{f.noType}</option>{types.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
          {type && <StructuredFields key={type.id} type={type} locale={locale} />}
          <Field label={t.value}><textarea name="value" required maxLength={2000} rows={2} defaultValue={excerpt} className={control} /></Field>
          {/* Pre-filled from the type and the page's entity (Q5); re-keyed so a new type refreshes them. */}
          <details key={typeId} open={!type} className="rounded-xl bg-fill/40 p-3 text-[14px]">
            <summary className="cursor-pointer text-ink-2">{t.details}</summary>
            <div className="mt-3 space-y-3">
              <Field label={f.topic}><input name="topic" required maxLength={100} defaultValue={topicForCategory(type?.category)} className={control} /></Field>
              <Field label={f.subject}><input name="subject" required maxLength={200} defaultValue={subject} className={control} /></Field>
              <Field label={f.predicate}><input name="predicate" required maxLength={200} defaultValue={type?.label_en ?? ""} className={control} /></Field>
              {needsCountry && <Field label={f.country}><select name="country" className={control}><option value="">{f.noCountry}</option>
                {countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
            </div>
          </details>
          <div className="flex flex-wrap gap-3">
            <button disabled={pending || excerpt.length > 500} className={buttonPrimary}>{pending ? e.saving : t.save}</button>
            <button type="button" className={buttonSmall} onClick={() => setSel(null)}>{t.clear}</button>
          </div>
        </form>}
      </Card>}
      {aside}
    </div>
  </div>;
}
