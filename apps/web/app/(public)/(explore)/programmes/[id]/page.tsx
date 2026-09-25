import Link from "next/link";
import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
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
    <PageHeader back={<BackLink href="/programmes">All programmes</BackLink>} actions={<SaveButton kind="programme" id={programme.id} signedIn={save.signedIn} initialSaved={save.saved} />}
      eyebrow={<>{degreeLabel(programme.degree_type)} · <Link href={`/countries/${uni.countries.slug}`} className="hover:underline">{uni.countries.name}</Link></>}
      title={programme.name}
      description={<Link href={`/programmes?university=${uni.id}`} className={textLink}>{uni.name}</Link>} />
    <DescriptionList items={[
      ["Field", programme.field ?? "Not stated"],
      ["Language of instruction", programme.language ?? "Not stated"],
      ["Programme page", <ExternalLink key="p" href={programme.official_url}>{programme.official_url}</ExternalLink>],
      ["Application page", programme.application_url ? <ExternalLink key="a" href={programme.application_url}>{programme.application_url}</ExternalLink> : "Not recorded"],
    ]} />
    <Section title="Tuition, deadlines and other facts">
      {facts.length ? <div className="space-y-4">{facts.map((f) => <FactCard key={f.id} fact={f} />)}</div>
        : <EmptyState>No reviewed tuition, deadline or other facts for this programme yet. Check the official programme page above; nothing is estimated here.</EmptyState>}
    </Section>
    <Section title="Why this programme is listed">
      <Card><ExistenceEvidence excerpt={programme.evidence_excerpt} document={programme.documents} reviewedAt={programme.reviewed_at} /></Card>
    </Section>
    <p className="mt-10 px-1 text-[13px] text-ink-3">Research information, not admission or legal advice. Always confirm on the official page before applying.</p>
  </>;
}
