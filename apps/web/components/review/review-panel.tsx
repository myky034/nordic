"use client";
import { useActionState } from "react";
import { Field, FormMessage } from "@/components/ui";
import { buttonDestructive, buttonPrimary, control } from "@/components/ui/styles";

type ReviewState = { error?: string; message?: string };

/**
 * One review decision, shared by every workspace (facts, education,
 * immigration, labour).
 *
 * WHY two buttons instead of a <select>: the old select defaulted to
 * "reviewed", so typing a note and pressing save approved the record without
 * an explicit choice (AGENTS.md 1.3: a person must decide). Each button
 * submits its own `decision` value; React 19 includes the pressed button's
 * name/value in the FormData passed to the action, so no client state is
 * needed and the server action still validates the value.
 *
 * `checks` is the short list of what to compare against the original page,
 * shown right above the decision so a first-time reviewer knows what
 * "reviewed" means here.
 */
export function ReviewPanel({ action, hidden, checks, approveLabel, rejectLabel }: {
  action: (state: ReviewState, form: FormData) => Promise<ReviewState>;
  hidden: Record<string, string>;
  checks: string[];
  approveLabel?: string;
  rejectLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="space-y-4 rounded-2xl bg-fill/50 p-4 sm:p-5">
    {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
    <ReviewFields checks={checks} pending={pending} state={state} approveLabel={approveLabel} rejectLabel={rejectLabel} />
  </form>;
}

/** The visible part, without the action hook, so /dev/preview can render an inert copy. */
export function ReviewFields({ checks, pending = false, state = {}, approveLabel = "Duyệt", rejectLabel = "Từ chối" }: {
  checks: string[]; pending?: boolean; state?: ReviewState; approveLabel?: string; rejectLabel?: string;
}) {
  return <>
    <div>
      <p className="text-[15px] font-semibold text-ink">Quyết định của bạn</p>
      <p className="mt-0.5 text-[13px] text-ink-2">Mở trang gốc và kiểm tra trước khi duyệt:</p>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => <li key={c} className="flex gap-2.5 text-[15px] leading-snug text-ink-2">
          <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />{c}
        </li>)}
      </ul>
    </div>
    <Field label="Ghi chú kiểm tra" hint="Bắt buộc, được lưu vào lịch sử. Ví dụ: “Khớp nguyên văn trang gốc ngày 30/09.” hoặc lý do từ chối.">
      <textarea name="note" required maxLength={1000} rows={2} className={control} />
    </Field>
    <FormMessage error={state.error} message={state.message} />
    <div className="flex flex-wrap items-center gap-3">
      <button type="submit" name="decision" value="reviewed" disabled={pending} className={buttonPrimary}>{approveLabel}</button>
      <button type="submit" name="decision" value="rejected" disabled={pending} className={buttonDestructive}>{rejectLabel}</button>
      {pending && <span role="status" className="text-[13px] text-ink-3">Đang lưu…</span>}
    </div>
  </>;
}
