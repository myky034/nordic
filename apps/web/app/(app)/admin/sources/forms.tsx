"use client";
import { useActionState } from "react";
import { saveSource } from "./actions";
import { tiers, tierGuidance, sourceStatuses, sourceStatusLabels, crawlPolicies, crawlPolicyLabels, type Tier } from "@/lib/registry/domain";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";
type SourceRow = {
  id: string; name: string; canonicalUrl: string; countryId: string | null; sourceTier: string | null;
  sourceType: string | null; topics: string[]; language: string | null; authorityNotes: string | null;
  status: string; crawlPolicy: string; crawlEnabled: boolean; crawlFrequency: string | null; notes: string | null;
};

/** One titled group of fields, like a section in Apple's Settings. */
function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="rounded-2xl bg-surface p-5 ring-1 ring-hairline sm:p-6">
    <h3 className="text-[17px] font-semibold text-ink">{title}</h3>
    {description && <p className="mt-1 text-[13px] leading-snug text-ink-2">{description}</p>}
    <div className="mt-4 grid gap-5 sm:grid-cols-2">{children}</div>
  </section>;
}

// Used for a new source and for editing, in the right pane of /admin/sources.
// Fields are grouped by the question they answer (what is it / who publishes
// it and is that checked / may we crawl it), and the save bar is sticky at the
// bottom of the pane so it never needs a scroll to reach.
export function SourceForm({ source, countries }: { source?: SourceRow; countries: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(saveSource, {});
  return <form action={action}>
    <input type="hidden" name="id" value={source?.id ?? ""} />
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
      <Group title="Thông tin nguồn">
        <Field label="Tên nguồn"><input className={control} name="name" required maxLength={200} defaultValue={source?.name} /></Field>
        <Field label="URL gốc (canonical)" hint="Trang chủ của nguồn. Tài liệu nhập sau phải cùng tên miền."><input className={control} name="canonicalUrl" type="url" required maxLength={2048} defaultValue={source?.canonicalUrl} placeholder="https://" /></Field>
        <Field label="Quốc gia"><select className={control} name="countryId" defaultValue={source?.countryId ?? ""}><option value="">Chưa gán</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Loại nguồn"><input className={control} name="sourceType" maxLength={100} defaultValue={source?.sourceType ?? ""} placeholder="government, university, community…" /></Field>
        <Field label="Ngôn ngữ"><input className={control} name="language" maxLength={20} defaultValue={source?.language ?? ""} placeholder="en, sv, da…" /></Field>
        <Field label="Chủ đề" hint="Phân tách bằng dấu phẩy."><input className={control} name="topics" defaultValue={source?.topics.join(", ") ?? ""} placeholder="immigration, education, labour_market" /></Field>
      </Group>

      <Group title="Phân loại và xác minh" description="Tier cho biết ai xuất bản nguồn, không chứng minh mọi câu trên trang đều đúng. Chưa chắc thì để “Chưa phân loại” và “Chưa xác minh”.">
        <Field label="Tier" hint={<span className="block space-y-0.5">{(Object.keys(tierGuidance) as Tier[]).map((t) => <span key={t} className="block"><b className="font-medium text-ink-2">{t}:</b> {tierGuidance[t]}</span>)}</span>}>
          <select className={control} name="sourceTier" defaultValue={source?.sourceTier ?? ""}><option value="">Chưa phân loại</option>{Object.entries(tiers).map(([t, l]) => <option key={t} value={t}>{t} · {l}</option>)}</select>
        </Field>
        <Field label="Trạng thái xác minh" hint="“Đã xác minh” cần căn cứ bên dưới. Quy định nhập cư và số liệu lao động chỉ công khai khi nguồn đã xác minh.">
          <select className={control} name="status" defaultValue={source?.status ?? "needs_verification"}>{sourceStatuses.map((s) => <option key={s} value={s}>{sourceStatusLabels[s]}</option>)}</select>
        </Field>
        <Field className="sm:col-span-2" label="Căn cứ xác minh (authority notes)" hint="Bắt buộc khi đã xác minh. Ghi ai vận hành trang và bạn kiểm tra ở đâu, ngày nào.">
          <textarea className={control} name="authorityNotes" maxLength={2000} rows={3} defaultValue={source?.authorityNotes ?? ""}
            placeholder="Ví dụ: Trang About ghi do [tổ chức] vận hành; [tổ chức] được liệt kê trên [trang chính phủ]. Kiểm tra ngày …" />
        </Field>
        {/* Only this box (or first switching to verified) stamps a new "last verified" date. */}
        {source?.status === "verified" && <label className="flex items-start gap-3 text-[15px] sm:col-span-2"><input type="checkbox" name="reverify" className="mt-1 h-4 w-4 accent-accent" /><span>Tôi vừa xác minh lại nguồn này hôm nay <span className="block text-[13px] text-ink-3">Cập nhật ngày xác minh. Bắt buộc khi đổi URL hoặc tier.</span></span></label>}
      </Group>

      <Group title="Crawl" description="Chỉ bật khi chính sách là “Được phép crawl” và nguồn đã xác minh. Các URL cụ thể được đăng ký ở trang Crawler.">
        <Field label="Chính sách crawl"><select className={control} name="crawlPolicy" defaultValue={source?.crawlPolicy ?? "not_reviewed"}>{crawlPolicies.map((p) => <option key={p} value={p}>{crawlPolicyLabels[p]}</option>)}</select></Field>
        <Field label="Tần suất"><input className={control} name="crawlFrequency" maxLength={50} defaultValue={source?.crawlFrequency ?? ""} placeholder="weekly, monthly…" /></Field>
        <label className="flex items-center gap-3 text-[15px] sm:col-span-2"><input type="checkbox" name="crawlEnabled" defaultChecked={source?.crawlEnabled} className="h-4 w-4 accent-accent" /> Bật crawl</label>
      </Group>

      <Group title="Ghi chú nội bộ">
        <Field className="sm:col-span-2" label="Ghi chú" hint="Chỉ người quản lý nguồn thấy."><textarea className={control} name="notes" maxLength={2000} rows={2} defaultValue={source?.notes ?? ""} /></Field>
      </Group>
    </fieldset>
    <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap items-center gap-3 border-t border-hairline bg-canvas px-1 py-3">
      <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : source ? "Lưu thay đổi" : "Tạo nguồn"}</button>
      <div className="min-w-0 flex-1"><FormMessage error={state.error} message={state.message} /></div>
    </div>
  </form>;
}
