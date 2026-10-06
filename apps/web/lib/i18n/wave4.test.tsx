import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
const { user, perms, text, requests } = vi.hoisted(() => ({ user: vi.fn(), perms: vi.fn(), text: vi.fn(), requests: vi.fn() }));
vi.mock("server-only", () => ({}));
// Server actions are never called while rendering; stubs keep their imports out.
vi.mock("@/app/(app)/admin/access/actions", () => ({ saveRole: async () => ({}), assignRole: async () => ({}) }));
vi.mock("@/app/(app)/admin/sources/actions", () => ({ saveSource: async () => ({}) }));
vi.mock("@/app/(app)/admin/crawler/actions", () => ({ saveCrawlTarget: async () => ({}) }));
vi.mock("@/app/(app)/admin/metrics/actions", () => ({ saveMetric: async () => ({}) }));
vi.mock("@/app/(app)/admin/extraction/actions", () => ({ setExtractionAccount: async () => ({}) }));
vi.mock("@/app/(app)/documents/import/actions", () => ({ importDocument: async () => ({}) }));
vi.mock("@/app/(public)/(explore)/documents/[id]/extraction-actions", () => ({ requestExtraction: async () => ({}), cancelExtraction: async () => ({}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: user },
    rpc: perms,
    from: (table: string) => table === "document_texts"
      ? { select: () => ({ eq: () => ({ maybeSingle: text }) }) }
      : { select: () => ({ eq: () => ({ order: () => ({ limit: requests }) }) }) },
  }),
}));
import { setTestLocale } from "@/test/i18n";
import { auditActionLabel, localizedPermissionGroups, permissionLabel, permissionName } from "@/lib/rbac/labels";
import { effectivePermissions } from "@/lib/rbac/effective";
import { crawlOutcome, crawlReadiness, crawlRunStatus } from "@/lib/crawler/domain";
import { confidenceLabel, itemOutcome, reasonLabel, requestStatus } from "@/lib/extraction/domain";
import { triggerLabel } from "@/lib/runs";
import { activity, coverage, crawlerState, decisionNamesFor } from "@/lib/admin/overview";
import { CoverageView, CrawlerView, ActivityView } from "@/app/(app)/admin/views";
import { RoleForm, UserRoles } from "@/app/(app)/admin/access/forms";
import { SourceForm } from "@/app/(app)/admin/sources/forms";
import { TargetForm } from "@/app/(app)/admin/crawler/forms";
import { MetricForm } from "@/app/(app)/admin/metrics/forms";
import { AccountForm } from "@/app/(app)/admin/extraction/forms";
import { ImportForm } from "@/app/(app)/documents/import/form";
import { ExtractionPanel } from "@/app/(public)/(explore)/documents/[id]/extraction-panel";

// Wave 4 (editor and admin areas): labels follow the chosen language, and an
// English page carries no Vietnamese interface words.
const vietnamese = /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựđĐ]/;
afterEach(() => setTestLocale("vi"));

describe("admin labels", () => {
  it("name permissions, groups and audit actions in both languages", () => {
    expect(permissionName("facts.review", "en")).toBe("Review proposals (facts.review)");
    expect(permissionName("facts.review")).toBe("Duyệt đề xuất (facts.review)");
    expect(permissionLabel("something.new", "en")).toBe("something.new");
    expect(localizedPermissionGroups("en").map((g) => g.title)).toContain("Administration");
    expect(auditActionLabel("role.granted", "en")).toBe("Role granted");
    expect(auditActionLabel("constructor", "en")).toBe("constructor");
    const roles = [{ id: "r", name: "Editor", role_permissions: [{ permission_key: "facts.propose" }, { permission_key: "x.new" }] }];
    expect(effectivePermissions(roles, ["r"], "en").groups.map((g) => g.title)).toEqual(["Facts and review", "Other"]);
  });
  it("explain crawler and extraction states; unknown values never look healthy", () => {
    expect(crawlReadiness({ crawl_enabled: false, crawl_policy: "approved", status: "verified" }, "en").reason).toBe("Not fetched yet: crawling not enabled");
    expect(crawlOutcome("robots_disallowed", "en").label).toBe("Blocked by robots.txt");
    expect(crawlOutcome("brand_new", "en")).toEqual({ label: "brand_new", tone: "neutral" });
    expect(crawlRunStatus("brand_new", "en").tone).toBe("critical");
    expect(requestStatus("toString", "en").label).toBe("Error");
    expect(itemOutcome("invalid", "en").label).toBe("Rejected by checks");
    expect(triggerLabel("schedule", "en")).toBe("Scheduled");
    expect(decisionNamesFor("en").revalidated).toBe("Still matches new source");
  });
  it("keep the recorded English AI reason as is in English, and explain it in Vietnamese", () => {
    const reason = "Excerpt not found verbatim in the document text";
    expect(reasonLabel(reason, "en")).toBe(reason);
    expect(reasonLabel(reason)).toContain("nguyên văn");
    expect(confidenceLabel("0.85", "en")).toBe("model self-assessed 85%");
  });
});

