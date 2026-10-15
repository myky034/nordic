import { LoadingState } from "@/components/ui/loading";
import { getDictionary } from "@/lib/i18n/server";

export default async function Loading() {
  return <LoadingState label={(await getDictionary()).common.loading} />;
}
