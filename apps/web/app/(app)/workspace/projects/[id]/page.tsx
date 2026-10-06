import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern } from "@/lib/documents/domain";
import { compareHref } from "@/lib/compare/domain";
import { describeItem, itemEmbeds, itemKindLabel } from "@/lib/workspace/domain";
import { countryName } from "@/lib/registry/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { Badge, BackLink, Card, Disclosure, EmptyState, List, ListRow, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { DeleteNoteButton, DeleteProjectForm, FileSavedSelect, NoteForm, ProjectForm, ProjectStatusButton, RemoveSavedButton } from "../../forms";

type Project = { id: string; name: string; description: string | null; target_year: number | null; target_role: string | null; status: string;
  research_project_countries: { countries: { id: string; slug: string; name: string } }[] };

export default async function ProjectPage({ params }: PageProps<"/workspace/projects/[id]">) {
  await requireAuth();
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const client = await createClient();
  const [projectResult, savedResult, notesResult, countriesResult, projectsResult] = await Promise.all([
    client.from("research_projects").select("id,name,description,target_year,target_role,status,research_project_countries(countries(id,slug,name))").eq("id", id).maybeSingle(),
    client.from("saved_items").select(`id,project_id,${itemEmbeds}`).eq("project_id", id).order("created_at", { ascending: false }).limit(200),
    client.from("notes").select(`id,content,updated_at,${itemEmbeds}`).eq("project_id", id).order("updated_at", { ascending: false }).limit(200),
    client.from("countries").select("id,name").order("name"),
    client.from("research_projects").select("id,name").eq("status", "active").order("name"),
  ]);
  if (projectResult.error || savedResult.error || notesResult.error || countriesResult.error || projectsResult.error) throw new Error("Không tải được dự án.");
  // RLS returns nothing for someone else's project: indistinguishable from "does not exist".
  if (!projectResult.data) notFound();
  const project = projectResult.data as unknown as Project;
  const targetCountries = project.research_project_countries.map((c) => c.countries);
  const saved = (savedResult.data ?? []) as unknown as (Parameters<typeof describeItem>[0] & { id: string; project_id: string | null })[];
  const notes = (notesResult.data ?? []) as unknown as (Parameters<typeof describeItem>[0] & { id: string; content: string; updated_at: string })[];
  const projects = (projectsResult.data as { id: string; name: string }[]).map((p) => ({ id: p.id, label: p.name }));
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const [t, p] = [dict.workspace, dict.workspace.projectPage];
  return <>
    <PageHeader back={<BackLink href="/workspace">{t.title}</BackLink>} eyebrow={project.status === "archived" ? p.archivedEyebrow : p.eyebrow} title={project.name}
      description={[project.target_year, project.target_role].filter(Boolean).join(" · ") || undefined}
      actions={<ProjectStatusButton id={project.id} status={project.status} locale={locale} />} />
    {project.description && <p className="-mt-4 mb-8 max-w-2xl whitespace-pre-wrap px-1 text-[15px] text-ink-2">{project.description}</p>}

    <Section title={p.targetCountries} description={p.targetCountriesDescription}>
      {targetCountries.length ? <div className="flex flex-wrap gap-2">
        {targetCountries.map((c) => <Link key={c.id} href={`/countries/${c.slug}`} className="rounded-full bg-fill px-3.5 py-1.5 text-[14px] hover:bg-fill-strong">{countryName(c.slug, c.name, locale)}</Link>)}
        {targetCountries.length >= 2 && <Link href={compareHref(targetCountries.map((c) => c.slug))} className="rounded-full bg-accent px-3.5 py-1.5 text-[14px] text-white hover:bg-accent-hover">{p.compareThese}</Link>}
      </div> : <EmptyState>{p.noCountries}</EmptyState>}
    </Section>

    <Section title={p.saved}>
      {saved.length ? <List>{saved.map((row) => {
        const item = describeItem(row);
        if (!item) return null;
        return <ListRow key={row.id} title={<Link href={item.href} className="hover:underline">{item.title}</Link>} badges={<Badge>{itemKindLabel(item.kind, locale)}</Badge>}>
          <div className="flex flex-wrap items-center gap-4"><FileSavedSelect id={row.id} current={row.project_id} projects={projects} locale={locale} /><RemoveSavedButton id={row.id} locale={locale} /></div>
        </ListRow>;
      })}</List> : <EmptyState>{p.noSaved} <Link href="/workspace" className={textLink}>{t.title}</Link>.</EmptyState>}
    </Section>

    <Section title={p.notes} description={p.notesDescription}>
      <Card><NoteForm projectId={project.id} placeholder={p.notePlaceholder} locale={locale} /></Card>
      {notes.length > 0 && <div className="mt-4"><List>{notes.map((n) => {
        const item = describeItem(n);
        return <ListRow key={n.id} title={<span className="whitespace-pre-wrap font-normal">{n.content}</span>} badges={<Badge>{t.yourNote}</Badge>}
          meta={<>{item && <><Link href={item.href} className="hover:underline">{item.title}</Link> · </>}{t.editedOn(new Date(n.updated_at).toISOString().slice(0, 10))}</>}>
          <Disclosure small summary={t.edit}><div className="space-y-3"><NoteForm note={{ id: n.id, content: n.content }} locale={locale} /><DeleteNoteButton id={n.id} locale={locale} /></div></Disclosure>
        </ListRow>;
      })}</List></div>}
    </Section>

    <Section title={p.settings}>
      <div className="space-y-3">
        <Disclosure summary={p.edit}><Card><ProjectForm locale={locale} countries={(countriesResult.data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }))}
          project={{ id: project.id, name: project.name, description: project.description, target_year: project.target_year, target_role: project.target_role, countries: targetCountries.map((c) => c.id) }} /></Card></Disclosure>
        <Disclosure summary={p.delete}><Card><DeleteProjectForm id={project.id} locale={locale} /></Card></Disclosure>
      </div>
    </Section>
  </>;
}
