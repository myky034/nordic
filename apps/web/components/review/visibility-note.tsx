import Link from "next/link";
import { Notice } from "@/components/ui";
import { textLink } from "@/components/ui/styles";
import { blockerLabels, needsSourceVerification, type Blocker, type Visibility } from "@/lib/review/visibility";

/**
 * Tells a reviewer whether a record is visible to signed-out visitors, and if
 * not, why and what to do. Before this, a reviewed immigration rule whose
 * source was still unverified simply never appeared publicly, with no
 * explanation — it looked like a bug.
 */
export function VisibilityNote({ visibility, publicHref }: { visibility: Visibility | null; publicHref?: string }) {
  if (!visibility) return null;
  switch (visibility.state) {
    case "public":
      return <p className="flex items-center gap-2 text-[13px] text-ink-2">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-positive" />Đang hiển thị công khai
        {publicHref && <Link href={publicHref} className={textLink}>Xem</Link>}
      </p>;
    case "will_be_public":
      return <p className="text-[13px] text-ink-3">Sau khi duyệt, mục này sẽ hiển thị công khai.</p>;
    case "unknown":
      return <p className="text-[13px] text-ink-3">Không kiểm tra được trạng thái công khai lúc này. Hãy tải lại trang.</p>;
    case "hidden":
      return <Reasons title="Đã duyệt nhưng chưa hiển thị công khai" blockers={visibility.blockers} />;
    case "will_stay_hidden":
      return <Reasons title="Lưu ý: kể cả khi duyệt, mục này vẫn chưa hiển thị công khai" blockers={visibility.blockers} />;
  }
}

function Reasons({ title, blockers }: { title: string; blockers: Blocker[] }) {
  return <Notice tone="caution" title={title}>
    {blockers.length
      ? <ul className="list-disc space-y-1 pl-5">{blockers.map((b) => <li key={b}>{blockerLabels[b]}</li>)}</ul>
      : <p>Không xác định được lý do từ dữ liệu trên trang này. Hãy kiểm tra nguồn và mục được gắn với nó.</p>}
    {needsSourceVerification(blockers) && <p className="mt-2"><Link href="/admin/sources" className={textLink}>Xác minh nguồn trong Source Registry</Link></p>}
  </Notice>;
}
