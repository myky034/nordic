import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { choiceParam, pageParam, pageSummary, pageWindow, withParams } from "@/lib/pagination";
import { describeItem, itemEmbeds, itemKindLabel, itemKindList, itemKinds } from "@/lib/workspace/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { Badge, Card, Disclosure, EmptyState, List, ListRow, PageHeader, Pagination, Section, Segmented } from "@/components/ui";
import { buttonSecondary } from "@/components/ui/styles";
import { DeleteNoteButton, DeleteWorkspaceForm, FileSavedSelect, NoteForm, ProjectForm, RemoveSavedButton } from "./forms";

type Project = { id: string; name: string; target_year: number | null; target_role: string | null; status: string; research_project_countries: { countries: { name: string } }[] };
type Saved = Parameters<typeof describeItem>[0] & { id: string; project_id: string | null; created_at: string };
type NoteRow = Parameters<typeof describeItem>[0] & { id: string; content: string; updated_at: string; research_projects: { id: string; name: string } | null };
const day = (v: string) => new Date(v).toISOString().slice(0, 10);

export default async function WorkspacePage({ searchParams }: PageProps<"/workspace">) {
  await requireAuth();
  const params = await searchParams;
  const kind = choiceParam(params, "kind", ["all", ...itemKindList] as const, "all");
  const projectTab = choiceParam(params, "projects", ["active", "archived"] as const, "active");
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  // The signed-in user's client: owner-only RLS returns this user's rows only.
  const client = await createClient();
  let saved = client.from("saved_items").select(`id,project_id,created_at,${itemEmbeds}`, { count: "exact" });
  if (kind !== "all") saved = saved.not(itemKinds[kind].column, "is", null);
  const results = await Promise.all([
    client.from("research_projects").select("id,name,target_year,target_role,status,research_project_countries(countries(name))").eq("status", projectTab).order("updated_at", { ascending: false }).limit(50),
    saved.order("created_at", { ascending: false }).range(from, to),
    client.from("notes").select(`id,content,updated_at,research_projects(id,name),${itemEmbeds}`).order("updated_at", { ascending: false }).limit(10),
    client.from("countries").select("id,name").order("name"),
    client.from("research_projects").select("id,name").eq("status", "active").order("name"),
    ...itemKindList.map((k) => client.from("saved_items").select("id", { count: "exact", head: true }).not(itemKinds[k].column, "is", null)),
  ]);
  if (results.some((r) => r.error && r.error.code !== "PGRST103")) throw new Error("Không tải được workspace.");
  const projects = (results[0].data ?? []) as unknown as Project[];
  const items = (results[1].data ?? []) as unknown as Saved[];
  const notes = (results[2].data ?? []) as unknown as NoteRow[];
  const countries = (results[3].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const activeProjects = (results[4].data as { id: string; name: string }[]).map((p) => ({ id: p.id, label: p.name }));
  const kindCounts = results.slice(5).map((r) => r.count ?? 0);
  const total = kindCounts.reduce((a, b) => a + b, 0);

  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.workspace;
  return <>
    <PageHeader eyebrow={t.title} title={t.title} description={t.description}
      actions={<Link href="/workspace/plan" className={buttonSecondary}>{t.planLink}</Link>} />

    <Section title={t.projects}>
      <Segmented label={t.projectStatus} items={[["active", t.active], ["archived", t.archived]].map(([v, l]) => ({ href: withParams("/workspace", { kind: kind === "all" ? "" : kind }, { projects: v === "active" ? null : v }), label: l, active: projectTab === v }))} />
      {projects.length ? <List>{projects.map((p) => <ListRow key={p.id} href={`/workspace/projects/${p.id}`} title={p.name}
        subtitle={[p.target_year, p.target_role, p.research_project_countries.map((c) => c.countries.name).join(", ")].filter(Boolean).join(" · ") || t.noGoal} />)}</List>
        : <EmptyState>{projectTab === "active" ? t.noProjects : t.noArchived}</EmptyState>}
      <div className="mt-4 px-1"><Disclosure summary={t.newProject}><Card><ProjectForm countries={countries} locale={locale} /></Card></Disclosure></div>
    </Section>

    <Section title={t.saved} description={t.savedDescription}>
      <Segmented label={t.itemKind} items={[
        { href: withParams("/workspace", { projects: projectTab === "active" ? "" : projectTab }, {}), label: dict.common.all, count: total, active: kind === "all" },
        ...itemKindList.map((k, i) => ({ href: withParams("/workspace", { projects: projectTab === "active" ? "" : projectTab }, { kind: k }), label: itemKindLabel(k, locale), count: kindCounts[i], active: kind === k })),
      ]} />
      {items.length ? <List>{items.map((row) => {
        const item = describeItem(row);
        if (!item) return null;
        return <ListRow key={row.id} title={<Link href={item.href} className="hover:underline">{item.title}</Link>} badges={<Badge>{itemKindLabel(item.kind, locale)}</Badge>} meta={t.savedOn(day(row.created_at))}>
          <div className="flex flex-wrap items-center gap-4"><FileSavedSelect id={row.id} current={row.project_id} projects={activeProjects} locale={locale} /><RemoveSavedButton id={row.id} locale={locale} /></div>
          <Disclosure small summary={t.noteAboutItem} className="mt-2"><NoteForm kind={item.kind} itemId={item.id} locale={locale} /></Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>{t.noSaved(kind !== "all")}</EmptyState>}
      <Pagination summary={pageSummary(results[1].count ?? items.length, page)} href={(p) => withParams("/workspace", params, { page: p })} locale={locale} />
    </Section>

    <Section title={t.recentNotes} description={t.notesDescription}>
      {notes.length ? <List>{notes.map((n) => {
        const item = describeItem(n);
        return <ListRow key={n.id} title={<span className="whitespace-pre-wrap font-normal">{n.content.length > 240 ? `${n.content.slice(0, 240)}…` : n.content}</span>}
          badges={<Badge>{t.yourNote}</Badge>}
          meta={<>{n.research_projects ? <Link href={`/workspace/projects/${n.research_projects.id}`} className="hover:underline">{n.research_projects.name}</Link> : t.noProject}{item && <> · <Link href={item.href} className="hover:underline">{item.title}</Link></>} · {t.editedOn(day(n.updated_at))}</>}>
          <Disclosure small summary={t.edit}><div className="space-y-3"><NoteForm note={{ id: n.id, content: n.content }} locale={locale} /><DeleteNoteButton id={n.id} locale={locale} /></div></Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>{t.noNotes}</EmptyState>}
    </Section>

    <Section title={t.yourData}>
      <Disclosure summary={t.deleteAll}><Card><DeleteWorkspaceForm locale={locale} /></Card></Disclosure>
    </Section>
  </>;
}
