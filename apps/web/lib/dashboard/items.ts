// What the workspace dashboard offers to whom. Kept out of the page so the
// permission rules are explicit and testable (AGENTS.md §16). A tile is shown
// when the user holds ANY of its `anyOf` permissions; `anyOf: []` = everyone.
export type Tint = "blue" | "green" | "orange" | "indigo" | "teal" | "purple" | "pink" | "gray" | "red" | "brown";
export type IconName = "person" | "plan" | "facts" | "education" | "immigration" | "labour" | "import" | "registry" | "sparkles"
  | "crawler" | "chart" | "access" | "globe" | "document" | "books";
export type Tile = { href: string; title: string; description: string; icon: IconName; tint: Tint; anyOf: string[] };
export type Group = { id: string; title: string; tiles: Tile[] };

export const dashboardGroups: Group[] = [
  { id: "mine", title: "Của bạn", tiles: [
    { href: "/workspace", title: "My workspace", description: "Research project, mục đã lưu và ghi chú riêng", icon: "person", tint: "blue", anyOf: [] },
    { href: "/workspace/plan", title: "My Europe Plan", description: "Vai trò, bậc học, năm, quốc gia, ngân sách", icon: "plan", tint: "indigo", anyOf: [] },
  ] },
  { id: "editing", title: "Biên tập", tiles: [
    { href: "/facts/workspace", title: "Thông tin & bằng chứng", description: "Đề xuất, duyệt và xử lý nguồn đã đổi", icon: "facts", tint: "blue", anyOf: ["facts.propose", "facts.review"] },
    { href: "/education/workspace", title: "Trường & chương trình", description: "Đề xuất và duyệt trường, chương trình", icon: "education", tint: "orange", anyOf: ["education.manage", "facts.review"] },
    { href: "/immigration/workspace", title: "Quy định nhập cư", description: "Chỉ từ nguồn T1 của cơ quan chính phủ", icon: "immigration", tint: "teal", anyOf: ["immigration.manage", "facts.review"] },
    { href: "/labour/workspace", title: "Thị trường lao động", description: "Nghề; số liệu nhập ở Thông tin & bằng chứng", icon: "labour", tint: "brown", anyOf: ["labour.manage", "facts.review"] },
    { href: "/documents/import", title: "Nhập tài liệu", description: "Thêm tài liệu từ nguồn đã đăng ký", icon: "import", tint: "green", anyOf: ["documents.ingest"] },
  ] },
  { id: "admin", title: "Quản trị", tiles: [
    { href: "/admin/sources", title: "Source Registry", description: "Thêm, xác minh nguồn và bật/tắt crawl", icon: "registry", tint: "gray", anyOf: ["sources.manage"] },
    { href: "/admin/crawler", title: "Crawler", description: "URL được crawl và kết quả từng lần chạy", icon: "crawler", tint: "teal", anyOf: ["crawler.manage"] },
    { href: "/admin/extraction", title: "Trích xuất AI", description: "Yêu cầu, lần chạy và lý do đề xuất bị loại", icon: "sparkles", tint: "purple", anyOf: ["facts.propose", "facts.review"] },
    { href: "/admin/metrics", title: "Chỉ số so sánh", description: "Định nghĩa chỉ số cho bảng so sánh quốc gia", icon: "chart", tint: "pink", anyOf: ["metrics.manage"] },
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
