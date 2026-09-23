import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { accessContext, logAccessError } from "@/lib/rbac/access";
import { entityStatuses, likePattern } from "@/lib/education/domain";
import { ruleTypeLabel } from "@/lib/immigration/domain";
import { choiceParam, isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { RuleForm, RuleReviewForm } from "./forms";
import { Disclosure, EmptyState, List, ListRow, NoAccess, PageHeader, Pagination, Quote, SearchInput, Section, Segmented } from "@/components/ui";
import { ReviewBadge, SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { textLink } from "@/components/ui/styles";

type Source = { name: string; source_tier: string | null; status: string };
type RuleRow = { id: string; title: string; rule_type: string; status: string; official_url: string; evidence_excerpt: string; document_id: string; countries: { name: string }; documents: { sources: Source } };
const tabs = [["proposed", "Chờ duyệt"], ["reviewed", "Đã duyệt"], ["rejected", "Từ chối"]] as const;

export default async function Page({ searchParams }: PageProps<"/immigration/workspace">) {
  await requireAuth();
  const { client, permissions } = await accessContext();
  const manage = permissions.includes("immigration.manage"), review = permissions.includes("facts.review");
  if (!manage && !review) return <NoAccess title="Bạn chưa có quyền biên tập nhập cư" back="/immigration" backLabel="Xem trang công khai">Nhờ quản trị viên cấp immigration.manage (đề xuất) hoặc facts.review (duyệt) tại Người dùng & phân quyền.</NoAccess>;
  const params = await searchParams;
  const status = choiceParam(params, "status", tabs.map(([v]) => v), "proposed");
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  let list = client.from("immigration_rules").select("id,title,rule_type,status,official_url,evidence_excerpt,document_id,countries(name),documents!immigration_rules_document_id_fkey(sources(name,source_tier,status))", { count: "exact" }).eq("status", status);
  if (q) list = list.ilike("title", likePattern(q));
  const results = await Promise.all([
    list.order("created_at", { ascending: false }).range(from, to),
    // Only T1 documents can prove a rule; filtering here just saves a failed attempt.
    client.from("documents").select("id,title,canonical_url,sources!inner(name,source_tier)").eq("sources.source_tier", "T1").order("created_at", { ascending: false }).limit(100),
    client.from("countries").select("id,name").order("name"),
    client.from("immigration_rule_reviews").select("id,immigration_rule_id,decision,note,created_at").order("created_at", { ascending: false }).limit(20),
    ...tabs.map(([s]) => client.from("immigration_rules").select("id", { count: "exact", head: true }).eq("status", s)),
  ]);
  if (isPastLastPage(results[0].error)) redirect(withParams("/immigration/workspace", params, { page: null }));
  if (results.some((r) => r.error)) { logAccessError("immigration_workspace"); throw new Error("Không tải được dữ liệu biên tập."); }
  const rules = (results[0].data ?? []) as unknown as RuleRow[];
  const documents = (results[1].data as unknown as { id: string; title: string | null; canonical_url: string; sources: { name: string } }[])
    .map((d) => ({ id: d.id, label: `${d.title ?? d.canonical_url} · ${d.sources.name}` }));
  const countries = (results[2].data as { id: string; name: string }[]).map((c) => ({ id: c.id, label: c.name }));
  const reviews = results[3].data as { id: string; immigration_rule_id: string; decision: string; note: string; created_at: string }[];
  const tabCounts = results.slice(4).map((r) => r.count ?? 0);
  return <>
    <PageHeader eyebrow="Workspace" title="Quy định nhập cư"
      description="Chỉ nhập quy định có trên trang của cơ quan chính phủ (nguồn T1). Công chúng chỉ thấy quy định đã duyệt VÀ nguồn T1 đã được xác minh trong Source Registry."
      actions={<><Link className={`${textLink} text-[15px]`} href="/immigration">Trang công khai</Link><Link className={`${textLink} text-[15px]`} href="/facts/workspace">Nhập điều kiện</Link><Link className={`${textLink} text-[15px]`} href="/admin/sources">Xác minh nguồn</Link></>} />
    {manage && <Disclosure summary="Đề xuất quy định nhập cư"><RuleForm countries={countries} documents={documents} /></Disclosure>}
    <Section title="Danh sách">
      <Segmented label="Trạng thái" items={tabs.map(([value, label], i) => ({ href: withParams("/immigration/workspace", { q }, { status: value === "proposed" ? null : value }), label, count: tabCounts[i], active: status === value }))} />
      <form action="/immigration/workspace" className="mb-5">{status !== "proposed" && <input type="hidden" name="status" value={status} />}<SearchInput defaultValue={q} placeholder="Tìm tên quy định" /></form>
      {rules.length ? <List>{rules.map((r) => <ListRow key={r.id} title={r.title}
        badges={<><ReviewBadge status={r.status}>{entityStatuses[r.status]}</ReviewBadge><TierBadge tier={r.documents.sources.source_tier} /><SourceStatusBadge status={r.documents.sources.status}>{r.documents.sources.status === "verified" ? "Nguồn đã xác minh" : "Nguồn CHƯA xác minh — sẽ không hiển thị công khai"}</SourceStatusBadge></>}
        subtitle={`${ruleTypeLabel(r.rule_type)} · ${r.countries.name} · ${r.documents.sources.name}`}>
        <Disclosure small summary={review && r.status === "proposed" ? "Bằng chứng & duyệt" : "Bằng chứng"}>
          <div className="space-y-3"><Quote>{r.evidence_excerpt}</Quote>
            <p className="break-all text-[13px] text-ink-3">{r.official_url}</p>
            <Link className={`${textLink} text-[15px]`} href={`/documents/${r.document_id}`}>Tài liệu bằng chứng</Link>
            {review && r.status === "proposed" && <RuleReviewForm id={r.id} />}</div>
        </Disclosure>
      </ListRow>)}</List> : <EmptyState>{status === "proposed" ? "Không có quy định nào đang chờ duyệt." : "Không có mục nào trong nhóm này."}</EmptyState>}
      <Pagination summary={pageSummary(results[0].count ?? rules.length, page)} href={(p) => withParams("/immigration/workspace", params, { page: p })} />
    </Section>
    <Section>
      <Disclosure summary="20 quyết định gần nhất">
        {reviews.length ? <List>{reviews.map((r) => <ListRow key={r.id} title={r.decision}
          meta={new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16)} subtitle={r.note}>
          <p className="break-all text-[13px] text-ink-3">Quy định: {r.immigration_rule_id}</p>
        </ListRow>)}</List> : <EmptyState>Chưa có quyết định nào.</EmptyState>}
      </Disclosure>
    </Section>
  </>;
}
