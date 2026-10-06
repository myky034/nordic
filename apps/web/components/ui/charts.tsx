// Small server-rendered charts built from plain divs: no chart library, no
// client JavaScript, colours from the design tokens (light and dark mode).
// Each chart is an image for sighted users (role="img" + a one-line summary)
// and carries the same numbers as a visually hidden table for screen readers,
// so no figure exists only as a bar length.

/** `swatch` must be a literal Tailwind class (e.g. "bg-positive") so the
 *  class scanner keeps it. */
export type Series = { key: string; label: string; swatch: string };
export type Point = { label: string; values: Record<string, number> };

const sum = (p: Point, series: Series[]) => series.reduce((a, s) => a + (p.values[s.key] ?? 0), 0);
import { dictionaries } from "@/lib/i18n/dictionaries";
import { defaultLocale, intlLocale, type Locale } from "@/lib/i18n/locales";

const format = (locale: Locale) => (v: number) => v.toLocaleString(intlLocale[locale]);

export function Legend({ series }: { series: Series[] }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2" aria-hidden="true">
    {series.map((s) => <li key={s.key} className="inline-flex items-center gap-1.5"><span className={`size-2.5 rounded-[3px] ${s.swatch}`} />{s.label}</li>)}
  </ul>;
}

function DataTableHidden({ caption, series, points, locale }: { caption: string; series: Series[]; points: Point[]; locale: Locale }) {
  return <table className="sr-only">
    <caption>{caption}</caption>
    <thead><tr><th scope="col">{dictionaries[locale].common.chartItem}</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
    <tbody>{points.map((p) => <tr key={p.label}><th scope="row">{p.label}</th>{series.map((s) => <td key={s.key}>{p.values[s.key] ?? 0}</td>)}</tr>)}</tbody>
  </table>;
}

/**
 * Vertical stacked columns, one per point (e.g. one per day). The scale is the
 * largest column; an all-zero chart draws empty columns rather than inventing
 * a scale. Only every `labelEvery`-th label is printed to keep 30 days legible.
 */
export function ColumnChart({ title, summary, series, points, height = 140, labelEvery = 1, locale = defaultLocale }: {
  title: string; summary: string; series: Series[]; points: Point[]; height?: number; labelEvery?: number; locale?: Locale;
}) {
  const fmt = format(locale);
  const max = Math.max(0, ...points.map((p) => sum(p, series)));
  return <figure className="min-w-0">
    {/* The scale, since columns have no axis: the tallest column's value. */}
    <p className="mb-1 text-right text-[11px] tabular-nums text-ink-3" aria-hidden="true">{dictionaries[locale].common.chartHighest}: {fmt(max)}</p>
    <div role="img" aria-label={`${title}. ${summary}`} className="flex items-end gap-[3px] border-b border-hairline" style={{ height }}>
      {points.map((p) => {
        const total = sum(p, series);
        return <div key={p.label} title={`${p.label}: ${series.map((s) => `${s.label} ${fmt(p.values[s.key] ?? 0)}`).join(" · ")}`}
          className="flex h-full min-w-0 flex-1 flex-col-reverse">
          {max > 0 && total > 0 && series.map((s) => {
            const v = p.values[s.key] ?? 0;
            return v > 0 ? <div key={s.key} className={s.swatch} style={{ height: `${(v / max) * 100}%` }} /> : null;
          })}
        </div>;
      })}
    </div>
    <div className="mt-1 flex gap-[3px] text-[11px] tabular-nums text-ink-3" aria-hidden="true">
      {points.map((p, i) => <span key={p.label} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">{i % labelEvery === 0 ? p.label : ""}</span>)}
    </div>
    <figcaption className="mt-3"><Legend series={series} /></figcaption>
    <DataTableHidden caption={title} series={series} points={points} locale={locale} />
  </figure>;
}

/** Horizontal stacked bars, one row per point, with the total at the end. */
export function BarChart({ title, summary, series, points, locale = defaultLocale }: { title: string; summary: string; series: Series[]; points: Point[]; locale?: Locale }) {
  const fmt = format(locale);
  const max = Math.max(0, ...points.map((p) => sum(p, series)));
  return <figure className="min-w-0">
    <div role="img" aria-label={`${title}. ${summary}`} className="space-y-2.5">
      {points.map((p) => {
        const total = sum(p, series);
        return <div key={p.label} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-[13px]"
          title={`${p.label}: ${series.map((s) => `${s.label} ${fmt(p.values[s.key] ?? 0)}`).join(" · ")}`}>
          <span className="truncate text-ink-2">{p.label}</span>
          <span className="flex h-3.5 overflow-hidden rounded-[4px] bg-fill">
            {max > 0 && series.map((s) => {
              const v = p.values[s.key] ?? 0;
              return v > 0 ? <span key={s.key} className={s.swatch} style={{ width: `${(v / max) * 100}%` }} /> : null;
            })}
          </span>
          <span className="text-right tabular-nums text-ink">{fmt(total)}</span>
        </div>;
      })}
    </div>
    <figcaption className="mt-3"><Legend series={series} /></figcaption>
    <DataTableHidden caption={title} series={series} points={points} locale={locale} />
  </figure>;
}
