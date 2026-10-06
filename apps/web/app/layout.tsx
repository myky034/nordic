import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { NavigationProgress } from "@/components/navigation-progress";
import { getDictionary, getLocale } from "@/lib/i18n/server";

// No web-font download: the system font stack in globals.css renders SF Pro on
// Apple devices and the native UI font elsewhere (see docs/learning/ui-design-system.md).
// Title and description follow the viewer's language (lib/i18n).
export async function generateMetadata(): Promise<Metadata> {
  const t = (await getDictionary()).meta;
  return { title: { default: t.title, template: "%s · Nordic" }, description: t.description };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    // The interface language chosen with the header switch (Vietnamese by
    // default, PROJECT_SPEC.md 21, 2026-10-06); screen readers use this.
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* useSearchParams needs a Suspense boundary so it does not opt the whole app out of static rendering. */}
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        {children}
      </body>
    </html>
  );
}
