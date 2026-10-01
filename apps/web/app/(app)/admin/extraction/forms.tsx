"use client";
import { useActionState } from "react";
import { setExtractionAccount } from "./actions";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";

export function AccountForm({ current }: { current: string | null }) {
  const [s, action, pending] = useActionState(setExtractionAccount, {});
  return <form action={action} className="space-y-4">
    <p className="text-[15px] leading-relaxed text-ink-2">Mọi đề xuất do AI tạo sẽ đứng tên tài khoản này. Tài khoản phải có quyền Đề xuất thông tin (facts.propose) và <b>không</b> có quyền Duyệt đề xuất (facts.review), để AI không bao giờ tự duyệt đề xuất của chính mình.</p>
    <Field label="Mã tài khoản AI (UUID)" hint="Xem mã ở khung chi tiết người dùng trong trang Người dùng & phân quyền.">
      <input name="user" required defaultValue={current ?? ""} maxLength={36} className={`${control} font-mono`} />
    </Field>
    <FormMessage error={s.error} message={s.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu"}</button>
  </form>;
}
