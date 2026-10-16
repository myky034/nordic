# Nordic — Configurable Multi-Website Study Abroad Extraction

**Status:** Implementation proposal / handoff to Claude Code  
**Repository:** `myky034/nordic` (`main`)  
**Review basis:** Static inspection of selected repository files on 2026-10-15; tree SHA `cce768984d23331b916be5e7a9ca0dfb02f9e87a`.  
**Important:** This document is not proof that tests pass, that production migrations are applied, or that all existing database functions have been audited.

## 1. Objective

Extend the existing Nordic ingestion pipeline to extract reliable, comparable study-abroad programme information across official university websites with different layouts, content formats, languages, units, and page structures. Prefer configuration and reusable field-level rules over bespoke crawlers. Retain original values and field-level evidence; never invent missing data.

**Primary example:** Stockholm University programme `SPROM`, Autumn 2027, URL: `https://www.su.se/english/education/course-catalogue/sp/sprom?semester=HT2027&eventcode=43003`. Treat any values cited in earlier conversations as **test hypotheses** until verified against fetched source snapshots. Add a second structurally different university website for generalization testing.

## 2. Confirmed existing components (selected-file review)

- `crawler/src/crawl.ts`: Crawlee `BasicCrawler`, page/sitemap targets, polite fetching, incremental state, conditional GET, optional browser rendering, per-URL outcomes, document recording.
- `crawler/src/fetch.ts`: HTTP fetch with origin/content-type/size restrictions and ETag/Last-Modified support.
- `crawler/src/render.ts`: Playwright Chromium rendering, one browser per run, skips media/fonts/images, captures rendered HTML.
- `crawler/src/extract.ts`: Cheerio extraction of title and flattened readable text; currently removes scripts, navigation, etc. and collapses block boundaries to newlines.
- `extractor/src/run.ts`: per-document LLM candidate extraction, proposal through DB, status/tokens/error logging.
- `extractor/src/validate.ts`: candidate shape checks and excerpt/number grounding; authoritative validation is also performed in DB.
- `packages/db/prisma/schema.prisma`: existing `Source`, `Document`, `DocumentText`, `Fact`, `Evidence`, `FactType`, `University`, `Programme`, `CrawlTarget`, `CrawlUrlState`, `CrawlerRun`, `ExtractionRequest`, `ExtractionRun`, etc.
- Existing admin UI: `apps/web/app/(app)/admin/crawler/` and `apps/web/app/(app)/admin/extraction/`.
- Existing GitHub workflows: `.github/workflows/crawler.yml` and `extractor.yml`.
- `docs/architecture/browser-crawler-plan.md` records browser-rendering decision and its limitations (no expanding accordions, scrolling, screenshots).

**Do not replace** Crawlee, Playwright, Prisma, existing fact/evidence/review workflows, or existing extraction service without a documented necessity.

## 3. Mandatory pre-implementation audit

Before writing migrations or modifying orchestration, read these files completely:

1. `crawler/src/{config,db,crawl,extract,fetch,render,sitemap,urls}.ts`, `crawler/README.md`, relevant tests.
2. `extractor/src/{config,db,llm,prompt,run,validate}.ts`, `extractor/README.md`, relevant tests.
3. `packages/db/prisma/schema.prisma`, all relevant migrations (especially 2026-09-28 crawler, 2026-09-29 AI extraction, 2026-10-13 through 2026-10-15 fact types/mapping/browser), and database functions/triggers/policies.
4. `apps/web/lib/{crawler,extraction,education}/`, admin pages/actions/forms, public programme pages.
5. `docs/architecture/{slice-09-crawler,slice-10a-ai-extraction,browser-crawler-plan}.md`, root `AGENTS.md`, package scripts and CI workflows.

Produce a short audit table: **existing capability | evidence (path/function) | gap | proposed change | migration impact | tests**. Check whether FactType and programme mapping already solve any proposed requirement. Avoid duplicate concepts and tables. Do not assume repository code is identical to this snapshot.

## 4. Target pipeline

