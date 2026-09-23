"use client";
// Shared loading / error states for route segments (error boundaries must be
// Client Components).
export function ErrorState({ title, text, reset }: { title: string; text: string; reset: () => void }) {
  return <div className="py-20 text-center">
    <h1 className="text-[28px] font-semibold tracking-tight text-ink">{title}</h1>
    <p className="mx-auto mt-2 max-w-md text-[17px] text-ink-2">{text}</p>
    <button onClick={reset} className="mt-8 rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-accent-hover">Try again</button>
  </div>;
}
