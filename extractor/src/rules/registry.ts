import type { VersionLock } from "./fingerprint";
import type { PageTypeDef } from "./match";
import { KTH_PAGE_TYPES, KTH_RULES } from "./sites/kth";
import { SU_PAGE_TYPES, SU_RULES } from "./sites/su";
import type { Rule } from "./types";

// The rules in use (PR 2b): Stockholm University and KTH, all in shadow mode.
// Nothing in the extractor worker reads this list yet (review §5.1); PR 3
// runs it in shadow mode first (D12).
export const RULES: readonly Rule[] = [...SU_RULES, ...KTH_RULES];
export const PAGE_TYPES: readonly PageTypeDef[] = [...SU_PAGE_TYPES, ...KTH_PAGE_TYPES];

/**
 * Recorded version and fingerprint of every rule in RULES. config.test.ts
 * fails when a rule changes without a new version, or is missing here.
 * After a reviewed change: raise the rule's version, then update its entry.
 */
export const VERSIONS: VersionLock = {
  "su.teaching_language.pair": { version: 1, fingerprint: "57a017a24c2913c6e4db0060104e9e790342eaab3383737c4b6aca593e62c2f4" },
  "su.tuition_fee.pair": { version: 1, fingerprint: "f5bccf2c25d05d3c487fb77a68054c4ea06bc1d6ea249d082f1d8ffeeb2ab2b6" },
  "su.programme_credits.intake_block": { version: 1, fingerprint: "0e7f4eeada78ee31cba12e6822d78d922fd57930e71ed375634edbefe84fe1f7" },
  "su.application_period.opens": { version: 1, fingerprint: "c93a28212eca0bfd5fc32f11f1900f2c901d09a42c7b70be0224be5cb160f21e" },
  "su.programme_duration.sentence": { version: 1, fingerprint: "d0ba3762bc57bcf03d750fecb3d7ccce8c081f9cf63fe78c393bb778ecdec96b" },
  "kth.application_deadline.lines": { version: 1, fingerprint: "be6f2ab13132ab58e469ebf6404224ef36393d785025ac4028ace7ec28142779" },
  "kth.application_period.opens": { version: 1, fingerprint: "99494c879220f6941c308ebe93bc810d3d1ae0bdbb772bbb22a52d44516472d1" },
  "kth.programme_duration.sentence": { version: 1, fingerprint: "6177cbd2381aedea81c27043f947df25084f122146cb9a2643be56aecbfda971" },
  "kth.programme_credits.sentence": { version: 1, fingerprint: "4072d0a46717cbca6ff60c2f45244827789379da89e8b0385a10371a64e331e4" },
  "kth.teaching_language.sentence": { version: 1, fingerprint: "f359b7361b65cc7aac57480275b80c417ee79034e6a792cb956e63b7a7ccb795" },
};
