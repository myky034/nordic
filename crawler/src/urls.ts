// URL rules shared by page and sitemap handling.
export function origin(url: string) {
  try { return new URL(url).origin.toLowerCase(); } catch { return null; }
}
/** Same normalisation as the web app: http(s) only, no credentials, no fragment. */
export function canonical(url: string) {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) return null;
    u.hash = "";
    return u.toString();
  } catch { return null; }
}
export function sameOrigin(a: string, b: string) {
  const x = origin(a), y = origin(b);
  return x !== null && x === y;
}
