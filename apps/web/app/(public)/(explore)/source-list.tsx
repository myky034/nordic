import Link from "next/link";
import type { Source } from "@nordic/db";
import { canonicalSourceUrl, dateLabel, tierLabel, verificationLabel } from "@/lib/registry/domain";

export function SourceList({ sources }: { sources: (Source & { country?: { name: string; slug: string } | null })[] }) {
  if (!sources.length) return <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">No sources found for this selection. Country coverage has not been inferred from the seed URLs.</p>;
  return <div className="divide-y divide-zinc-200 dark:divide-zinc-800">{sources.map((source) => {
    const url = canonicalSourceUrl(source.canonicalUrl);
    return <article key={source.id} className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-xl font-semibold">{source.name}</h2><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-900">{verificationLabel(source.status, source.lastVerifiedAt)}</span></div>
      {url ? <a className="mt-2 inline-block break-all text-sm underline underline-offset-4" href={url} target="_blank" rel="noopener noreferrer">{url}<span className="sr-only"> (opens in a new tab)</span></a> : <p>Source URL needs verification.</p>}
      <dl className="mt-5 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Source tier">{tierLabel(source.sourceTier)}</Field>
        <Field label="Country">{source.country ? <Link href={`/countries/${source.country.slug}`} className="underline">{source.country.name}</Link> : "Not assigned"}</Field>
        <Field label="Type / language">{source.sourceType ?? "Unknown"} / {source.language ?? "Unknown"}</Field>
        <Field label="Topics">{source.topics.length ? source.topics.join(", ") : "Not classified"}</Field>
        <Field label="Last crawled">{dateLabel(source.lastCrawledAt)}</Field>
        <Field label="Last registry verification">{dateLabel(source.lastVerifiedAt)}</Field>
        <Field label="Crawling">{source.crawlEnabled ? "Enabled" : "Disabled"} · {source.crawlPolicy.replaceAll("_", " ")}</Field>
        <Field label="Crawl frequency">{source.crawlFrequency ?? "Not scheduled"}</Field>
        <Field label="Authority evidence">{source.authorityNotes ?? "Not reviewed"}</Field>
      </dl>
      {source.notes && <p className="mt-5 max-w-3xl text-sm leading-6 text-zinc-500">{source.notes}</p>}
    </article>;
  })}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-zinc-500">{label}</dt><dd className="mt-1">{children}</dd></div>;
}
