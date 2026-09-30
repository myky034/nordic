"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { startsNavigation } from "@/lib/navigation/progress";

/**
 * A thin progress bar along the top edge of the window while a page is
 * loading, like Safari's. One indicator for the whole app, instead of a
 * spinner next to each link.
 *
 * How it knows: Next.js has no global "navigation pending" event, so the bar
 * starts on a same-site link click (captured before <Link> handles it) or a
 * GET form submit, remembering the URL it started from. While the URL is
 * still that one, it is loading; once the URL changes, it has arrived and the
 * bar fades out. The state is derived during render (no setState in an
 * effect). The bar grows only after 150 ms, so fast navigations do not flash,
 * and it gives up after 15 s so it can never stay stuck.
 */
export function NavigationProgress() {
  const url = `${usePathname()}?${useSearchParams().toString()}`;
  const [started, setStarted] = useState<{ from: string; n: number } | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const urlRef = useRef(url);
  useEffect(() => { urlRef.current = url; }, [url]);

  useEffect(() => {
    const start = () => {
      setStarted((s) => ({ from: urlRef.current, n: (s?.n ?? 0) + 1 }));
      clearTimeout(safety.current);
      safety.current = setTimeout(() => setStarted(null), 15000);
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      if (startsNavigation({ href: a.href, target: a.getAttribute("target"), download: a.hasAttribute("download"), button: e.button,
        modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey }, window.location.href)) start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement;
      // GET forms (search, filters) navigate; POST forms are Server Actions with their own pending state.
      if (f.method.toLowerCase() === "get" && !e.defaultPrevented) start();
    };
    // Capture phase: <Link> calls preventDefault() in its own handler, so listen before it.
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit);
    return () => { document.removeEventListener("click", onClick, true); document.removeEventListener("submit", onSubmit); clearTimeout(safety.current); };
  }, []);

  if (!started) return null;
  const loading = started.from === url;
  return <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-60 h-0.75">
    {/* A new key per navigation restarts the grow animation from zero. */}
    <div key={started.n} className={`h-full bg-accent shadow-[0_0_8px_var(--color-accent)] ${
      loading ? "animate-[nav-progress_8s_ease-out_150ms_both]" : "w-full opacity-0 transition-opacity duration-300 ease-out"}`} />
  </div>;
}
