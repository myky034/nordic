import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { degreeLabel, entityStatuses, likePattern } from "@/lib/education/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { EducationReviewForm, ProgrammeForm, UniversityForm } from "./forms";
import { Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, Quote, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";

type Row = { id: string; name: string; status: string; official_url: string; evidence_excerpt: string; document_id: string;
  countries?: { name: string }; degree_type?: string; universities?: { name: string; status: string } };
const kinds = [["university", "Trường"], ["programme", "Chương trình"]] as const;
const tabs = [["proposed", "Chờ duyệt"], ["reviewed", "Đã duyệt"], ["rejected", "Từ chối"]] as const;

export default async function Page({ searchParams }: PageProps<"/education/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("education.manage"), review = permissions.includes("facts.review");
  if (!manage && !review) return <NoAccess title="Bạn chưa có quyền biên tập giáo dục" back="/programmes" backLabel="Xem chương trình công khai">Nhờ quản trị viên cấp education.manage (đề xuất) hoặc facts.review (duyệt) tại Người dùng & phân quyền.</NoAccess>;
  const params = await searchParams;
  const kind = choiceParam(params, "kind", kinds.map(([v]) => v), "university");
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "proposed");
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const table = kind === "university" ? "universities" : "programmes";
  const select = kind === "university"
    ? "id,name,status,official_url,evidence_excerpt,document_id,countries(name)"
    : "id,name,status,degree_type,official_url,evidence_excerpt,document_id,universities!programmes_university_id_fkey(name,status)";
  let list = client.from(table).select(select, { count: "exact" }).eq("status", status);
  if (q) list = list.ilike("name", likePattern(q));
  // Editors see drafts through the *_editors RLS policies; nothing here uses a
  // privileged key.
  const results = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, to),
    client.from("documents").select("id,title,canonical_url").order("created_at", { ascending: false }).limit(100),
    client.from("countries").select("id,name").order("name"),
    client.from("education_reviews").select("id,university_id,programme_id,decision,note,created_at").order("created_at", { ascending: false }).limit(20),
    client.from("universities").select("id,name,countries(name)").neq("status", "rejected").order("name").limit(300),
    ...tabs.map(([s]) => client.from(table).select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/education/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("education_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rows = (results[0].data ?? []) as unknown as Row[];
  const documents = (results[1].data as { id: string; title: string | null; canonical_url: string }[]).map((d) => ({ id: d.id, label: d.title ?? d.canonical_url }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as { id: string; university_id: string | null; programme_id: string | null; decision: string; note: string; created_at: string }[];
  const liveUniversities = (results[4].data as unknown as { id: string; name: string; countries: { name: string } }[]).map((u) => ({ id: u.id, label: `${u.name} · ${u.countries.name}` }));
  const tabCounts = results.slice(5).map((r) => r.count ?? 0);
  const base = { kind: kind === "university" ? null : kind };
  return <>
    <PageHeader eyebrow="Workspace" title="Trường & chương trình"
      description="Chỉ nhập mục có trong tài liệu nguồn. Duyệt ở đây xác nhận bằng chứng tồn tại, không xác nhận học phí, deadline hay hiệu lực hiện tại."
      actions={<><Link className={`${textLink} text-[15px]`} href="/programmes">Trang công khai</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">Nhập học phí / deadline</Link></>} />
    {manage && <div className="space-y-3">
      <Disclosure summary="Đề xuất trường đại học"><UniversityForm countries={countries} documents={documents} /></Disclosure>
      <Disclosure summary="Đề xuất chương trình học"><ProgrammeForm universities={liveUniversities} documents={documents} /></Disclosure>
    </div>}
    <Section title="Danh sách">
      <div className="flex flex-wrap items-start gap-3">
        <Segmented label="Loại" items={kinds.map(([value, label]) => ({ href: withParams("/education/workspace", {}, { kind: value === "university" ? null : value }), label, active: kind === value }))} />
        <Segmented label="Trạng thái" items={tabs.map(([value, label], i) => ({ href: withParams("/education/workspace", { q }, { ...base, status: value === "proposed" ? null : value }), label, count: tabCounts[i], active: status === value }))} />
      </div>
      <form action="/education/workspace" className="mb-5">
        {kind !== "university" && <input type="hidden" name="kind" value={kind} />}{status !== "proposed" && <input type="hidden" name="status" value={status} />}
        <SearchInput defaultValue={q} placeholder={kind === "university" ? "Tìm tên trường" : "Tìm tên chương trình"} />
      </form>
      {rows.length ? <List>{rows.map((r) => {
        const blocked = kind === "programme" && r.universities?.status !== "reviewed";
        return <ListRow key={r.id} title={r.name}
          badges={<ReviewBadge status={r.status}>{entityStatuses[r.status]}</ReviewBadge>}
          subtitle={kind === "university" ? `${r.countries?.name} · ${r.official_url}` : `${degreeLabel(r.degree_type ?? "")} · ${r.universities?.name} · ${r.official_url}`}>
          <Disclosure small summary={review && r.status === "proposed" ? "Bằng chứng & duyệt" : "Bằng chứng"}>
            <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
              <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>Tài liệu bằng chứng</Link>
              {review && r.status === "proposed" && (blocked
                ? <p className="text-[15px] text-caution">Cần duyệt trường trước khi duyệt chương trình này.</p>
                : <EducationReviewForm kind={kind} id={r.id} />)}</div>
          </Disclosure>
        </ListRow>;
      })}</List> : <EmptyState>{status === "proposed" ? "Không có mục nào đang chờ duyệt." : "Không có mục nào trong nhóm này."}</EmptyState>}
      <Pagination summary={pageSummary(results[0].count ?? rows.length, page)} href={(p) => withParams("/education/workspace", params, { page: p })} />
    </Section>
    <Section>
      <Disclosure summary="20 quyết định gần nhất">
        {reviews.length ? <List>{reviews.map((r) => <ListRow key={r.id} title={r.decision}
          meta={new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16)} subtitle={r.note}>
          <p className="break-all text-[13px] text-ink-3">{r.university_id ? `Trường: ${r.university_id}` : `Chương trình: ${r.programme_id}`}</p>
        </ListRow>)}</List> : <EmptyState>Chưa có quyết định nào.</EmptyState>}
      </Disclosure>
    </Section>
  </>;
}
