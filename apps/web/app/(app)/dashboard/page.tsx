// =============================================================================
// Dashboard Page — app/(app)/dashboard/page.tsx  →  route: /dashboard
// =============================================================================
//
// This is the landing page for authenticated users. In Slice 1 it only
// confirms the user is signed in. Domain content is added in later slices.
//
// WHY both requireAuth() and getCurrentUser() here?
//   - requireAuth() (backed by getClaims) ensures we bail out fast if the
//     token is somehow invalid — it does not make a network call.
//   - getCurrentUser() makes a network call to get the actual user record
//     with email, metadata, etc. We call it here because we want to DISPLAY
//     the user's email — an appropriate reason for the extra round-trip.
//   The layout already called requireAuth(), but we call it again here per
//   the Next.js recommendation to check auth close to the data that needs it.
// =============================================================================

import { requireAuth } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { accessContext } from "@/lib/rbac/access";
import { List, ListRow, PageHeader, Section } from "@/components/ui";

export default async function DashboardPage() {
  // Verify identity via JWT claims — fast, no network call.
  await requireAuth();

  // Fetch the user record to display their email.
  const user = await getCurrentUser();
  const { permissions } = await accessContext();
  const has = (...keys: string[]) => keys.some((k) => permissions.includes(k));

  // Grouped like a settings screen: editing tools, administration, exploring.
  // Each entry is shown only when the user holds the matching capability.
  const editing = [
    has("facts.propose", "facts.review") && ["/facts/workspace", "Thông tin & bằng chứng", "Đề xuất và duyệt thông tin có trích đoạn nguồn"],
    has("education.manage", "facts.review") && ["/education/workspace", "Trường & chương trình", "Đề xuất và duyệt trường, chương trình"],
    has("immigration.manage", "facts.review") && ["/immigration/workspace", "Quy định nhập cư", "Chỉ từ nguồn T1 của cơ quan chính phủ"],
    has("documents.ingest") && ["/documents/import", "Nhập tài liệu", "Thêm tài liệu từ nguồn đã đăng ký"],
  ].filter(Boolean) as [string, string, string][];
  const admin = [
    has("sources.manage") && ["/admin/sources", "Quản lý Source Registry", "Thêm, sửa, xác minh nguồn và bật/tắt crawl"],
    has("roles.manage", "users.assign_roles") && ["/admin/access", "Người dùng & phân quyền", "Vai trò, quyền và nhật ký thay đổi"],
  ].filter(Boolean) as [string, string, string][];

  return (
    <>
      <PageHeader eyebrow="Workspace" title="Dashboard"
        description={<>Signed in as <span className="font-medium text-ink">{user?.email ?? "unknown"}</span></>} />
      {editing.length > 0 && <Section title="Biên tập">
        <List>{editing.map(([href, title, text]) => <ListRow key={href} href={href} title={title} subtitle={text} />)}</List>
      </Section>}
      {admin.length > 0 && <Section title="Quản trị">
        <List>{admin.map(([href, title, text]) => <ListRow key={href} href={href} title={title} subtitle={text} />)}</List>
      </Section>}
      <Section title="Explore">
        <List>
          <ListRow href="/countries" title="Explore countries" />
          <ListRow href="/documents" title="Browse documents" />
          <ListRow href="/sources" title="Browse source registry" />
        </List>
      </Section>
    </>
  );
}
