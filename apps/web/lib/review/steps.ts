import { defaultLocale, type Locale } from "@/lib/i18n/locales";
// The order a reviewer works in, shown at the top of every review workspace.
//
// WHY an explicit order: public visibility depends on earlier steps (an
// immigration rule needs a verified T1 source; a requirement or salary figure
// needs its rule/occupation reviewed first — see lib/review/visibility.ts).
// That order used to live only in the heads of the people who built the
// system. It is defined here, not in a component (AGENTS.md 16).

export type StepPage = "sources" | "education" | "immigration" | "labour" | "facts";
export type CountId = "sourcesUnverified" | "education" | "immigration" | "labour" | "facts";

export type Step = {
  number: 1 | 2 | 3;
  title: string;
  description: string;
  /** Destinations inside the step; `count` names the pending-work counter. */
  links: { page: StepPage; label: string; href: string; count: CountId; permission: string }[];
};

export const reviewSteps: Step[] = [
  {
    number: 1, title: "Xác minh nguồn",
    description: "Cần trước khi quy định nhập cư và số liệu lao động được công khai.",
    links: [{ page: "sources", label: "Nguồn chưa xác minh", href: "/admin/sources", count: "sourcesUnverified", permission: "sources.manage" }],
  },
  {
    number: 2, title: "Duyệt mục gốc",
    description: "Trường, chương trình, quy định, nghề: chứng minh mục đó tồn tại theo nguồn.",
    links: [
      { page: "education", label: "Trường & chương trình", href: "/education/workspace", count: "education", permission: "facts.review" },
      { page: "immigration", label: "Quy định nhập cư", href: "/immigration/workspace", count: "immigration", permission: "facts.review" },
      { page: "labour", label: "Nghề", href: "/labour/workspace", count: "labour", permission: "facts.review" },
    ],
  },
  {
    number: 3, title: "Duyệt thông tin chi tiết",
    description: "Học phí, hạn nộp, điều kiện visa, số liệu lương… gắn với mục ở bước 2.",
    links: [{ page: "facts", label: "Thông tin chờ duyệt", href: "/facts/workspace", count: "facts", permission: "facts.review" }],
  },
];

const stepTextEn: Record<number, { title: string; description: string }> = {
  1: { title: "Verify sources", description: "Needed before immigration rules and labour figures can be public." },
  2: { title: "Review base items", description: "Universities, programmes, rules, occupations: show from a source that the item exists." },
  3: { title: "Review details", description: "Tuition, deadlines, visa requirements, salary figures… linked to the items in step 2." },
};
const linkLabelsEn: Record<StepPage, string> = {
  sources: "Unverified sources", education: "Universities & programmes", immigration: "Immigration rules", labour: "Occupations", facts: "Facts awaiting review",
};
/** The steps in the viewer's language; order, links and permissions are unchanged. */
export function localizedSteps(locale: Locale = defaultLocale): Step[] {
  if (locale === "vi") return reviewSteps;
  return reviewSteps.map((s) => ({ ...s, ...stepTextEn[s.number], links: s.links.map((l) => ({ ...l, label: linkLabelsEn[l.page] })) }));
}

/**
 * A link the user cannot open is shown as text with a hint, not hidden: the
 * step still has to happen, someone else just has to do it.
 */
export function stepLinks(step: Step, permissions: readonly string[]) {
  return step.links.map((l) => ({ ...l, allowed: permissions.includes(l.permission) }));
}
