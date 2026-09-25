"use client";
import Link from "next/link";
import { useActionState } from "react";
import { toggleSaved, type SaveState } from "@/app/(app)/workspace/actions";
import type { ItemKind } from "@/lib/workspace/domain";

// Bookmark toggle on public detail pages. Guests get a sign-in link instead:
// bookmarks are private workspace data and need an account.
export function SaveButton({ kind, id, signedIn, initialSaved }: { kind: ItemKind; id: string; signedIn: boolean; initialSaved: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(toggleSaved, { saved: initialSaved });
  if (!signedIn) return <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full bg-fill px-4 py-2 text-[14px] font-medium text-ink transition hover:bg-fill-strong">☆ Đăng nhập để lưu</Link>;
  const saved = state.saved ?? initialSaved;
  return <form action={action} className="inline-flex flex-col items-end gap-1">
    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={id} />
    <button disabled={pending} aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium transition disabled:opacity-60 ${saved ? "bg-accent text-white hover:bg-accent-hover" : "bg-fill text-ink hover:bg-fill-strong"}`}>
      {saved ? "★ Đã lưu" : "☆ Lưu"}
    </button>
    {state.error && <span role="alert" className="text-[12px] text-critical">{state.error}</span>}
  </form>;
}
