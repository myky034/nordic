import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { compareHref } from "@/lib/compare/domain";
import { Card, List, ListRow, Notice, PageHeader, Section, BackLink } from "@/components/ui";
import { PlanForm } from "../forms";

export default async function PlanPage() {
  await requireAuth();
  const client = await createClient();
  const [planResult, planCountries, countriesResult] = await Promise.all([
    client.from("user_plans").select("current_position,education,target_role,target_degree,target_year,language_goals,application_status,budget_amount,budget_currency,budget_period").maybeSingle(),
    client.from("user_plan_countries").select("country_id,countries(slug,name)"),
    client.from("countries").select("id,name,slug").order("name"),
  ]);
  if (planResult.error || planCountries.error || countriesResult.error) throw new Error("Không tải được My Europe Plan.");
  const plan = planResult.data;
  const chosen = (planCountries.data ?? []) as unknown as { country_id: string; countries: { slug: string; name: string } }[];
  const countries = countriesResult.data as { id: string; name: string; slug: string }[];
  // Shortcuts are plain links built from the user's own answers. They filter
  // public lists; they do not rank, score or recommend anything.
  const shortcuts: [string, string, string][] = [];
  if (chosen.length >= 2) shortcuts.push([compareHref(chosen.map((c) => c.countries.slug)), "So sánh các nước bạn quan tâm", chosen.map((c) => c.countries.name).join(", ")]);
  for (const c of chosen) {
    shortcuts.push([`/programmes?country=${c.countries.slug}${plan?.target_degree ? `&degree=${plan.target_degree}` : ""}`, `Chương trình${plan?.target_degree ? ` ${plan.target_degree}` : ""} tại ${c.countries.name}`, "Danh sách chương trình đã duyệt, lọc theo lựa chọn của bạn"]);
    shortcuts.push([`/immigration?country=${c.countries.slug}`, `Quy định nhập cư tại ${c.countries.name}`, "Chỉ quy định có nguồn chính thức đã xác minh"]);
  }
  if (plan?.target_role) shortcuts.push([`/occupations?q=${encodeURIComponent(plan.target_role)}`, `Nghề: ${plan.target_role}`, "Tìm nghề theo vai trò mong muốn"]);
  return <>
    <PageHeader back={<BackLink href="/workspace">My workspace</BackLink>} eyebrow="Workspace" title="My Europe Plan"
      description="Hồ sơ mục tiêu của bạn. Chỉ bạn xem được; bạn có thể sửa hoặc xóa bất kỳ lúc nào." />
    <Section title="Lối tắt theo hồ sơ của bạn">
      <div className="mb-4"><Notice tone="neutral">Đây là các liên kết lọc sẵn theo câu trả lời của bạn — <strong>không phải khuyến nghị</strong>, không xếp hạng và không dự đoán khả năng trúng tuyển.</Notice></div>
      {shortcuts.length ? <List>{shortcuts.map(([href, title, sub]) => <ListRow key={href} href={href} title={title} subtitle={sub} />)}</List>
        : <p className="px-1 text-[15px] text-ink-2">Chọn quốc gia quan tâm, bậc học hoặc vai trò mong muốn bên dưới để có lối tắt.</p>}
    </Section>
    <Section title="Hồ sơ mục tiêu">
      <Card><PlanForm plan={plan} countries={countries.map((c) => ({ id: c.id, label: c.name }))} selected={chosen.map((c) => c.country_id)} /></Card>
    </Section>
    <p className="mt-8 px-1 text-[13px] text-ink-3">Muốn xóa toàn bộ dữ liệu cá nhân? Xem mục “Dữ liệu của bạn” ở <Link href="/workspace" className="text-accent hover:underline">My workspace</Link>.</p>
  </>;
}
