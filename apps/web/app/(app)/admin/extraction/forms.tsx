"use client";
import { useActionState } from "react";
import { setExtractionAccount } from "./actions";
import { Field, FormMessage } from "@/components/ui";
import { buttonPrimary, control } from "@/components/ui/styles";

export function AccountForm({ current }: { current: string | null }) {
  const [s, action, pending] = useActionState(setExtractionAccount, {});
  return <form action={action} className="space-y-4">
    <Field label="UUID tài khoản AI" hint="Tài khoản phải có facts.propose và không có facts.review, để AI không bao giờ tự duyệt đề xuất của mình.">
      <input name="user" required defaultValue={current ?? ""} maxLength={36} className={`${control} font-mono`} />
    </Field>
    <FormMessage error={s.error} message={s.message} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang lưu…" : "Lưu"}</button>
  </form>;
}
