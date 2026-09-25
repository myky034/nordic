"use client";
import { useActionState } from "react";
import { saveCrawlTarget } from "./actions";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";

type Target = { id: string; source_id: string; url: string; kind: string; path_prefix: string | null; max_urls: number; content_selector: string | null; active: boolean };
export function TargetForm({ sources, target }: { sources: { id: string; label: string }[]; target?: Target }) {
  const [s, action, pending] = useActionState(saveCrawlTarget, {});
  return <form action={action} className="space-y-5">
    {target && <><input type="hidden" name="id" value={target.id} /><input type="hidden" name="source" value={target.source_id} /></>}
    {!target && <Field label="Nguồn"><select name="source" required className={control}><option value="">Chọn nguồn</option>{sources.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>}
    <Field label="URL" hint="Phải cùng domain với nguồn. Chỉ URL này được lấy (không tự đi theo link)."><input name="url" type="url" required maxLength={2048} defaultValue={target?.url} className={control} /></Field>
    <div className="grid gap-5 sm:grid-cols-3">
      <Field label="Loại"><select name="kind" defaultValue={target?.kind ?? "page"} className={control}><option value="page">Trang</option><option value="sitemap">Sitemap</option></select></Field>
      <Field label="Tiền tố đường dẫn (sitemap)" hint="Ví dụ /en/you-want-to-apply/"><input name="prefix" maxLength={200} defaultValue={target?.path_prefix ?? ""} className={control} /></Field>
      <Field label="Số URL tối đa (sitemap)"><input name="maxUrls" type="number" min={1} max={100} defaultValue={target?.max_urls ?? 20} className={control} /></Field>
    </div>
    <Field label="CSS selector nội dung chính (tùy chọn)" hint="Ví dụ main. Để trống: main, article hoặc body. Thử trước bằng: npm run probe -w @nordic/crawler -- <url> <selector>">
      <input name="selector" maxLength={200} defaultValue={target?.content_selector ?? ""} className={control} />
    </Field>
    <label className="flex items-center gap-3 text-[15px]"><input type="checkbox" name="active" defaultChecked={target?.active ?? true} className="h-4 w-4 accent-[var(--accent)]" /> Đang dùng</label>
    <FormMessage error={s.error} message={s.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : target ? "Lưu thay đổi" : "Đăng ký URL"}</button>
  </form>;
}
