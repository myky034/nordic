import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logAccessError } from "@/lib/rbac/access";
import { requestStatus } from "@/lib/extraction/domain";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { Badge, List, ListRow, Section } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { CancelExtractionForm, RequestExtractionForm } from "./extraction-forms";

type Request = { id: string; status: string; note: string | null; created_at: string; finished_at: string | null; truncated: boolean };
const when = (v: string | null) => (v ? new Date(v).toISOString().replace("T", " ").slice(0, 16) : "");

// Slice 10a: shown only to editors who can propose, and only for documents
// with stored crawler text (the only text ever sent to a model).
export async function ExtractionPanel({ documentId }: { documentId: string }) {
  const client = await createClient();
  const { data: user } = await client.auth.getUser();
  if (!user.user) return null;
  const perms = await client.rpc("my_permissions");
  if (perms.error) { logAccessError("extraction_panel_permissions"); return null; }
  if (!(perms.data as { key: string }[]).some((p) => p.key === "facts.propose")) return null;
  const [text, requests] = await Promise.all([
    client.from("document_texts").select("document_id").eq("document_id", documentId).maybeSingle(),
    client.from("extraction_requests").select("id,status,note,created_at,finished_at,truncated").eq("document_id", documentId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (text.error || requests.error) { logAccessError("extraction_panel"); return null; }
  if (!text.data) return null;
  const rows = requests.data as Request[];
  const [locale, dict] = [await getLocale(), await getDictionary()];
  const t = dict.documentEditor;
  const open = rows.find((r) => r.status === "pending" || r.status === "running");
  return <Section title={t.aiTitle} description={t.aiDescription}>
    <div className="mb-4 flex flex-wrap items-center gap-4">
      {open ? <p className="text-[15px] text-ink-2">{t.openRequest(open.status === "running")}</p> : <RequestExtractionForm document={documentId} locale={locale} />}
      <Link href="/facts/workspace" className={`${textLink} text-[15px]`}>{t.reviewQueue}</Link>
      <Link href="/admin/extraction" className={`${textLink} text-[15px]`}>{t.extractionLog}</Link>
    </div>
    {rows.length > 0 && <List>{rows.map((r) => {
      const st = requestStatus(r.status, locale);
      return <ListRow key={r.id} title={t.request(when(r.created_at))} badges={<><Badge tone={st.tone}>{st.label}</Badge>{r.truncated && <Badge tone="caution">{t.truncated}</Badge>}</>}
        subtitle={r.note ?? undefined} meta={r.finished_at ? t.finished(when(r.finished_at)) : undefined}>
        {r.status === "pending" && <CancelExtractionForm document={documentId} request={r.id} locale={locale} />}
      </ListRow>;
    })}</List>}
  </Section>;
}
