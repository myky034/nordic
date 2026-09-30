// Which item the review split view shows (components/review/split-view.tsx).
//
// The requested id comes from the URL (?fact=…). If it is not on the current
// page — typically because it was just reviewed and left the "Chờ duyệt"
// list — the first remaining item is shown, which is how the queue advances
// to the next proposal after a decision without any client code.
export function selectItem(ids: readonly string[], requested: string | undefined) {
  const found = requested ? ids.indexOf(requested) : -1;
  const index = found >= 0 ? found : ids.length ? 0 : -1;
  return {
    index,
    id: index >= 0 ? ids[index] : null,
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
  };
}
