import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { choiceParam, pageParam, pageSummary, pageWindow, withParams } from "@/lib/pagination";
import { describeItem, itemEmbeds, itemKindList, itemKinds } from "@/lib/workspace/domain";
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

  return <>
    <PageHeader eyebrow="Workspace" title="My workspace"
      description="Project, mục đã lưu và ghi chú của riêng bạn. Không ai khác xem được, kể cả quản trị viên."
      actions={<Link href="/workspace/plan" className={buttonSecondary}>My Europe Plan</Link>} />

    <Section title="Research projects">
      <Segmented label="Trạng thái project" items={[["active", "Đang làm"], ["archived", "Đã lưu trữ"]].map(([v, l]) => ({ href: withParams("/workspace", { kind: kind === "all" ? "" : kind }, { projects: v === "active" ? null : v }), label: l, active: projectTab === v }))} />
      {projects.length ? <List>{projects.map((p) => <ListRow key={p.id} href={`/workspace/projects/${p.id}`} title={p.name}
        subtitle={[p.target_year, p.target_role, p.research_project_countries.map((c) => c.countries.name).join(", ")].filter(Boolean).join(" · ") || "Chưa đặt mục tiêu"} />)}</List>
        : <EmptyState>{projectTab === "active" ? "Chưa có project nào. Tạo một project như “Sweden 2028” để gom trường, chương trình và ghi chú cho một kế hoạch." : "Chưa có project nào được lưu trữ."}</EmptyState>}
      <div className="mt-4 px-1"><Disclosure summary="Tạo project mới"><Card><ProjectForm countries={countries} /></Card></Disclosure></div>
    </Section>

    <Section title="Đã lưu" description="Bấm ☆ Lưu trên trang quốc gia, trường, chương trình, quy định, nghề hoặc nguồn để thêm vào đây.">
      <Segmented label="Loại mục" items={[
        { href: withParams("/workspace", { projects: projectTab === "active" ? "" : projectTab }, {}), label: "Tất cả", count: total, active: kind === "all" },
        ...itemKindList.map((k, i) => ({ href: withParams("/workspace", { projects: projectTab === "active" ? "" : projectTab }, { kind: k }), label: itemKinds[k].label, count: kindCounts[i], active: kind === k })),
      ]} />
      {items.length ? <List>{items.map((row) => {
        const item = describeItem(row);
        if (!item) return null;
        return <ListRow key={row.id} title={<Link href={item.href} className="hover:underline">{item.title}</Link>} badges={<Badge>{itemKinds[item.kind].label}</Badge>} meta={`Lưu ngày ${day(row.created_at)}`}>
          <div className="flex flex-wrap items-center gap-4"><FileSavedSelect id={row.id} current={row.project_id} projects={activeProjects} /><RemoveSavedButton id={row.id} /></div>
          <Disclosure small summary="Thêm ghi chú về mục này" className="mt-2"><NoteForm kind={item.kind} itemId={item.id} /></Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>Chưa có mục nào được lưu{kind !== "all" ? " trong nhóm này" : ""}.</EmptyState>}
      <Pagination summary={pageSummary(results[1].count ?? items.length, page)} href={(p) => withParams("/workspace", params, { page: p })} />
    </Section>

    <Section title="Ghi chú gần đây" description="Ghi chú là suy nghĩ riêng của bạn, không phải thông tin đã được kiểm chứng.">
      {notes.length ? <List>{notes.map((n) => {
        const item = describeItem(n);
        return <ListRow key={n.id} title={<span className="whitespace-pre-wrap font-normal">{n.content.length > 240 ? `${n.content.slice(0, 240)}…` : n.content}</span>}
          badges={<Badge>Ghi chú của bạn</Badge>}
          meta={<>{n.research_projects ? <Link href={`/workspace/projects/${n.research_projects.id}`} className="hover:underline">{n.research_projects.name}</Link> : "Không thuộc project"}{item && <> · <Link href={item.href} className="hover:underline">{item.title}</Link></>} · sửa ngày {day(n.updated_at)}</>}>
          <Disclosure small summary="Sửa"><div className="space-y-3"><NoteForm note={{ id: n.id, content: n.content }} /><DeleteNoteButton id={n.id} /></div></Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>Chưa có ghi chú nào.</EmptyState>}
    </Section>

    <Section title="Dữ liệu của bạn">
      <Disclosure summary="Xóa toàn bộ dữ liệu workspace"><Card><DeleteWorkspaceForm /></Card></Disclosure>
    </Section>
  </>;
}
