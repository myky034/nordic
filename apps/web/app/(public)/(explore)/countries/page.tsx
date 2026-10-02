import { connection } from "next/server";
import Link from "next/link";
import { listCountries } from "@/lib/registry/queries";
import { countryName, countryStatusLabels } from "@/lib/registry/domain";
import { sortRows } from "@/lib/table";
import { Badge, Chevron, countLabel, EmptyState, PageHeader } from "@/components/ui";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { textLink } from "@/components/ui/styles";

// Card grid (pattern 5 in /dev/preview/patterns): a visitor scans and picks
// a country. Only registry data is shown: name, source count (and, for
// editors, the research status).
export default async function CountriesPage() {
  // Database reads belong to request time, not production build time.
  await connection();
  // Ordered by the Vietnamese name the visitor reads, not the stored English one.
  const countries = sortRows(await listCountries(), (c) => countryName(c.slug, c.name), "asc");
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  return <>
    <PageHeader eyebrow="Quốc gia" title="Bắt đầu với một quốc gia"
      description="Năm quốc gia trong phạm vi nghiên cứu ban đầu. Hồ sơ của mỗi nước chỉ được bổ sung khi thông tin đã được đối chiếu với nguồn; không có gì được suy đoán." />
    {!countries.length ? <EmptyState>Chưa có quốc gia nào được đăng ký.</EmptyState>
      : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {countries.map((c) => <Link key={c.id} href={`/countries/${c.slug}`}
          className="group flex flex-col rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline transition hover:shadow-[0_8px_24px_rgb(0_0_0/0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-3">{c.name}</p>
          <h2 className="mt-1 text-[22px] font-semibold leading-snug text-ink">{countryName(c.slug, c.name)}</h2>
          {internal && <div className="mt-3"><Badge tone={c.status === "active" ? "accent" : "neutral"}>{countryStatusLabels[c.status] ?? c.status}</Badge></div>}
          <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-[14px]">
            <span className="text-ink-2">{countLabel(c._count.sources, "nguồn đã đăng ký")}</span>
            <span className="inline-flex items-center gap-1 font-medium text-accent">Xem hồ sơ<Chevron className="text-accent transition-transform group-hover:translate-x-0.5" /></span>
          </div>
        </Link>)}
      </div>}
    <p className="mt-6 px-1 text-[15px]"><Link href="/sources" className={textLink}>Xem tất cả nguồn đã đăng ký</Link></p>
  </>;
}
