// Global navigation structure. Kept out of the component so it is testable
// and so adding a module means editing one list (AGENTS.md §16).
//
// Apple-style information architecture: a handful of top-level entries, with
// related destinations grouped under one label instead of nine equal tabs
// that no longer fit the bar.
export type NavLink = { href: string; label: string; description: string };
export type NavEntry = { id: string; label: string; href?: string; links?: NavLink[] };

export const navigation: NavEntry[] = [
  { id: "countries", label: "Quốc gia", href: "/countries" },
  { id: "study", label: "Du học", links: [
    { href: "/universities", label: "Trường đại học", description: "Các trường đã được đối chiếu với nguồn" },
    { href: "/programmes", label: "Chương trình học", description: "Bậc học, ngôn ngữ, học phí và hạn nộp" },
  ] },
  { id: "work", label: "Làm việc & Visa", links: [
    { href: "/immigration", label: "Quy định nhập cư", description: "Giấy phép du học, lao động và cư trú" },
    { href: "/occupations", label: "Nghề nghiệp", description: "Nghề và số liệu thị trường lao động" },
  ] },
  { id: "compare", label: "So sánh", href: "/compare" },
  { id: "evidence", label: "Bằng chứng", links: [
    { href: "/facts", label: "Thông tin", description: "Mọi thông tin đã công khai, kèm trích đoạn" },
    { href: "/sources", label: "Nguồn", description: "Danh sách nguồn, mức độ và xác minh" },
    { href: "/documents", label: "Tài liệu", description: "Các trang nguồn đã lưu và phiên bản" },
  ] },
];

export function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}
/** An entry is active when its own page or any page in its group is open. */
export function entryActive(path: string, entry: NavEntry) {
  return entry.href ? isActive(path, entry.href) : (entry.links ?? []).some((l) => isActive(path, l.href));
}
