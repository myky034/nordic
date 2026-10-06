import { vi } from "vitest";

// Pages read the interface language from a cookie (lib/i18n/server.ts), which
// only exists inside a real request. Tests get Vietnamese by default and can
// switch with setTestLocale("en") from test/i18n.ts. lib/i18n/i18n.test.tsx
// unmocks this to test the real cookie handling.
vi.mock("@/lib/i18n/server", async () => {
  const { dictionaries } = await import("@/lib/i18n/dictionaries");
  const { testLocale } = await import("./i18n");
  return {
    getLocale: async () => testLocale(),
    getDictionary: async () => dictionaries[testLocale()],
  };
});
