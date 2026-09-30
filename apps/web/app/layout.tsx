import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { NavigationProgress } from "@/components/navigation-progress";

// No web-font download: the system font stack in globals.css renders SF Pro on
// Apple devices and the native UI font elsewhere (see docs/learning/ui-design-system.md).
export const metadata: Metadata = {
  title: { default: "Nordic — Europe Study & Career Intelligence", template: "%s · Nordic" },
  description:
    "Research European countries, universities, and career paths with evidence-backed information.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The interface is Vietnamese (PROJECT_SPEC.md 21, 2026-09-29); screen readers use this.
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {/* useSearchParams needs a Suspense boundary so it does not opt the whole app out of static rendering. */}
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        {children}
      </body>
    </html>
  );
}
