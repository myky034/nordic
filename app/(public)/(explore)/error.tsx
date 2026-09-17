"use client";
export default function RegistryError({ reset }: { reset: () => void }) {
  return <section className="py-12"><h1 className="text-2xl font-semibold">Registry unavailable</h1><p className="mt-3 text-zinc-500">We couldn’t load the data. Please try again later.</p><button onClick={reset} className="mt-6 rounded-full border px-5 py-2">Try again</button></section>;
}
