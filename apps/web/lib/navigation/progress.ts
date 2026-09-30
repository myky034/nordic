// Which clicks start a page navigation, for the top progress bar
// (components/navigation-progress.tsx). Pure so it can be tested without a DOM.

export type ClickInfo = {
  href: string | null;          // the anchor's resolved href
  target: string | null;        // the anchor's target attribute
  download: boolean;            // has a download attribute
  button: number;               // MouseEvent.button
  modified: boolean;            // meta / ctrl / shift / alt held (opens a new tab or window)
};

/**
 * True when the click will navigate this tab to another page of this site:
 * left button, no modifier, same origin, no new tab or download, and a
 * different path or query (a pure #hash jump does not load anything).
 */
export function startsNavigation(click: ClickInfo, current: string): boolean {
  if (!click.href || click.button !== 0 || click.modified || click.download) return false;
  if (click.target && click.target !== "_self") return false;
  let to: URL, from: URL;
  try { to = new URL(click.href, current); from = new URL(current); } catch { return false; }
  if (to.origin !== from.origin || !/^https?:$/.test(to.protocol)) return false;
  return to.pathname !== from.pathname || to.search !== from.search;
}
