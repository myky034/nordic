import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { countryName } from "@/lib/registry/domain";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { uuidPattern } from "@/lib/documents/domain";
import { FactCard, factSelect, type FactRow } from "@/lib/facts/view";
import { degreeLabel } from "@/lib/education/domain";
import { ExistenceEvidence, programmeDetailSelect, type ProgrammeDetailRow } from "@/lib/education/view";
import { BackLink, Card, DescriptionList, EmptyState, ExternalLink, PageHeader, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";

export default async function ProgrammePage({ params }: PageProps<"/programmes/[id]">) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const client = await createClient();
  const [programmeResult, factsResult] = await Promise.all([
    client.from("programmes").select(programmeDetailSelect).eq("id", id)
      .eq("status", "reviewed").eq("universities.status", "reviewed").maybeSingle(),
    // Tuition, deadline, duration etc. are facts (Option A), so they carry
    // their own evidence, review status and conflict flag.
    client.from("facts").select(factSelect).eq("programme_id", id).in("status", ["reviewed", "conflicted"])
      .order("topic", { ascending: true }).order("created_at", { ascending: false }).limit(100),
  ]);
  if (programmeResult.error || factsResult.error) { logAccessError("public_programme"); throw new Error("Không tải được chương trình."); }
  if (!programmeResult.data) notFound();
  const programme = programmeResult.data as unknown as ProgrammeDetailRow;
  const facts = factsResult.data as unknown as FactRow[];
  const uni = programme.universities;
  const save = await savedState("programme", programme.id);
  return <>
    <PageHeader back={<BackLink href="/programmes">Tất cả chương trình</BackLink>} actions={<SaveButton kind="programme" id={programme.id} signedIn={save.signedIn} initialSaved={save.saved} />}
      eyebrow={<>{degreeLabel(programme.degree_type)} · <Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{countryName(uni.countries.slug, uni.countries.name)}</Link></>}
      title={programme.name}
      description={<Link href={`/programmes?university=${uni.id}`} className={textLink}>{uni.name}</Link>} />
    <DescriptionList items={[
      ["Ngành", programme.field ?? "Nguồn không nêu"],
      ["Ngôn ngữ giảng dạy", programme.language ?? "Nguồn không nêu"],
      ["Trang chương trình", <ExternalLink key="p" href={programme.official_url}>{programme.official_url}</ExternalLink>],
      ["Trang nộp hồ sơ", programme.application_url ? <ExternalLink key="a" href={programme.application_url}>{programme.application_url}</ExternalLink> : "Chưa ghi nhận"],
    ]} />
    <Section title="Học phí, hạn nộp và thông tin khác">
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState>Chưa có học phí, hạn nộp hay thông tin nào khác của chương trình này được duyệt. Hãy xem trang chính thức ở trên; ở đây không có gì được ước lượng.</EmptyState>}
    </Section>
    <Section title="Vì sao chương trình này có trong danh sách">
      <Card><ExistenceEvidence excerpt={programme.evidence_excerpt} document={programme.documents} reviewedAt={programme.reviewed_at} /></Card>
    </Section>
    <p className="mt-10 px-1 text-[13px] text-ink-3">Thông tin nghiên cứu, không phải tư vấn tuyển sinh hay pháp lý. Luôn kiểm tra lại trên trang chính thức trước khi nộp hồ sơ.</p>
  </>;
}
