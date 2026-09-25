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

type Row = { id: string; name: string; status: string; classification_system: string | null; classification_code: string | null; evidence_excerpt: string; document_id: string; countries: { name: string } | null };
const tabs = [["proposed", "Chờ duyệt"], ["reviewed", "Đã duyệt"], ["rejected", "Từ chối"]] as const;

export default async function Page({ searchParams }: PageProps<"/labour/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("labour.manage"), review = permissions.includes("facts.review");
  if (!manage && !review) return <NoAccess title="Bạn chưa có quyền biên tập thị trường lao động" back="/occupations" backLabel="Xem trang công khai">Nhờ quản trị viên cấp labour.manage (đề xuất) hoặc facts.review (duyệt) tại Người dùng & phân quyền.</NoAccess>;
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
    client.from("occupation_reviews").select("id,occupation_id,decision,note,created_at").order("created_at", { ascending: false }).limit(20),
    ...tabs.map(([s]) => client.from("occupations").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/labour/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("labour_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rows = (results[0].data ?? []) as unknown as Row[];
  const documents = (results[1].data as { id: string; title: string | null; canonical_url: string }[]).map((d) => ({ id: d.id, label: d.title ?? d.canonical_url }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as { id: string; occupation_id: string; decision: string; note: string; created_at: string }[];
  const tabCounts = results.slice(4).map((r) => r.count ?? 0);
  return <>
    <PageHeader eyebrow="Workspace" title="Thị trường lao động"
      description="Nghề chỉ lưu thông tin nhận diện. Số liệu (lương, nhu cầu…) là thông tin có bằng chứng, bắt buộc có quốc gia và kỳ số liệu; chỉ hiển thị khi nguồn đã được xác minh."
      actions={<><Link className={`${textLink} text-[15px]`} href="/occupations">Trang công khai</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">Nhập số liệu</Link></>} />
    {manage && <Disclosure summary="Đề xuất nghề"><OccupationForm countries={countries} documents={documents} /></Disclosure>}
    <Section title="Danh sách">
      <Segmented label="Trạng thái" items={tabs.map(([value, label], i) => ({ href: withParams("/labour/workspace", { q }, { status: value === "proposed" ? null : value }), label, count: tabCounts[i], active: status === value }))} />
      <form action="/labour/workspace" className="mb-5">{status !== "proposed" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder="Tìm tên nghề" /></form>
      {rows.length ? <List>{rows.map((r) => <ListRow key={r.id} title={r.name}
        badges={<ReviewBadge status={r.status}>{entityStatuses[r.status]}</ReviewBadge>}
        subtitle={`${r.countries?.name ?? "Quốc tế"} · ${classificationLabel(r.classification_system, r.classification_code)}`}>
        <Disclosure small summary={review && r.status === "proposed" ? "Bằng chứng & duyệt" : "Bằng chứng"}>
          <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
            <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>Tài liệu bằng chứng</Link>
            {review && r.status === "proposed" && <OccupationReviewForm id={r.id} />}</div>
        </Disclosure>
      </ListRow>)}</List> : <EmptyState>{status === "proposed" ? "Không có nghề nào đang chờ duyệt." : "Không có mục nào trong nhóm này."}</EmptyState>}
      <Pagination summary={pageSummary(results[0].count ?? rows.length, page)} href={(p) => withParams("/labour/workspace", params, { page: p })} />
    </Section>
    <Section>
      <Disclosure summary="20 quyết định gần nhất">
        {reviews.length ? <List>{reviews.map((r) => <ListRow key={r.id} title={r.decision}
          meta={new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16)} subtitle={r.note}>
          <p className="break-all text-[13px] text-ink-3">Nghề: {r.occupation_id}</p>
        </ListRow>)}</List> : <EmptyState>Chưa có quyết định nào.</EmptyState>}
      </Disclosure>
    </Section>
  </>;
}
