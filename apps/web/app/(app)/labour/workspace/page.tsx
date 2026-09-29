import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { entityStatuses, likePattern } from "@/lib/education/domain";
import { classificationLabel } from "@/lib/labour/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { OccupationForm, OccupationReviewForm } from "./forms";
import { Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, Quote, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";
import { VisibilityNote } from "@/components/review/visibility-note";
import { ReviewSteps } from "@/components/review/review-steps";
import { DecisionHistory } from "@/components/review/decision-history";
import { permissionName } from "@/lib/rbac/labels";
import { publicIds } from "@/lib/review/public-check";
import { visibilityOf } from "@/lib/review/visibility";

type Row = { id: string; name: string; status: string; classification_system: string | null; classification_code: string | null; evidence_excerpt: string; document_id: string; countries: { name: string } | null };
const tabs = [["proposed", "Chờ duyệt"], ["reviewed", "Đã duyệt"], ["rejected", "Từ chối"]] as const;

export default async function Page({ searchParams }: PageProps<"/labour/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("labour.manage"), review = permissions.includes("facts.review");
  if (!manage && !review) return <NoAccess title="Bạn chưa có quyền biên tập thị trường lao động" back="/occupations" backLabel="Xem trang công khai">{`Nhờ quản trị viên cấp quyền “${permissionName("labour.manage")}” để đề xuất, hoặc “${permissionName("facts.review")}” để duyệt, ở trang Người dùng & phân quyền.`}</NoAccess>;
  const params = await searchParams;
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "proposed");
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  let list = client.from("occupations").select("id,name,status,classification_system,classification_code,evidence_excerpt,document_id,countries(name)", { count: "exact" }).eq("status", status);
  if (q) list = list.ilike("name", likePattern(q));
  const results = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, to),
    client.from("documents").select("id,title,canonical_url").order("created_at", { ascending: false }).limit(100),
    client.from("countries").select("id,name").order("name"),
    client.from("occupation_reviews").select("id,decision,note,created_at,occupations(name)").order("created_at", { ascending: false }).limit(20),
    ...tabs.map(([s]) => client.from("occupations").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/labour/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("labour_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rows = (results[0].data ?? []) as unknown as Row[];
  const documents = (results[1].data as { id: string; title: string | null; canonical_url: string }[]).map((d) => ({ id: d.id, label: d.title ?? d.canonical_url }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as unknown as { id: string; decision: string; note: string; created_at: string; occupations: { name: string } | null }[];
  const tabCounts = results.slice(4).map((r) => r.count ?? 0);
  // occupations_public needs only the review itself, so there are no blockers
  // to explain; the check still comes from the database, not from the status.
  const visible = status === "reviewed" ? await publicIds("occupations", rows.map((r) => r.id)) : new Set<string>();
  return <>
    <PageHeader eyebrow="Workspace" title="Thị trường lao động"
      description="Ở đây chỉ lưu tên và mã phân loại của nghề. Số liệu như lương hay nhu cầu tuyển dụng được nhập và duyệt ở “Thông tin & bằng chứng”, và chỉ hiển thị công khai khi nguồn của số liệu đã được xác minh."
      actions={<><Link className={`${textLink} text-[15px]`} href="/occupations">Trang công khai</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">Nhập số liệu</Link></>} />
    {review && <ReviewSteps client={client} permissions={permissions} current="labour" />}
    {manage && <Disclosure summary="Đề xuất nghề"><OccupationForm countries={countries} documents={documents} /></Disclosure>}
    <Section title="Danh sách">
      <Segmented label="Trạng thái" items={tabs.map(([value, label], i) => ({ href: withParams("/labour/workspace", { q }, { status: value === "proposed" ? null : value }), label, count: tabCounts[i], active: status === value }))} />
      <form action="/labour/workspace" className="mb-5">{status !== "proposed" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder="Tìm tên nghề" /></form>
      {rows.length ? <List>{rows.map((r) => <ListRow key={r.id} title={r.name}
        badges={<ReviewBadge status={r.status}>{entityStatuses[r.status]}</ReviewBadge>}
        subtitle={`${r.countries?.name ?? "Quốc tế"} · ${classificationLabel(r.classification_system, r.classification_code)}`}>
        <div className="mb-2"><VisibilityNote visibility={visibilityOf(r.id, r.status, visible, [])} publicHref={`/occupations/${r.id}`} /></div>
        <Disclosure small open={review && r.status === "proposed"} summary={review && r.status === "proposed" ? "Bằng chứng và quyết định" : "Bằng chứng"}>
          <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
            <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>Tài liệu bằng chứng</Link>
            {review && r.status === "proposed" && <OccupationReviewForm id={r.id} />}</div>
        </Disclosure>
      </ListRow>)}</List> : <EmptyState>{status === "proposed" ? "Không có nghề nào đang chờ duyệt." : "Không có mục nào trong nhóm này."}</EmptyState>}
      <Pagination summary={pageSummary(results[0].count ?? rows.length, page)} href={(p) => withParams("/labour/workspace", params, { page: p })} />
    </Section>
    <Section>
      <DecisionHistory items={reviews.map((r) => ({ id: r.id, title: r.occupations?.name ?? "Nghề không còn truy cập được", decision: r.decision, note: r.note, createdAt: r.created_at }))} />
    </Section>
  </>;
}
