import { accessContext } from "@/lib/rbac/access";
import { listSources } from "@/lib/registry/queries";
import { Card, NoAccess, PageHeader } from "@/components/ui";
import { permissionName } from "@/lib/rbac/labels";
import { ImportForm } from "./form";
import { getDictionary, getLocale } from "@/lib/i18n/server";
export default async function ImportPage() {
  const context = await accessContext();
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.documentEditor;
  if (!context.permissions.includes("documents.ingest")) return <NoAccess title={t.noAccessTitle} locale={locale}>{t.noAccessHelp(permissionName("documents.ingest", locale))}</NoAccess>;
  const sources = await listSources({});
  return <>
    <PageHeader eyebrow={dict.editor.eyebrow} title={t.title} description={t.description} />
    <Card><ImportForm sources={sources.slice(0,100).map((s) => ({ id:s.id,name:s.name,url:s.canonicalUrl,blocked:s.crawlPolicy === "blocked" }))} locale={locale} /></Card>
  </>;
}
