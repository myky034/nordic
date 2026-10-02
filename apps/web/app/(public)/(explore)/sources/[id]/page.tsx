import { SaveButton } from "@/components/save-button";
import { savedState } from "@/lib/workspace/saved";
import { notFound } from "next/navigation";
import { getSource } from "@/lib/registry/queries";
import { verificationLabel } from "@/lib/registry/domain";
import { BackLink, PageHeader } from "@/components/ui";
import { SourceStatusBadge, TierBadge } from "@/components/ui/badges";
import { viewerPermissions } from "@/lib/rbac/viewer";
import { seesInternalDetails } from "@/lib/rbac/ui";
import { SourceDetails } from "../source-details";

// The shareable page of one source (links from facts, search, saved items).
// /sources itself opens the same details in a slide-over Inspector.
export default async function SourcePage({ params }: PageProps<"/sources/[id]">) {
  const { id } = await params;
  const source = await getSource(id);
  if (!source) notFound();
  const save = await savedState("source", source.id);
  // Crawl, AI and review-state labels are for editors only (lib/rbac/ui.ts).
  const internal = seesInternalDetails(await viewerPermissions());
  return <>
    <PageHeader back={<BackLink href="/sources">Tất cả nguồn</BackLink>} actions={<SaveButton kind="source" id={source.id} signedIn={save.signedIn} initialSaved={save.saved} />} eyebrow="Nguồn" title={source.name}
      description={<div className="flex flex-wrap gap-2 pt-1"><TierBadge tier={source.sourceTier} /><SourceStatusBadge status={source.status}>{verificationLabel(source.status, source.lastVerifiedAt)}</SourceStatusBadge></div>} />
    <SourceDetails source={source} internal={internal} />
  </>;
}