describe("admin and editor screens in English", () => {
  it("render the overview views", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const crawler = renderToStaticMarkup(<CrawlerView locale="en" activeTargets={1200} complete={false}
      state={crawlerState({ status: "partial", started_at: "2026-09-30T12:00:00Z" }, [{ last_outcome: "error" }], now)} />);
    expect(crawler).toContain("Last run");
    expect(crawler).toContain("Partly failed");
    expect(crawler).toContain("1,200");
    expect(crawler).toContain("Not fully counted");
    const cov = coverage([{ id: "a", slug: "sweden", name: "Sweden" }], { sources: [], facts: [{ country_id: "a", status: "reviewed" }], universities: [], programmes: [], rules: [], occupations: [] });
    const coverageHtml = renderToStaticMarkup(<CoverageView {...cov} complete locale="en" />);
    expect(coverageHtml).toContain("Sweden");
    expect(coverageHtml).toContain("Verified sources");
    const act = renderToStaticMarkup(<ActivityView locale="en" days={7} complete daily={[]} rows={activity({ facts: [], education: [], immigration: [], labour: [] }, "en")}
      pending={[{ table: "facts", label: "Facts", href: "/facts/workspace", count: 0, oldestDays: 3 }]} />);
    expect(act).toContain("Universities &amp; programmes");
    expect(act).toContain("3 days");
    for (const html of [crawler, coverageHtml, act]) expect(html.match(new RegExp(`.{0,60}${vietnamese.source}.{0,30}`))?.[0]).toBeUndefined();
  });
  it("render every admin and import form", () => {
    const role = { id: "r1", name: "Editor", description: "", role_permissions: [{ permission_key: "documents.ingest" }] };
    const forms = [
      <RoleForm key="role" locale="en" permissions={[{ key: "documents.ingest", description: "" }, { key: "roles.manage", description: "" }]} own={["documents.ingest"]} />,
      <UserRoles key="user" locale="en" user="u" roles={[role]} current={["r1"]} own={["documents.ingest"]} self={false} />,
      <SourceForm key="source" locale="en" countries={[]} />,
      <TargetForm key="target" locale="en" sources={[]} />,
      <MetricForm key="metric" locale="en" />,
      <AccountForm key="account" locale="en" current={null} />,
      <ImportForm key="import" locale="en" sources={[{ id: "s", name: "Synthetic", url: "https://example.com/", blocked: true }]} />,
    ];
    const html = forms.map((f) => renderToStaticMarkup(f));
    expect(html[0]).toContain("Create role");
    expect(html[0]).toContain("Import documents");
    expect(html[1]).toContain("1 permission");
    expect(html[2]).toContain("Government authority");
    expect(html[3]).toContain("Register URL");
    expect(html[4]).toContain("Create metric");
    expect(html[5]).toContain("AI account ID");
    expect(html[6]).toContain("(blocked)");
    for (const h of html) expect(h).not.toMatch(vietnamese);
  });
  it("show the AI extraction panel of a document in the viewer's language", async () => {
    setTestLocale("en");
    user.mockResolvedValue({ data: { user: { id: "u" } } });
    perms.mockResolvedValue({ data: [{ key: "facts.propose" }], error: null });
    text.mockResolvedValue({ data: { document_id: "d1" }, error: null });
    requests.mockResolvedValue({ data: [{ id: "q1", status: "pending", note: null, created_at: "2026-09-28T08:00:00Z", finished_at: null, truncated: true }], error: null });
    const html = renderToStaticMarkup((await ExtractionPanel({ documentId: "d1" }))!);
    expect(html).toContain("AI extraction");
    expect(html).toContain("A request is already waiting.");
    expect(html).toContain("Waiting for the next run");
    expect(html).toContain("Text truncated");
    expect(html).not.toMatch(vietnamese);
  });
});
