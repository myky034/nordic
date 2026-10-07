import { defaultLocale, type Locale } from "@/lib/i18n/locales";

// What the workspace dashboard offers to whom. Kept out of the page so the
// permission rules are explicit and testable (AGENTS.md §16). A tile is shown
// when the user holds ANY of its `anyOf` permissions; `anyOf: []` = everyone.
export type Tint = "blue" | "green" | "orange" | "indigo" | "teal" | "purple" | "pink" | "gray" | "red" | "brown";
export type IconName = "person" | "plan" | "facts" | "education" | "immigration" | "labour" | "import" | "registry" | "sparkles"
  | "crawler" | "chart" | "access" | "globe" | "document" | "books" | "gauge";
export type Tile = { href: string; title: string; description: string; icon: IconName; tint: Tint; anyOf: string[] };
export type Group = { id: string; title: string; tiles: Tile[] };

export const dashboardGroups: Group[] = [
  { id: "mine", title: "Của bạn", tiles: [
    { href: "/workspace", title: "Không gian của tôi", description: "Dự án nghiên cứu, mục đã lưu và ghi chú riêng", icon: "person", tint: "blue", anyOf: [] },
    { href: "/workspace/plan", title: "Kế hoạch châu Âu", description: "Vai trò, bậc học, năm, quốc gia, ngân sách", icon: "plan", tint: "indigo", anyOf: [] },
  ] },
  { id: "editing", title: "Biên tập", tiles: [
    { href: "/facts/workspace", title: "Thông tin & bằng chứng", description: "Đề xuất, duyệt và xử lý nguồn đã đổi", icon: "facts", tint: "blue", anyOf: ["facts.propose", "facts.review"] },
    { href: "/education/workspace", title: "Trường & chương trình", description: "Đề xuất và duyệt trường, chương trình", icon: "education", tint: "orange", anyOf: ["education.manage", "facts.review"] },
    { href: "/immigration/workspace", title: "Quy định nhập cư", description: "Chỉ từ nguồn T1 của cơ quan chính phủ", icon: "immigration", tint: "teal", anyOf: ["immigration.manage", "facts.review"] },
    { href: "/labour/workspace", title: "Thị trường lao động", description: "Nghề; số liệu nhập ở Thông tin & bằng chứng", icon: "labour", tint: "brown", anyOf: ["labour.manage", "facts.review"] },
    { href: "/documents/import", title: "Nhập tài liệu", description: "Thêm tài liệu từ nguồn đã đăng ký", icon: "import", tint: "green", anyOf: ["documents.ingest"] },
  ] },
  { id: "admin", title: "Quản trị", tiles: [
    { href: "/admin", title: "Bảng điều khiển quản trị", description: "Crawler và AI, độ phủ dữ liệu, hoạt động duyệt", icon: "gauge", tint: "indigo", anyOf: ["roles.manage"] },
    { href: "/admin/sources", title: "Quản lý nguồn", description: "Thêm, phân loại, xác minh nguồn và bật/tắt crawl", icon: "registry", tint: "gray", anyOf: ["sources.manage"] },
    { href: "/admin/crawler", title: "Crawler", description: "URL được crawl và kết quả từng lần chạy", icon: "crawler", tint: "teal", anyOf: ["crawler.manage"] },
    { href: "/admin/extraction", title: "Trích xuất AI", description: "Yêu cầu, lần chạy và lý do đề xuất bị loại", icon: "sparkles", tint: "purple", anyOf: ["facts.propose", "facts.review"] },
    { href: "/admin/metrics", title: "Chỉ số so sánh", description: "Định nghĩa chỉ số cho bảng so sánh quốc gia", icon: "chart", tint: "pink", anyOf: ["metrics.manage"] },
    { href: "/admin/taxonomy", title: "Ngành & hướng nghề", description: "Danh mục ngành ISCED-F và hướng nghề của Nordic", icon: "books", tint: "indigo", anyOf: ["taxonomy.manage"] },
    { href: "/admin/access", title: "Người dùng & phân quyền", description: "Vai trò, quyền và nhật ký thay đổi", icon: "access", tint: "red", anyOf: ["roles.manage", "users.assign_roles"] },
  ] },
  { id: "explore", title: "Khám phá", tiles: [
    { href: "/countries", title: "Quốc gia", description: "Hồ sơ năm quốc gia và so sánh", icon: "globe", tint: "blue", anyOf: [] },
    { href: "/documents", title: "Tài liệu", description: "Trang nguồn đã ghi nhận và các phiên bản", icon: "document", tint: "gray", anyOf: [] },
    { href: "/sources", title: "Nguồn", description: "Danh sách nguồn, tier và trạng thái xác minh", icon: "books", tint: "brown", anyOf: [] },
  ] },
];

