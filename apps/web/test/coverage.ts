import type { PublicCoverage } from "@/lib/coverage/queries";

let current: PublicCoverage | null = null;
/** Public coverage seen by pages under test; null = unknown (the pre-2026-10-13 behaviour). Reset in afterEach. */
export const setTestCoverage = (coverage: PublicCoverage | null) => { current = coverage; };
export const testCoverage = () => current;
