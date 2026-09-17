export const tiers = { T1: "Government / authority", T2: "Institutional / university", T3: "Professional / secondary", T4: "Experience / community" } as const;
export type Tier = keyof typeof tiers;
export const countrySlugs = ["sweden", "denmark", "finland", "norway", "netherlands"] as const;
export const sourceStatuses = ["needs_verification", "verified", "review_required"] as const;

type Query = Record<string, string | string[] | undefined>;
export function registryFilters(query: Query) {
  const single = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const country = single("country");
  const tier = single("tier");
  const status = single("status");
  return {
    country: countrySlugs.some((slug) => slug === country) || country === "unassigned" ? country : "",
    tier: Object.hasOwn(tiers, tier) || tier === "unknown" ? tier : "",
    status: sourceStatuses.some((value) => value === status) ? status : "",
  };
}

// Conservative normalization: preserve path case, trailing slash and query order
// because removing these may merge distinct resources. This is not crawl approval.
export function canonicalSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export function tierLabel(tier: string | null) {
  return tier && Object.hasOwn(tiers, tier) ? `${tier} · ${tiers[tier as Tier]}` : "Unclassified";
}

export function verificationLabel(status: string, verifiedAt: Date | null) {
  if (status === "review_required") return "Review required";
  if (status !== "verified" || !verifiedAt) return "Needs verification";
  // A historical review date does not establish current validity of source content.
  return "Registry metadata reviewed; content validity unknown";
}

export function dateLabel(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "Not available";
}