```
Registered official sources / URLs / sitemap
  -> Policy-aware URL discovery and fetch (existing)
  -> Optional Playwright render (existing, configurable wait conditions)
  -> Structured content parser (NEW: text, sections, tables, links, metadata)
  -> Document + structured snapshot persistence (extend existing)
  -> Page classification and programme/intake association (NEW)
  -> Rule registry + deterministic field extraction (NEW)
  -> Normalization + field validation + evidence binding (NEW)
  -> AI fallback for unresolved fields (extend existing)
  -> Cross-document conflict resolution / human review (NEW)
  -> Existing Fact/Evidence/Programme projection and public UI
```

Preserve source provenance at each stage. Do not automatically publish AI-derived or conflicting fields.

## 5. Data model and field contract

Define canonical fields before implementing selectors. At minimum:

- **Identity:** institution, country, programme name/code, degree level, subject/department, canonical programme URL.
- **Intake:** semester/year, intake-specific URL/query params, application rounds, application open/close dates, document and fee deadlines, exact start date when stated.
- **Delivery:** online/on-campus/hybrid, campus attendance requirement, study pace (%), nominal degree duration, actual scheduled duration, duration unit, credits and credit system.
- **Eligibility:** degree requirement, subject prerequisites, prerequisite credits, thesis requirement, language requirement, official score equivalences only if verified, selection criteria, required documents.
- **Curriculum:** modules/courses, semesters, course credits, thesis credits.
- **Finance:** application fee, tuition amount/currency, tuition basis (semester/year/full programme), tuition eligibility group, scholarships and their programme applicability.
- **Outcomes:** officially described career outcomes, further-study pathways, explicit limitations on residence/work rights.

Suggested field result contract (adapt to existing Fact/FactType rather than creating a parallel truth store):

```ts
type FieldEvidence = {
  documentId: string;
  sourceUrl: string;
  excerpt: string;
  sectionPath?: string[];
  pageNumber?: number; // for PDF
  capturedAt: string;
};
type ExtractedField = {
  fieldKey: string;
  rawValue: string | null;
  normalizedValue: string | number | boolean | null;
  normalizedUnit?: string | null;
  status: 'verified' | 'derived' | 'inferred' | 'missing' | 'conflicting';
  method: 'selector' | 'table' | 'regex' | 'json_ld' | 'formula' | 'ai';
  ruleId?: string;
  ruleVersion?: number;
  evidence: FieldEvidence[];
  reviewRequired: boolean;
};
```

Distinguish **programme** from **intake-specific facts**. Do not overwrite Autumn 2027 deadlines with Autumn 2026 values. Store `rawValue` alongside normalized values. `missing` means unknown, not zero or free. `derived` requires an explicit formula and all verified inputs; do not label as direct official evidence.

## 6. Rule Engine requirements

Implement hierarchical rules:

1. **Global:** units, date formats, ECTS, currency and language-neutral validation.
2. **Domain/site:** origin/path/page-type matching, selectors, labels, structured-data hints, navigation hints, rendering options.
3. **Page-type/programme exceptions:** overrides for known anomalies, scoped by URL pattern and optionally intake.

Each rule must have: stable ID, version, enabled status, priority, matching conditions, extraction strategy, normalization strategy, validation constraints, provenance requirements, fallback behavior, and fixture tests. Resolve specificity deterministically; record applied rule/version per output. Never execute arbitrary JavaScript from admin-supplied configuration; use an allowlisted declarative DSL and typed handlers.

Strategies: CSS selector, XPath where justified, JSON-LD, heading/label-value pairing, table mapping, regex over scoped text, derived formula, AI fallback. A failed selector must not silently convert a field into a verified fact. AI must not invent evidence.

**Illustrative rule (not a tested selector):**

```json
{
  "id": "global.duration.years",
  "version": 1,
  "enabled": true,
  "priority": 100,
  "match": { "labels": ["Duration", "Study duration"] },
  "extract": { "strategy": "regex", "pattern": "(\\d+(?:\\.\\d+)?)\\s*years?" },
  "normalize": { "handler": "duration_to_months" },
  "validate": { "minMonths": 1, "maxMonths": 120 },
  "fallback": "ai_if_unresolved"
}
```