/** Groups with only the tiles this user may open; empty groups are dropped. */
export function visibleGroups(permissions: string[], groups: Group[] = dashboardGroups): Group[] {
  const allowed = (t: Tile) => t.anyOf.length === 0 || t.anyOf.some((p) => permissions.includes(p));
  return groups.map((g) => ({ ...g, tiles: g.tiles.filter(allowed) })).filter((g) => g.tiles.length > 0);
}

// "Needs attention" counters. Each is counted only for users who can act on
// it; counts come from RLS-scoped queries, so nothing leaks to others.
export type CounterId = "proposed" | "sourceChanged" | "extractionPending" | "sourcesUnverified";
export type Counter = { id: CounterId; label: string; href: string; anyOf: string[] };
export const counters: Counter[] = [
  { id: "proposed", label: "Đề xuất chờ duyệt", href: "/facts/workspace", anyOf: ["facts.review"] },
  { id: "sourceChanged", label: "Nguồn đã đổi", href: "/facts/workspace?status=source_changed", anyOf: ["facts.review"] },
  { id: "extractionPending", label: "Yêu cầu AI đang chờ", href: "/admin/extraction", anyOf: ["facts.propose", "facts.review"] },
  { id: "sourcesUnverified", label: "Nguồn cần xác minh", href: "/admin/sources", anyOf: ["sources.manage"] },
];
export function visibleCounters(permissions: string[]) {
  return counters.filter((c) => c.anyOf.some((p) => permissions.includes(p)));
}

// English wording of the groups, tiles (by href) and counters; the Vietnamese
// text stays in the lists above, which also hold the permission rules.
const groupTitlesEn: Record<string, string> = { mine: "Yours", editing: "Editing", admin: "Admin", explore: "Explore" };
const tileTextEn: Record<string, { title: string; description: string }> = {
  "/workspace": { title: "My workspace", description: "Research projects, saved items and private notes" },
  "/workspace/plan": { title: "My Europe plan", description: "Role, degree, year, countries, budget" },
  "/facts/workspace": { title: "Facts & evidence", description: "Propose, review and handle changed sources" },
  "/education/workspace": { title: "Universities & programmes", description: "Propose and review universities and programmes" },
  "/immigration/workspace": { title: "Immigration rules", description: "Only from T1 government sources" },
  "/labour/workspace": { title: "Labour market", description: "Occupations; figures are entered under Facts & evidence" },
  "/documents/import": { title: "Import a document", description: "Add a document from a registered source" },
  "/admin": { title: "Admin overview", description: "Crawler and AI, data coverage, review activity" },
  "/admin/sources": { title: "Manage sources", description: "Add, classify and verify sources; turn crawling on or off" },
  "/admin/crawler": { title: "Crawler", description: "Crawled URLs and the result of each run" },
  "/admin/extraction": { title: "AI extraction", description: "Requests, runs and why proposals were rejected" },
  "/admin/metrics": { title: "Comparison metrics", description: "Metric definitions for the country comparison" },
  "/admin/taxonomy": { title: "Fields & career paths", description: "ISCED-F fields of study and Nordic career paths" },
  "/admin/access": { title: "Users & permissions", description: "Roles, permissions and the change log" },
  "/countries": { title: "Countries", description: "Profiles of the five countries and comparison" },
  "/documents": { title: "Documents", description: "Recorded source pages and their versions" },
  "/sources": { title: "Sources", description: "Sources, their tier and verification status" },
};
const counterLabelsEn: Record<CounterId, string> = {
  proposed: "Proposals awaiting review", sourceChanged: "Changed sources", extractionPending: "AI requests waiting", sourcesUnverified: "Sources to verify",
};
/** Groups with their titles and tiles in the viewer's language. */
export function localizeGroups(groups: Group[], locale: Locale = defaultLocale): Group[] {
  if (locale === "vi") return groups;
  return groups.map((g) => ({ ...g, title: groupTitlesEn[g.id] ?? g.title, tiles: g.tiles.map((t) => ({ ...t, ...(tileTextEn[t.href] ?? {}) })) }));
}
export function counterLabel(counter: Counter, locale: Locale = defaultLocale) {
  return locale === "en" ? counterLabelsEn[counter.id] : counter.label;
}
