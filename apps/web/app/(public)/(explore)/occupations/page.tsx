import Form from "next/form";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { likePattern } from "@/lib/education/domain";
import { classificationLabel } from "@/lib/labour/domain";
import { countryName } from "@/lib/registry/domain";
import { occupationListSelect, type OccupationListRow } from "@/lib/labour/view";
import { isPastLastPage, pageParam, pageSummary, pageWindow, searchParam, withParams } from "@/lib/pagination";
import { Badge, EmptyState, List, ListRow, Notice, PageHeader, Pagination, SearchInput } from "@/components/ui";
import { buttonPrimary } from "@/components/ui/styles";

export default async function OccupationsPage({ searchParams }: PageProps<"/occupations">) {
  const params = await searchParams;
  const q = searchParam(params);
  const page = pageParam(params);
  const { from, to } = pageWindow(page);
  const client = await createClient();
  // Explicit "reviewed" filter so editors (who see drafts via RLS) get the public view.
  let query = client.from("occupations").select(occupationListSelect, { count: "exact" }).eq("status", "reviewed");
  if (q) query = query.ilike("name", likePattern(q));
  const { data, error, count } = await query.order("name", { ascending: true }).range(from, to);
  if (isPastLastPage(error)) redirect(withParams("/occupations", params, { page: null }));
  if (error) { logAccessError("public_occupations"); throw new Error("Không tải được danh sách nghề."); }
  const occupations = (data ?? []) as unknown as OccupationListRow[];
  return <>
    <PageHeader eyebrow="Làm việc & Visa" title="Nghề nghiệp"
      description="Các nghề đã được đối chiếu định nghĩa với nguồn. Lương, nhu cầu tuyển dụng và số liệu khác chỉ hiện ở từng nghề khi có bằng chứng, quốc gia và kỳ số liệu." />
    <div className="-mt-4 mb-8"><Notice tone="neutral">Số liệu mô tả một kỳ đã qua. Đây là thông tin nghiên cứu, không phải dự báo, mức lương được đề nghị hay lời khuyên nghề nghiệp.</Notice></div>
    <Form action="/occupations" className="mb-6 flex gap-3">
      <div className="flex-1"><SearchInput defaultValue={q} placeholder="Tên nghề" /></div>
      <button className={buttonPrimary}>Tìm</button>
    </Form>
    {occupations.length
      ? <List label="Nghề nghiệp">{occupations.map((o) => <ListRow key={o.id} href={`/occupations/${o.id}`} title={o.name}
          badges={o.classification_code ? <Badge>{classificationLabel(o.classification_system, o.classification_code)}</Badge> : undefined}
          subtitle={o.countries ? `Định nghĩa cho ${countryName(o.countries.slug, o.countries.name)}` : "Định nghĩa quốc tế"} />)}</List>
      : <EmptyState>{q ? `Chưa có nghề đã duyệt nào khớp “${q}”.` : "Chưa có nghề nào được duyệt. Nghề được biên tập viên nhập từ tài liệu nguồn; không có nghề nào được tự tạo."}</EmptyState>}
    <Pagination summary={pageSummary(count ?? occupations.length, page)} href={(p) => withParams("/occupations", params, { page: p })} />
  </>;
}
