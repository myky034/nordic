import { SiteFooter, SiteHeader } from "@/components/site-header";

// Public layout — wraps the landing page and every explore page with the
// shared navigation. No auth check here — these routes are intentionally public.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <>
    <SiteHeader />
    <div className="flex-1">{children}</div>
    <SiteFooter />
  </>;
}
