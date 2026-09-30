"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keyboard shortcuts for the pattern demos: each key navigates to a URL
 * (state lives in the URL, as on the real pages). Ignored while typing in a
 * field, so shortcuts never steal text input.
 */
export function KeyNav({ keys }: { keys: Record<string, string | null> }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)))) return;
      const href = keys[e.key] ?? keys[e.key.toLowerCase()];
      if (href) { e.preventDefault(); router.push(href, { scroll: false }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, router]);
  return null;
}
