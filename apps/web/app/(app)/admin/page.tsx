import { Suspense } from "react";
import { accessContext } from "@/lib/rbac/access";
import { permissionName } from "@/lib/rbac/labels";
import { readWindow } from "@/lib/admin/overview";
import { withParams } from "@/lib/pagination";
import { NoAccess, PageHeader, Section, Segmented } from "@/components/ui";
import { ActivitySection, CoverageSection, CrawlerSection, ExtractionSection } from "./sections";
import { SectionPlaceholder } from "./views";
import { getDictionary, getLocale } from "@/lib/i18n/server";

// Admin overview: system state, data coverage and review activity on one
// page, for administrators (roles.manage). Read-only; every figure links to
// the page where it can be acted on. Numbers come from lib/admin/overview.ts.
export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const { client, permissions } = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.adminOverview;
  if (!permissions.includes("roles.manage")) return <NoAccess title={t.noAccessTitle} locale={locale}>{t.noAccessHelp(permissionName("roles.manage", locale))}</NoAccess>;
  const params = await searchParams;
  const days = readWindow(params.days);
  const now = new Date();
  const props = { client, permissions, now, locale };
  return <>
    <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />
    <Section title={t.system}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<SectionPlaceholder />}><CrawlerSection {...props} /></Suspense>
        <Suspense fallback={<SectionPlaceholder />}><ExtractionSection {...props} /></Suspense>
      </div>
    </Section>
    <Section title={t.coverage} description={t.coverageDescription}>
      <Suspense fallback={<SectionPlaceholder />}><CoverageSection client={client} permissions={permissions} locale={locale} /></Suspense>
    </Section>
    <Section title={t.activity} actions={<Segmented label={t.window} scroll={false} items={[
      { href: withParams("/admin", params, { days: null }), label: t.days(7), active: days === 7 },
      { href: withParams("/admin", params, { days: "30" }), label: t.days(30), active: days === 30 },
    ]} />}>
      <Suspense key={days} fallback={<SectionPlaceholder />}><ActivitySection {...props} days={days} /></Suspense>
    </Section>
  </>;
}