Important duration example: “One Year Master's” is degree naming/nominal scope, while “2 years at 50% pace” is actual scheduled duration. Do not equate degree name with study duration. Conversion `2 years -> 24 months` is deterministic; deriving 24 months from 60 ECTS and 50% pace requires verified conventions and must be labeled derived.

## 7. Structured content and multi-page evidence

Current `crawler/src/extract.ts` returns flattened text only. Extend it without breaking the current `DocumentText` contract:

- Extract heading hierarchy, text blocks, tables as rows/cells with headers, definition lists, label-value pairs, links (absolute normalized URLs), canonical URL, JSON-LD where applicable.
- Preserve stable excerpt text and positional references for evidence verification.
- Keep both readable text (for existing AI flow) and structured representation (new versioned format).
- Identify relevant links to admissions, tuition, course syllabus, scholarship and PDF; enforce allowlisted hosts, URL limits, depth limits, and policy/robots compliance.
- Support sitemap indexes when safe and useful; avoid indiscriminate site-wide crawling.
- For PDF: separate binary download and bounded PDF text extraction; never pass PDF bytes through UTF-8 HTML extraction. Keep page-number evidence. Handle scanned PDFs as unsupported/review-required unless an approved OCR path is added.
- Programme identity matching must avoid attaching unrelated tuition or general university admission requirements to a specific intake without applicability evidence.

## 8. Rendering and crawling safeguards

Retain existing robots.txt behavior, transparent user-agent, origin checks, limits, retries and logging. Enhance site-level rendering config with optional `waitForSelector`, bounded timeouts, and controlled accordion expansion only where necessary and permitted. Do not bypass CAPTCHA, login, bot defenses, or access controls. Follow official terms and prefer permitted APIs when available. Use concurrency/rate limits per host. Validate redirect destinations and discovered links against allowlists.

Current `render.ts` uses `networkidle` and no interactions; treat this as a known limitation, not a universal solution.

## 9. AI fallback and evidence policy

Keep the existing `extractor/src/run.ts` and `extractor/src/validate.ts` as the baseline. Run deterministic rules first; ask the LLM only for unresolved fields or ambiguous content, with bounded relevant sections and candidate field schema. Every AI candidate must have a verbatim excerpt traceable to a stored document, and must pass existing authoritative DB checks plus field-level semantic checks. A confidence score alone never establishes truth. Preserve `verified`, `derived`, `inferred`, `missing`, `conflicting` statuses distinctly.

Conflict examples: programme-specific tuition versus general university fee, year-specific deadline differences, and nominal versus actual duration. Define source applicability and precedence explicitly, and queue unresolved conflicts for review rather than selecting the largest/latest number blindly.

## 10. Database and migration approach

Audit existing schema, SQL functions and RLS before proposing new tables. Prefer extending `FactType`, `Fact`, `Evidence`, `Programme`, `Document`, `CrawlTarget` where appropriate. If necessary, add narrowly scoped tables such as `ExtractionRule`, `RuleTestCase`, `DocumentStructure`, `ProgrammeSourceLink`, `FieldResolution`, with indexes, FK, unique constraints and audit history; these are **candidates**, not mandated tables. Preserve backward compatibility and historical facts. Generate Prisma client through supported scripts; do not edit generated client files manually.

Use additive migrations, local test DB, backfill plan, rollback strategy, and migration review. **Do not run production migrations or change production data without explicit approval.**

## 11. Suggested code changes

