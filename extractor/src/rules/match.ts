import type { Rule, RuleScope } from "./types";

// PR 2b (review §5.4): which rules apply to a page, and how specific each is.
// Page TYPES are named by the site configuration from the URL (a page kind,
// such as "a programme's intake page"); a URL never names an intake.

/** A page kind of one site, recognised by an anchored pattern over the URL. */
export type PageTypeDef = { source: string; type: string; url: RegExp };

export type PageContext = { url: string; source: string; country: string | null; pageType: string | null };

/** The origin of the page ("https://www.su.se") and its page type, if a site definition names one. */
export function pageContext(url: string, country: string | null, pageTypes: readonly PageTypeDef[]): PageContext {
  const source = new URL(url).origin;
  const hits = pageTypes.filter((d) => d.source === source && d.url.test(url)).map((d) => d.type);
  // Two definitions naming different types for one URL would make the choice arbitrary.
  const types = [...new Set(hits)];
  return { url, source, country, pageType: types.length === 1 ? types[0] : null };
}

/** page > pageType > source > country > global (review §5.4). */
export function specificity(scope: RuleScope) {
  if (scope.page) return 4;
  if (scope.pageType !== undefined) return 3;
  if (scope.source !== undefined) return 2;
  if (scope.country !== undefined) return 1;
  return 0;
}

export function scopeMatches(scope: RuleScope, page: PageContext) {
  if (scope.country !== undefined && scope.country !== page.country) return false;
  if (scope.source !== undefined && scope.source !== page.source) return false;
  if (scope.pageType !== undefined && scope.pageType !== page.pageType) return false;
  if (scope.page && !scope.page.test(page.url)) return false;
  return true;
}

/**
 * Enabled rules whose scope fits the page, minus those an applicable rule
 * overrides. A rule that is itself overridden cannot override others: the
 * override must come from a rule that will actually run.
 */
export function applicableRules(rules: readonly Rule[], page: PageContext): Rule[] {
  const fitting = rules.filter((r) => r.enabled && scopeMatches(r.scope, page));
  const overridden = new Set(fitting.flatMap((r) => r.overrides ?? []));
  return fitting.filter((r) => !overridden.has(r.id));
}
