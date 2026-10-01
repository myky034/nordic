// =============================================================================
// Landing Page — app/(public)/page.tsx  →  route: /
// =============================================================================
//
// NOTE: No data is displayed here beyond the portal name, its modules and its
// principles. Displaying any country, university, immigration, or labour
// market data requires a source — no fabricated content is shown
// (AGENTS.md rule 1.1).
//
// A first-time visitor is asked what they want to do (study, work, permits,
// compare) and sent to the matching pages, instead of a list of module names.
// =============================================================================

import Link from "next/link";
import { AppIcon } from "@/app/(app)/dashboard/tiles";
import type { IconName, Tint } from "@/lib/dashboard/items";
import { countryName, countrySlugs } from "@/lib/registry/domain";
import { Chevron } from "@/components/ui";
import { buttonPrimary, buttonSecondary } from "@/components/ui/styles";

const goals: { title: string; text: string; icon: IconName; tint: Tint; links: [string, string][] }[] = [
  { title: "Đi du học", text: "Tìm trường và chương trình học, xem học phí và hạn nộp hồ sơ có dẫn nguồn.", icon: "education", tint: "orange",
    links: [["/universities", "Trường đại học"], ["/programmes", "Chương trình học"]] },
  { title: "Đi làm", text: "Xem nghề nghiệp và số liệu lương, nhu cầu tuyển dụng theo từng nước.", icon: "labour", tint: "brown",
    links: [["/occupations", "Nghề nghiệp"]] },
  { title: "Visa và cư trú", text: "Quy định giấy phép du học, lao động, cư trú lấy từ trang của cơ quan nhà nước.", icon: "immigration", tint: "teal",
    links: [["/immigration", "Quy định nhập cư"]] },
  { title: "So sánh quốc gia", text: "Đặt các nước cạnh nhau, mỗi con số kèm nguồn và kỳ số liệu, không chấm điểm hay xếp hạng.", icon: "chart", tint: "pink",
    links: [["/compare", "So sánh"]] },
];

const principles = [
  ["Có bằng chứng mới hiển thị", "Mỗi thông tin dẫn về tài liệu và câu trích nguyên văn mà nó được lấy ra."],
  ["Luôn ghi rõ độ mới", "Ngày lấy trang, ngày duyệt và ngày xác minh nguồn luôn được hiển thị."],
  ["Không tự suy diễn", "Nguồn không nêu thì Nordic để trống, không ước lượng hay điền thay."],
] as const;

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <section className="py-16 text-center sm:py-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Nghiên cứu du học & làm việc tại châu Âu</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-[60px]">
          Mỗi thông tin đều có nguồn.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[19px] leading-relaxed text-ink-2">
          Thông tin về học tập, làm việc và visa tại năm nước Bắc Âu và Hà Lan, mỗi điều đều dẫn về nguồn gốc để bạn tự kiểm chứng.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/countries" className={buttonPrimary}>Bắt đầu với một quốc gia</Link>
          <Link href="/search" className={buttonSecondary}>Tìm kiếm</Link>
        </div>
      </section>

      <section aria-labelledby="goals" className="pb-6">
        <h2 id="goals" className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">Bạn muốn làm gì?</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => <div key={g.title} className="flex flex-col rounded-2xl bg-surface p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-hairline">
            <div className="flex items-center gap-3"><AppIcon icon={g.icon} tint={g.tint} /><h3 className="text-[19px] font-semibold text-ink">{g.title}</h3></div>
            <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-2">{g.text}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {g.links.map(([href, label]) => <Link key={href} href={href} className="inline-flex items-center gap-1 text-[15px] font-medium text-accent hover:underline underline-offset-4">{label}<Chevron className="text-accent" /></Link>)}
            </div>
          </div>)}
        </div>
      </section>

      <section aria-labelledby="countries" className="py-10">
        <h2 id="countries" className="mb-4 px-1 text-[22px] font-semibold tracking-[-0.015em]">Năm quốc gia</h2>
        <div className="flex flex-wrap gap-2">
          {countrySlugs.map((slug) => <Link key={slug} href={`/countries/${slug}`} className="rounded-full bg-surface px-4 py-2 text-[15px] font-medium text-ink ring-1 ring-hairline transition hover:bg-fill">{countryName(slug, slug)}</Link>)}
        </div>
      </section>

      <section aria-labelledby="principles" className="py-12">
        <h2 id="principles" className="sr-only">Nguyên tắc</h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {principles.map(([title, text]) => <div key={title}>
            <p className="text-[17px] font-semibold text-ink">{title}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{text}</p>
          </div>)}
        </div>
      </section>
    </main>
  );
}