| Path | Change |
|---|---|
| `crawler/src/extract.ts` | Add structured HTML extraction alongside existing readable text. |
| `crawler/src/crawl.ts` | Persist structured snapshots and metadata, retain existing outcomes. |
| `crawler/src/render.ts` | Optional site-specific wait conditions with safe bounds. |
| `crawler/src/sitemap.ts` | Review sitemap index handling and bounded discovery. |
| `extractor/src/run.ts` | Orchestrate deterministic rules before AI; preserve current request lifecycle. |
| `extractor/src/validate.ts` | Extend field-level semantic checks without weakening grounding. |
| `extractor/src/prompt.ts` | Narrow AI prompts to unresolved fields and structured evidence. |
| `extractor/src/rules/{types,registry,matcher,engine}.ts` | New declarative rule framework. |
| `extractor/src/normalizers/{duration,currency,credits,dates,study-mode}.ts` | Pure typed normalizers with tests. |
| `extractor/src/evidence/resolver.ts` | Link extracted fields to exact document evidence. |
| `packages/db/prisma/schema.prisma` + SQL migrations | Minimal additive persistence extensions only after audit. |
| `apps/web/app/(app)/admin/extraction/` | Eventually add rule preview, test, version activation, evidence/review UI. |
| `.github/workflows/{crawler,extractor}.yml` | Update only if new runtime/dependencies require it. |

## 12. Delivery plan (small, reviewable PRs)

**PR 0 — Audit and baseline:** Read all files listed in §3; document current extraction and mapping; run existing unit/integration tests; collect fixtures and regression baselines. No behavior change.

**PR 1 — Structured content:** Add typed structured HTML snapshot and fixtures. Preserve old text output and hashes unless explicitly versioning changes. Add parser tests for tables, headings, labels, links, dynamic HTML.

**PR 2 — Rule engine and normalizers:** Add declarative rule types, deterministic matcher/priority, pure normalizers and tests; no production UI required. Prove same field can be extracted from differently structured fixtures.

**PR 3 — Persistence and evidence:** Integrate with existing Fact/FactType/Evidence and programme/intake mapping. Add minimal migrations and authoritative validation, test conflicts and review states.

**PR 4 — AI fallback and cross-document resolution:** Route unresolved fields to existing LLM, merge by programme/intake/source applicability, avoid silent publication.

**PR 5 — PDF and admin UX:** Add bounded PDF ingestion and page evidence, then rule preview/test/activation UI with RBAC and audit. Scope PDF and UI as separate PRs if large.

## 13. Acceptance tests

- [ ] Existing crawler, extractor, DB and admin tests remain green; no regression in current flows.
- [ ] Stockholm SPROM fixture produces at least 15 meaningful fields, each with correct intake and evidence or explicit missing state.
- [ ] Distinguishes degree name/nominal duration from actual duration and study pace.
- [ ] Converts years/months consistently and retains original unit/value.
- [ ] Handles tuition period and currency without assigning general fees to the programme.
- [ ] Resolves evidence from at least two official documents into one programme/intake record.
- [ ] A second university with different DOM layout is supported primarily by configuration, not a forked crawler.
- [ ] Missing fields are never fabricated; conflicts require review; AI results cannot bypass evidence validation.
- [ ] Site rule failure is observable with error category, URL, rule ID/version and fixture coverage.
- [ ] Crawl respects robots, rate limits, bounded discovery and access policies.
- [ ] DB migrations are additive, tested locally, and require explicit production approval.

## 14. Instructions for Claude Code

1. Start by inspecting the current repository; do **not** assume this document is perfectly up to date.
2. Produce a gap analysis referencing exact functions, migrations and tests. Identify existing functionality to reuse.
3. Propose the smallest coherent design and file-by-file changes, with data flow and migration impact.
4. Implement incrementally on a feature branch, with focused tests and fixture-based evidence checks.
5. Do not delete existing tables, bypass reviews, change permissions, expose secrets, or deploy to production without explicit permission.
6. If a requirement conflicts with existing architecture, explain the tradeoff and propose a compatibility-safe alternative.
7. At each PR, report files changed, tests run/results, known limitations, and next steps.

### Suggested kickoff prompt

> Read `docs/architecture/NORDIC_CONFIGURABLE_EXTRACTION_IMPLEMENTATION_SPEC.md` and audit the actual current code before changing anything. First produce PR 0's gap analysis with exact file/function references, identify existing FactType/Programme mapping capabilities and migration risks, and propose a minimal incremental implementation plan. Do not modify production data or deploy. Wait for my approval before implementing PR 1.
