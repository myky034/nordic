// Public layout — wraps unauthenticated pages (landing, etc.).
// No auth check here — these routes are intentionally public.
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
