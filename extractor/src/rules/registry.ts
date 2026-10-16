import type { Rule } from "./types";
import type { VersionLock } from "./fingerprint";

// The rules in use. Empty in PR 2a: the first site rules (Stockholm
// University, KTH) and the engine that runs them come with PR 2b. Nothing in
// the extractor worker reads this list yet (review §5.1).
export const RULES: readonly Rule[] = [];

/**
 * Recorded version and fingerprint of every rule in RULES. registry.test.ts
 * fails when a rule changes without a new version, or is missing here.
 */
export const VERSIONS: VersionLock = {};
