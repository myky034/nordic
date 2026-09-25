import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern } from "@/lib/documents/domain";
import { compareHref } from "@/lib/compare/domain";
import { describeItem, itemEmbeds, itemKinds } from "@/lib/workspace/domain";
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
  if (projectResult.error || savedResult.error || notesResult.error || countriesResult.error || projectsResult.error) throw new Error("Không tải được project.");
  // RLS returns nothing for someone else's project: indistinguishable from "does not exist".
  if (!projectResult.data) notFound();
  const project = projectResult.data as unknown as Project;
  const targetCountries = project.research_project_countries.map((c) => c.countries);
  const saved = (savedResult.data ?? []) as unknown as (Parameters<typeof describeItem>[0] & { id: string; project_id: string | null })[];
  const notes = (notesResult.data ?? []) as unknown as (Parameters<typeof describeItem>[0] & { id: string; content: string; updated_at: string })[];
  const projects = (projectsResult.data as { id: string; name: string }[]).map((p) => ({ id: p.id, label: p.name }));
  return <>
    <PageHeader back={<BackLink href="/workspace">My workspace</BackLink>} eyebrow={project.status === "archived" ? "Project · đã lưu trữ" : "Project"} title={project.name}
      description={[project.target_year, project.target_role].filter(Boolean).join(" · ") || undefined}
      actions={<ProjectStatusButton id={project.id} status={project.status} />} />
    {project.description && <p className="-mt-4 mb-8 max-w-2xl whitespace-pre-wrap px-1 text-[15px] text-ink-2">{project.description}</p>}

    <Section title="Quốc gia mục tiêu" description="Lối tắt tới dữ liệu công khai của các nước bạn chọn — không phải khuyến nghị.">
      {targetCountries.length ? <div className="flex flex-wrap gap-2">
        {targetCountries.map((c) => <Link key={c.id} href={`/countries/${c.slug}`} className="rounded-full bg-fill px-3.5 py-1.5 text-[14px] hover:bg-fill-strong">{c.name}</Link>)}
        {targetCountries.length >= 2 && <Link href={compareHref(targetCountries.map((c) => c.slug))} className="rounded-full bg-accent px-3.5 py-1.5 text-[14px] text-white hover:bg-accent-hover">So sánh các nước này</Link>}
      </div> : <EmptyState>Chưa chọn quốc gia. Sửa project để thêm.</EmptyState>}
    </Section>

    <Section title="Mục đã lưu trong project">
      {saved.length ? <List>{saved.map((row) => {
        const item = describeItem(row);
        if (!item) return null;
        return <ListRow key={row.id} title={<Link href={item.href} className="hover:underline">{item.title}</Link>} badges={<Badge>{itemKinds[item.kind].label}</Badge>}>
          <div className="flex flex-wrap items-center gap-4"><FileSavedSelect id={row.id} current={row.project_id} projects={projects} /><RemoveSavedButton id={row.id} /></div>
        </ListRow>;
      })}</List> : <EmptyState>Chưa có mục nào. Lưu mục ở các trang công khai, rồi chọn project này ở <Link href="/workspace" className={textLink}>My workspace</Link>.</EmptyState>}
    </Section>

    <Section title="Ghi chú" description="Chỉ bạn xem được. Ghi chú không phải thông tin đã kiểm chứng.">
      <Card><NoteForm projectId={project.id} placeholder="Ví dụ: cần chuẩn bị bảng điểm trước tháng 11…" /></Card>
      {notes.length > 0 && <div className="mt-4"><List>{notes.map((n) => {
        const item = describeItem(n);
        return <ListRow key={n.id} title={<span className="whitespace-pre-wrap font-normal">{n.content}</span>} badges={<Badge>Ghi chú của bạn</Badge>}
          meta={<>{item && <><Link href={item.href} className="hover:underline">{item.title}</Link> · </>}sửa ngày {new Date(n.updated_at).toISOString().slice(0, 10)}</>}>
          <Disclosure small summary="Sửa"><div className="space-y-3"><NoteForm note={{ id: n.id, content: n.content }} /><DeleteNoteButton id={n.id} /></div></Disclosure>
        </ListRow>;
      })}</List></div>}
    </Section>

    <Section title="Cài đặt project">
      <div className="space-y-3">
        <Disclosure summary="Sửa project"><Card><ProjectForm countries={(countriesResult.data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }))}
          project={{ id: project.id, name: project.name, description: project.description, target_year: project.target_year, target_role: project.target_role, countries: targetCountries.map((c) => c.id) }} /></Card></Disclosure>
        <Disclosure summary="Xóa project"><Card><DeleteProjectForm id={project.id} /></Card></Disclosure>
      </div>
    </Section>
  </>;
}
