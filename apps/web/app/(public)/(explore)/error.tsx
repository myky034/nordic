"use client";
import { ErrorState } from "@/components/ui/states";
export default function RegistryError({ reset }: { reset: () => void }) {
  return <ErrorState title="Không tải được dữ liệu" text="Hệ thống chưa lấy được thông tin lúc này. Bạn thử lại sau ít phút nhé." reset={reset} />;
}
