// DEMO fixtures for /dev/preview/patterns only. Every name says DEMO and every
// URL uses the reserved example.test domain (AGENTS.md 1.1: nothing invented
// is ever written to the database or shown outside dev).

const tiers = ["T1", "T2", "T3", "T4", null] as const;
const statuses = ["verified", "needs_verification", "review_required"] as const;
const countries = ["Sweden", "Denmark", "Finland", "Norway", "Netherlands", null] as const;

export type DemoSource = {
  id: string; name: string; url: string; tier: string | null; status: string; country: string | null;
  verifiedAt: string | null; crawl: boolean; documents: number;
};

export const patternSources: DemoSource[] = Array.from({ length: 14 }, (_, i) => {
  const status = statuses[i % 3];
  return {
    id: `ps${i + 1}`,
    name: `DEMO Source ${String(i + 1).padStart(2, "0")}`,
    url: `https://s${i + 1}.demo.example.test/`,
    tier: tiers[i % 5],
    status,
    country: countries[i % 6],
    verifiedAt: status === "verified" ? `2026-0${1 + (i % 9)}-15` : null,
    crawl: status === "verified" && i % 2 === 0,
    documents: (i * 7) % 23,
  };
});

export const patternUniversities = Array.from({ length: 9 }, (_, i) => ({
  id: `pu${i + 1}`,
  name: `DEMO University ${String.fromCharCode(65 + i)}`,
  country: ["Sweden", "Denmark", "Finland"][i % 3],
  programmes: (i * 5) % 17,
  degrees: [["Cử nhân", "Thạc sĩ"], ["Thạc sĩ"], ["Cử nhân", "Thạc sĩ", "Tiến sĩ"]][i % 3],
  language: ["Tiếng Anh", "Tiếng Anh · Tiếng Thụy Điển", "Tiếng Anh"][i % 3],
  source: i % 4 === 3 ? "T2" : "T1",
}));

export const patternLog = Array.from({ length: 8 }, (_, i) => ({
  id: `pl${i + 1}`,
  title: [`DEMO permit — processing time`, `DEMO University ${String.fromCharCode(65 + i)}`, `DEMO occupation — median pay`][i % 3],
  decision: ["reviewed", "rejected", "conflicted", "revalidated"][i % 4],
  note: ["DEMO: khớp nguyên văn trang gốc.", "DEMO: trích đoạn không có trên trang.", "DEMO: hai nguồn nêu hai mức khác nhau.", "DEMO: vẫn khớp phiên bản mới."][i % 4],
  at: `2026-01-${String(20 - i).padStart(2, "0")}T0${i}:30:00Z`,
}));
