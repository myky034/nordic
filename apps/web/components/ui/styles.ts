// Shared class names for form controls and buttons. Plain strings (no JSX) so
// both Server and Client Components can import them.
export const control =
  "mt-1.5 block w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-50";
export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
export const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-fill px-5 py-2.5 text-[15px] font-medium text-ink transition hover:bg-fill-strong active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";
export const buttonSmall =
  "inline-flex items-center justify-center rounded-full bg-fill px-3.5 py-1.5 text-sm font-medium text-ink transition hover:bg-fill-strong disabled:opacity-40";
export const textLink = "text-accent underline-offset-4 hover:underline";
export const label = "block text-[13px] font-medium text-ink-2";
