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
import { VisibilityNote } from "@/components/review/visibility-note";
import { ReviewSteps } from "@/components/review/review-steps";
import { DecisionHistory } from "@/components/review/decision-history";
import { permissionName } from "@/lib/rbac/labels";
import { publicIds } from "@/lib/review/public-check";
import { programmeBlockers, visibilityOf } from "@/lib/review/visibility";

type Row = { id: string; name: string; status: string; official_url: string; evidence_excerpt: string; document_id: string;
  countries?: { name: string }; degree_type?: string; universities?: { name: string; status: string } };
const kinds = [["university", "Trường"], ["programme", "Chương trình"]] as const;
const tabs = [["proposed", "Chờ duyệt"], ["reviewed", "Đã duyệt"], ["rejected", "Từ chối"]] as const;

export default async function Page({ searchParams }: PageProps<"/education/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("education.manage"), review = permissions.includes("facts.review");
  if (!manage && !review) return <NoAccess title="Bạn chưa có quyền biên tập giáo dục" back="/programmes" backLabel="Xem chương trình công khai">{`Nhờ quản trị viên cấp quyền “${permissionName("education.manage")}” để đề xuất, hoặc “${permissionName("facts.review")}” để duyệt, ở trang Người dùng & phân quyền.`}</NoAccess>;
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
    client.from("education_reviews").select("id,university_id,decision,note,created_at,universities(name),programmes(name)").order("created_at", { ascending: false }).limit(20),
    client.from("universities").select("id,name,countries(name)").neq("status", "rejected").order("name").limit(300),
    ...tabs.map(([s]) => client.from(table).select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/education/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("education_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rows = (results[0].data ?? []) as unknown as Row[];
  const documents = (results[1].data as { id: string; title: string | null; canonical_url: string }[]).map((d) => ({ id: d.id, label: d.title ?? d.canonical_url }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as unknown as { id: string; university_id: string | null; decision: string; note: string; created_at: string; universities: { name: string } | null; programmes: { name: string } | null }[];
  const liveUniversities = (results[4].data as unknown as { id: string; name: string; countries: { name: string } }[]).map((u) => ({ id: u.id, label: `${u.name} · ${u.countries.name}` }));
  const tabCounts = results.slice(5).map((r) => r.count ?? 0);
  const visible = status === "reviewed" ? await publicIds(table, rows.map((r) => r.id)) : new Set<string>();
  const base = { kind: kind === "university" ? null : kind };
  return <>
    <PageHeader eyebrow="Workspace" title="Trường & chương trình"
      description="Duyệt ở đây chỉ xác nhận trường hoặc chương trình có tồn tại theo nguồn. Học phí và hạn nộp là thông tin riêng, được duyệt ở “Thông tin & bằng chứng”. Một chương trình chỉ hiển thị công khai khi trường của nó đã được duyệt."
      actions={<><Link className={`${textLink} text-[15px]`} href="/programmes">Trang công khai</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">Nhập học phí / deadline</Link></>} />
    {review && <ReviewSteps client={client} permissions={permissions} current="education" />}
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
          <div className="mb-2"><VisibilityNote visibility={visibilityOf(r.id, r.status, visible, kind === "programme" ? programmeBlockers({ universityStatus: r.universities?.status }) : [])}
            publicHref={`/${kind === "university" ? "universities" : "programmes"}/${r.id}`} /></div>
          <Disclosure small open={review && r.status === "proposed"} summary={review && r.status === "proposed" ? "Bằng chứng và quyết định" : "Bằng chứng"}>
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
      <DecisionHistory items={reviews.map((r) => ({ id: r.id, decision: r.decision, note: r.note, createdAt: r.created_at,
        title: (r.university_id ? r.universities?.name : r.programmes?.name) ?? "Mục không còn truy cập được", detail: r.university_id ? "Trường" : "Chương trình" }))} />
    </Section>
  </>;
}
