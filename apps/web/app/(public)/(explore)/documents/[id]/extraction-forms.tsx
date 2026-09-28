"use client";
import { useActionState } from "react";
import { cancelExtraction, requestExtraction } from "./extraction-actions";
import { FormMessage } from "@/components/ui";
import { buttonPrimary, buttonSmall } from "@/components/ui/styles";

export function RequestExtractionForm({ document }: { document: string }) {
  const [s, action, pending] = useActionState(requestExtraction, {});
  return <form action={action} className="space-y-3">
    <input type="hidden" name="document" value={document} />
    <button disabled={pending} className={buttonPrimary}>{pending ? "Đang gửi…" : "Yêu cầu trích xuất bằng AI"}</button>
    <FormMessage error={s.error} message={s.message} />
  </form>;
}
export function CancelExtractionForm({ document, request }: { document: string; request: string }) {
  const [s, action, pending] = useActionState(cancelExtraction, {});
  return <form action={action} className="space-y-2">
    <input type="hidden" name="document" value={document} /><input type="hidden" name="request" value={request} />
    <button disabled={pending} className={buttonSmall}>{pending ? "Đang hủy…" : "Hủy yêu cầu"}</button>
    <FormMessage error={s.error} message={s.message} />
  </form>;
}
