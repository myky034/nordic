// Skeleton for list pages: shapes of a title and a grouped list, so the layout
// does not jump when data arrives.
export function LoadingState({ label }: { label: string }) {
  return <div role="status" aria-live="polite" className="animate-pulse">
    <span className="sr-only">{label}</span>
    <div className="h-4 w-28 rounded-full bg-fill" />
    <div className="mt-4 h-9 w-72 max-w-full rounded-full bg-fill" />
    <div className="mt-4 h-4 w-96 max-w-full rounded-full bg-fill" />
    <div className="mt-10 overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
      {[0, 1, 2, 3].map((i) => <div key={i} className="border-t border-hairline px-5 py-5 first:border-t-0">
        <div className="h-4 w-1/3 rounded-full bg-fill" /><div className="mt-2.5 h-3 w-1/2 rounded-full bg-fill" />
      </div>)}
    </div>
  </div>;
}
