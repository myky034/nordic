"use client";
import { ErrorState } from "@/components/ui/states";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <ErrorState title="Không tải được thông tin" text="Hãy kiểm tra kết nối và thử lại." reset={reset} />;
}
