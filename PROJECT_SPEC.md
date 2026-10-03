# Europe Study & Career Intelligence Portal — Master Specification

## 0. Purpose

Build a production-minded, source-grounded web portal for researching European countries and planning study/work journeys.

The system must aggregate, normalize, classify, search, and present information from:

1. Official government and immigration authorities.
2. EU/institutional sources.
3. Universities and official education portals.
4. Professional/secondary sources.
5. First-hand experience sources such as blogs, Reddit, YouTube, and expat communities.

The product must clearly distinguish authoritative facts from personal experiences and must never present an inferred or stale claim as official fact.

Primary initial use case:

- Research European countries.
- Compare countries.
- Research Master's programmes/universities.
- Research labour markets and occupations.
- Research immigration/residence/work rules.
- Track source freshness and evidence.
- Build a personal "My Europe Plan".

Initial country scope:

- Sweden
- Denmark
- Finland
- Norway
- Netherlands

Do not expand the country scope until the source/data architecture is stable.

---

## 1. Product Vision

Working name:
Europe Study & Career Intelligence Portal

Core promise:
"One place to research Europe with evidence, compare options, and turn research into an actionable study-to-career plan."

The portal is NOT:

- A replacement for government immigration advice.
- A legal/financial adviser.
- A generic web scraper.
- A content-copying website.
- An AI chatbot that invents answers.

The portal IS:

- A research and evidence layer.
- A structured knowledge base.
- A source discovery and comparison system.
- A personal planning workspace.

---

## 2. Core Modules

### 2.1 Country Explorer

Each country profile should eventually include:

- Overview
- Culture
- People/society
- Language
- Cost of living
- Housing
- Healthcare
- Transportation
- Safety
- Quality of life
- Education
- Labour market
- Immigration
- Taxes
- Useful official links
- First-hand experiences

### 2.2 Education

Entities:

- Universities
- Institutions
- Programmes
- Degrees
- Tuition fees
- Admission requirements
- Language requirements
- Application deadlines
- Scholarships
- Official application portals
- Student residence information

### 2.3 Career / Labour Market

Entities:

- Occupations
- Skills
- Labour-market indicators
- Salary information
- Job postings
- Employers/companies
- Product Management
- Product Owner
- Business Analyst
- Software Engineering

Do not fabricate salary, demand, or job-market data.

### 2.4 Immigration

Entities:

- Student residence permits
- Work permits
- Post-study options
- Residence requirements
- Financial requirements
- Application procedures
- Permanent residence
- Citizenship

Immigration information must prioritize official government sources and always display source + verification date.

### 2.5 Source Registry

Every source must have metadata:

- name
- canonical URL
- country
- source type
- authority tier
- topic
- language
- crawl policy/status
- last crawled
- last verified
- trust score
- notes

Recommended source tiers:

- T1: Government / official authority
- T2: EU / institutional / university official
- T3: Professional / secondary
- T4: First-hand experience / community

Tier is a classification, not proof that every statement on the source is correct.

### 2.6 Documents

Store:

- source_id
- canonical_url
- title
- document type
- content hash
- published date if known
- updated date if known
- crawled date
- extraction status
- processing status
- content reference

Prefer storing metadata, extracted facts, summaries, and evidence rather than indiscriminately storing entire copyrighted pages.

### 2.7 Facts and Evidence

A fact is a structured claim extracted from a document.

Every fact should be traceable:

Fact -> Evidence -> Document -> Source -> Original URL

Fact fields should support:

- topic
- subject
- predicate
- value
- unit
- country
- valid_from
- valid_until
- confidence
- status
- created_at
- updated_at

Evidence should support:

- fact_id
- document_id
- source URL
- short supporting excerpt where legally/technically appropriate
- retrieved_at

Never create a fact without evidence unless explicitly marked as user-created/non-source fact.

### 2.8 Research Workspace

Authenticated users can create:

- Research projects
- Saved countries
- Saved universities
- Saved programmes
- Saved sources
- Notes
- Bookmarks
- Personal plans
- Budget assumptions
- Target dates

Example:
"Sweden 2028"

### 2.9 My Europe Plan

User profile may contain:

- current role
- education
- target role
- language goals
- preferred countries
- target degree
- target year
- budget
- application status

The system may calculate/organize planning information, but must clearly label recommendations as recommendations rather than facts.

### 2.10 Country Comparison

Support comparison across:

- Education
- Tuition
- Living cost
- Labour market
- Occupations
- Immigration
- Housing
- Language
- Quality of life

Every quantitative or policy-sensitive comparison must be evidence-backed.

### 2.11 Search

MVP:

- PostgreSQL full-text search.

Later:

- pgvector semantic search.
- Hybrid keyword + vector retrieval.
- Reranking.

Do not add Elasticsearch/OpenSearch unless there is a measured need.

---

## 3. Technology Stack

### Frontend / application

- Next.js
- TypeScript
- React
- Tailwind CSS or the project's selected UI system
- Vercel deployment

### Backend platform

- Supabase

Use:

- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Row Level Security
- Supabase Edge Functions only for suitable short-lived backend tasks
- pgvector when semantic search is implemented

### ORM

- Decision: Prisma. Confirmed by the project owner after Slices 1-4 were
  already built on it; do not revisit without explicit approval
  (AGENTS.md Section 3).
- Rationale: `@prisma/adapter-pg` runs cleanly through Supabase's
  transaction pooler (PgBouncer/Supavisor) from serverless functions.
  The registry/documents/facts read and write paths already rely on a
  working pattern of scoping every query to a transaction-local Postgres
  role (`SET LOCAL ROLE anon` / `authenticated` / `nordic_ingestor`, with
  `set_config('request.jwt.claim.sub', ...)` to impersonate a specific
  user) so that RLS policies apply identically whether the caller is
  Prisma or PostgREST. Prisma's generated types are also shared as-is
  between the web app and, from Slice 9 onward, the crawler package.
  Drizzle was the original recommendation before implementation started;
  it is no longer under consideration.
- Prisma schema/migrations/generated client live in `packages/db` (see
  Section 4) and are consumed by the web app and crawler as a workspace
  package.

### Crawler

- Node.js / TypeScript
- Crawlee (functional equivalent to Scrapy: native robots.txt compliance,
  auto-throttle, retries with backoff, sitemap support, per-domain
  concurrency limits, and native Playwright integration)
- Playwright only where dynamic rendering is actually required
- RSS/sitemap support where available

Rationale: for a solo-maintained, long-horizon project, a single language
across web app, admin dashboard, and crawler reduces cognitive overhead and
allows sharing Supabase-generated TypeScript types between the ingestion
pipeline and the application layer, reducing schema-drift bugs. Crawlee
matches Scrapy's coverage of the Crawler Rules in Section 8 closely enough
that the language-consistency benefit outweighs Scrapy's larger ecosystem.

Crawler must be separated from the Next.js web application (separate
package/workspace in the monorepo, executed by its own scheduled job — see
Section 4).

Incremental crawl state (ETag/Last-Modified, content hash, last_crawled_at)
must be persisted in Supabase (`sources`, `documents` tables), not in local
job files — the crawler's execution environment (see Section 4) is
ephemeral and cannot be relied on to retain state between runs.

### AI

Use an LLM only for:

- classification
- extraction assistance
- summarization
- entity extraction
- change detection assistance
- semantic retrieval/RAG

AI is not the authority for government/legal facts.

> Update 2026-09-28 (Slice 10a): the LLM is called through any
> OpenAI-compatible endpoint configured by `LLM_BASE_URL` / `LLM_MODEL` /
> `LLM_API_KEY`; the first provider is Google Gemini (free tier). It runs in a
> separate `extractor/` worker, not in the Next.js app.

### Repository

- Git
- GitHub
- clear environment separation
- npm workspaces monorepo (see Section 4): `apps/web` (Next.js),
  `packages/db` (Prisma schema/migrations/generated client, shared),
  `crawler` (Slice 9, empty placeholder until then).

---

## 4. High-Level Architecture

### Monorepo layout

```
apps/web/       Next.js app (routes, UI, server actions, API routes).
                 Owns next.config.ts, proxy.ts, tsconfig.json, its own
                 .env.local (Next.js only reads env files from the app
                 directory it is run from).
packages/db/     Prisma schema, migrations, generated client. Published
                 internally as a workspace package (e.g. "@nordic/db")
                 consumed by apps/web and, from Slice 9, crawler/.
                 Owns prisma.config.ts and DIRECT_URL usage for the CLI.
crawler/         Empty placeholder until Slice 9. Will depend on
                 packages/db for types and write to Supabase with a
                 service-role key, never importing anything from apps/web.
```

Root `package.json` only declares the `workspaces` array and thin
scripts that delegate into `apps/web` (`npm run dev` etc.) — it holds no
application code itself.

User
-> Vercel (root directory: apps/web)
-> Next.js
-> Supabase

Supabase:

- PostgreSQL
- Auth
- RLS
- Storage
- Edge Functions
- pgvector

Crawler:

- separate worker/runtime: Node.js/TypeScript (Crawlee), scheduled via
  GitHub Actions (cron trigger)
- writes to Supabase using a service-role key, never exposed to the
  browser/Next.js client bundle
- fetches approved sources
- extracts content
- detects changes
- sends normalized documents to Supabase

> Update 2026-09-25 (Slice 9 — see Section 21): the crawler does **not** use a
> service-role key. It connects as a login role that is a member of the
> `nordic_crawler_ops` Postgres role, which has no table privileges and may only
> execute five `crawler_*` SECURITY DEFINER functions. The text above is kept
> unchanged for history.

AI pipeline:

- processes normalized documents
- classifies
- extracts candidate facts
- generates summaries
- creates embeddings when enabled

Conceptual flow:

Source Registry
-> Crawl Scheduler
-> Fetch
-> Parse
-> Canonicalize
-> Deduplicate
-> Document
-> AI Classification
-> Fact Extraction
-> Evidence
-> Validation
-> Knowledge DB
-> Search
-> UI

---

## 5. Suggested Database Model

Implement incrementally, not as one giant migration.

Core tables:

### countries

- id
- name
- iso_code
- region
- status
- created_at
- updated_at

### sources

- id
- name
- canonical_url
- country_id nullable
- source_tier
- source_type
- topics
- language
- authority_notes
- trust_score nullable
- crawl_enabled
- crawl_frequency
- last_crawled_at
- last_verified_at
- created_at
- updated_at

### source_urls

Optional if a source has multiple crawlable URLs.

### documents

- id
- source_id
- canonical_url
- title
- document_type
- content_hash
- published_at nullable
- source_updated_at nullable
- crawled_at
- processing_status
- content_reference nullable
- created_at
- updated_at

### facts

- id
- country_id nullable
- topic
- subject
- predicate
- value
- unit nullable
- valid_from nullable
- valid_until nullable
- confidence
- status
- created_at
- updated_at

### evidence

- id
- fact_id
- document_id
- source_url
- excerpt nullable
- retrieved_at
- created_at

### universities

- id
- country_id
- name
- official_url
- description nullable
- created_at
- updated_at

### programmes

- id
- university_id
- name
- degree_type
- field
- language
- duration
- tuition nullable
- official_url
- application_url nullable
- application_deadline nullable
- status
- created_at
- updated_at

> Update 2026-09-23 (Slice 5, Option A — see Section 21): `tuition` and
> `application_deadline` above are NOT implemented as columns. They are
> evidence-backed facts linked by `facts.programme_id` (plus
> `facts.deadline_type`). `universities`/`programmes` store identity only and
> require a document + excerpt as evidence of existence. The field list above
> is kept unchanged as the original suggestion.

### occupations

- id
- name
- country_id nullable
- classification_code nullable
- description nullable

### labour_market_items

- id
- occupation_id
- country_id
- metric
- value
- unit
- period
- source/evidence relation

> Update 2026-09-25 (Slice 6b — see Section 21): `occupations` is implemented
> as identity only (name, optional classification system + code, optional
> country scope, document + excerpt). `labour_market_items` is NOT a separate
> table: each figure is a fact linked by `facts.occupation_id`, with
> `facts.reference_period` as the period and a required country. The field
> lists above are kept unchanged as the original suggestion.

### immigration_rules

- id
- country_id
- rule_type
- title
- summary
- status
- valid_from
- valid_until
- evidence relation

> Update 2026-09-23 (Slice 6a — see Section 21): implemented without `summary`,
> `valid_from` or `valid_until` columns. The rule stores identity only and must
> be proven by a T1 document from the same country; requirements and their
> validity dates are facts linked by `facts.immigration_rule_id`. The field list
> above is kept unchanged as the original suggestion.

### research_projects

- id
- user_id
- name
- description
- target_year
- status
- created_at
- updated_at

### bookmarks

- id
- user_id
- entity_type
- entity_id
- created_at

### notes

- id
- user_id
- research_project_id nullable
- entity_type nullable
- entity_id nullable
- content
- created_at
- updated_at

### user_profiles

- id/user_id
- current_role nullable
- education nullable
- target_role nullable
- target_degree nullable
- target_year nullable
- budget nullable
- language_goals nullable
- created_at
- updated_at

### personal_plans

> Update 2026-09-27 (Slice 8 — see Section 21): `personal_plans` is merged
> into `research_projects` (each project has target year, role and countries);
> `user_profiles` is implemented as `user_plans` ("My Europe Plan", one per
> user; `current_role` became `current_position` because CURRENT_ROLE is an SQL
> keyword); bookmarks use real foreign keys (`saved_items`) instead of
> entity_type/entity_id. The field lists here are kept unchanged.

- id
- user_id
- name
- target_country nullable
- target_year nullable
- target_role nullable
- status
- created_at
- updated_at

Do not blindly implement every suggested field. Validate normalization and relationships before migration.

---

## 6. Data Integrity Rules

1. No unsupported facts.
2. No uncited immigration claims.
3. No uncited quantitative claims.
4. No fabricated university/programme data.
5. No fabricated job/salary data.
6. No "trust score" presented as objective truth.
7. Every source-derived fact must link to evidence.
8. Preserve source dates when available.
9. Store retrieval timestamps.
10. Support validity periods for policy-sensitive data.
11. Detect duplicate documents by canonical URL and content hash.
12. Preserve historical versions where policy changes matter.
13. Never overwrite historical facts without an audit/change record.
14. If two credible sources conflict, store the conflict; do not silently choose one.
15. Prefer official sources for legal/immigration/policy claims.

---

## 7. Source Priority Rules

For immigration/legal/policy:
T1 > T2 > T3 > T4

For official university programme information:
University official source > official national education portal > T3 > T4

For labour market:
Official statistics/labour agency/EURES > institutional research > professional sources > personal experiences

For lived experience:
T4 is valid as an experience report but NOT as authoritative policy.

Never convert a T4 experience into a T1-style fact.

---

## 8. Crawler Rules

Crawler must:

- only crawl registered/approved sources
- check robots.txt and applicable site rules
- respect rate limits
- use a clear user agent where appropriate
- avoid aggressive concurrency
- support retries with backoff
- record failures
- record HTTP status
- canonicalize URLs
- deduplicate by URL/content hash
- support incremental crawling
- use ETag/Last-Modified when available
- use sitemaps/RSS when available
- avoid crawling unnecessary pages
- avoid infinite pagination
- have per-domain crawl limits
- have configurable schedules

Do NOT:

- crawl arbitrary websites discovered by the model
- bypass robots.txt or technical access controls
- bypass paywalls/login restrictions
- evade anti-bot systems
- scrape private/personal data
- scrape authenticated content without explicit authorization
- download enormous files without size/type limits

> Update 2026-09-25 (Slice 9 — see Section 21): "registered/approved" means a
> URL listed in `crawl_targets` (admin, `crawler.manage`) for a source that is
> `verified`, crawl policy `approved` and crawl enabled. Sitemaps are allowed
> with a path-prefix filter and a 1–100 URL cap; links inside pages are never
> followed. RSS is not implemented yet.

---

## 9. Copyright / Content Rules

The portal is a research/indexing system.

Prefer:

- metadata
- title
- URL
- short excerpts
- summaries
- structured facts
- source attribution

Do not mirror entire third-party articles.

Do not expose large copyrighted text passages.

Always link to the original source.

> Update 2026-09-25 (Slice 9): crawler-extracted page text is stored in
> `document_texts`, readable only by editors (facts.propose, facts.review,
> documents.ingest) for change review and future extraction. It is never shown
> on public pages.

---

## 10. Freshness and Change Detection

For each sensitive document/fact support:

- crawled_at
- source_updated_at if available
- verified_at
- validity period
- processing version

Sensitive topics:

- visa
- immigration
- work permits
- tuition
- scholarships
- application deadlines
- labour law
- salary
- taxes

Display:
"Last verified: YYYY-MM-DD"

If a source changes:

- create a new document version or change record
- compare old/new content
- identify potentially affected facts
- mark affected facts for review
- do not automatically assert the new fact as authoritative solely because an LLM detected it

---

## 11. AI Rules

AI can:

- classify documents
- extract candidate entities
- extract candidate facts
- summarize
- identify possible changes
- generate embeddings
- generate user-facing synthesis from retrieved evidence

AI cannot:

- invent sources
- invent URLs
- invent visa rules
- invent fees
- invent deadlines
- invent salaries
- invent university programmes
- silently resolve source conflicts
- claim "official" without an official source
- turn an inference into a fact

For high-impact claims:
AI output must be linked to retrieved evidence.

> Update 2026-09-28 (Slice 10a — see Section 21): implemented as candidate
> fact extraction only. The model's output is checked in the database
> (`extractor_propose`): the excerpt must occur verbatim in the stored page
> text and every number in the value must occur in the excerpt. Accepted
> candidates are `proposed` facts with `origin = 'ai'`; a human reviews every
> one. The model's self-reported confidence is shown as a hint, never as a
> trust score.

---

## 12. Security

Use:

- Supabase Auth
- Row Level Security for user-owned data
- server-side secrets only
- environment variables
- no service-role key in browser code
- input validation
- rate limiting where appropriate
- safe HTML/text sanitization
- URL validation
- file type and file size validation

Never expose:

- service role keys
- crawler credentials
- LLM provider secret keys
- database admin credentials

---

## 13. Environment Separation

Use:

- local
- preview
- production

Never hard-code credentials.

Expected environment variables should be documented in `.env.example`.

---

## 14. UX Principles

The UI should make source quality visible.

For claims, show:

- source
- source tier
- last verified
- evidence link
- confidence/status where appropriate

Use visual distinctions for:

- official fact
- institutional information
- professional/secondary information
- personal experience
- user-generated note
- AI-generated synthesis

Avoid presenting a single "Europe score" as objective unless the scoring methodology is explicit and evidence-backed.

---

## 15. MVP Scope

MVP should include:

1. Country Explorer
2. Source Registry
3. Document ingestion
4. Evidence-backed Facts
5. University/programme basic model
6. Immigration information model
7. Labour-market information model
8. Search
9. Country comparison
10. User authentication
11. Research projects
12. Bookmarks
13. Notes
14. Source freshness indicators

Defer:

- complex recommendation engine
- advanced RAG
- automated immigration advice
- full job board aggregation
- social features
- mobile app
- Elasticsearch/OpenSearch
- autonomous crawling of the open web

---

## 16. Development Strategy

Do not generate the entire application in one pass.

Build vertical slices.

### Slice 1

- Next.js
- Vercel-ready
- Supabase connection
- auth
- basic layout
- health check

### Slice 2

- countries
- sources
- source registry UI

### Slice 3

- documents
- ingestion API
- document processing status

### Slice 4

- facts
- evidence
- source display

### Slice 5

- universities
- programmes

### Slice 6

- immigration
- labour market

### Slice 7

- search
- comparison

### Slice 8

- research workspace
- bookmarks
- notes

### Slice 9

- crawler worker
- incremental crawl
- change detection

### Slice 10

- AI extraction
- pgvector/RAG

Each slice must be runnable before moving to the next.

---

## 17. Definition of Done

A feature is not done merely because code compiles.

It must have:

- type safety
- validation
- error handling
- loading state
- empty state
- sensible UI
- database migration
- RLS where applicable
- tests for critical logic
- no leaked secrets
- documentation if architecture changes
- source attribution if it displays external facts

---

## 18. Initial Seed Sources

The project already has these candidate sources from the user's supplied files:

1. EURES:
   https://eures.europa.eu/index_en

Use for European employment/labour mobility discovery.

2. Hotcourses Europe:
   https://www.hotcourses.vn/europe/

Use as a secondary education discovery source.

These are seed sources only. Do not infer that they cover every required country/topic.

Official source discovery must be performed carefully and source-by-source.

Gap flagged for action before Slice 2/3: these 2 sources are not sufficient
coverage for 5 countries × 4 topic areas (education, immigration, labour
market, cost of living). Before Source Registry UI (Slice 2) is meaningfully
testable, build a per-country checklist of T1 (government) sources at
minimum for: immigration/residence authority, national statistics/labour
agency, and the primary official study-in-<country> portal. Treat this as a
manual research task, not something the crawler or AI should infer.

---

## 19. Product Philosophy

The highest-priority product property is TRUST.

The portal should answer:
"Where did this information come from, how current is it, and what type of source is it?"

before it tries to answer:
"What does the AI think?"

Evidence > inference.
Official source > secondary source for policy.
Current verified data > stale data.
Transparent uncertainty > fabricated certainty.
Small reliable dataset > huge noisy dataset.

---

## 20. First Implementation Goal

Before writing substantial UI, create:

- architecture documentation
- database ERD/schema proposal
- source registry model
- ingestion pipeline design
- environment variable list
- security model
- crawler boundaries
- MVP task breakdown

Then implement Slice 1.

## UI / Visual Design Direction

Nordic should follow an Apple-inspired modern minimalist design language
combined with Scandinavian/Nordic visual principles.

The interface should feel:

- modern
- calm
- premium
- spacious
- clean
- trustworthy
- information-focused

### Visual principles

- generous whitespace
- strong typography hierarchy
- restrained color usage
- soft rounded corners
- subtle borders and shadows
- limited and intentional use of transparency and backdrop blur
- clean grid-based layouts
- high information readability
- minimal visual noise
- subtle purposeful animations
- responsive-first design

### Avoid

- excessive gradients
- excessive glassmorphism
- heavy shadows
- overly colorful dashboards
- cramped layouts
- unnecessary animations
- generic SaaS dashboard appearance
- excessive cards inside cards
- decorative elements without functional purpose

### Product identity

Do not copy Apple's UI, assets, branding, or layouts directly.

Use Apple and Scandinavian design principles as visual inspiration while
building an original Nordic design system.

---

## 21. Decision Log

Additive record of decisions that refine or deviate from the sections above.
Earlier text is intentionally left unchanged; where they differ, the newest
dated entry here is the current decision.

### 2026-09-23 — Slice 5 education model: Option A

Chosen by the project owner over "Option B" (tuition/deadline as columns).

- `universities` and `programmes` hold identity only: name, country (via
  university), degree type, field, language of instruction, official URL,
  application URL. Unknown values stay null; degree type has an explicit
  `unknown` value instead of a guess.
- Each university/programme requires a `document_id` and a short
  `evidence_excerpt` proving the entity exists (SRS FR-ED-02). Source URL and
  retrieval date are read from the immutable document, never typed in.
- Tuition, application deadlines, duration and scholarships are facts linked
  via `facts.programme_id` or `facts.university_id` (at most one). They reuse
  the Slice 4 evidence, review, conflict and history rules instead of a second
  mechanism. A fact linked to an entity inherits the entity's country; a
  different explicit country is refused.
- `facts.deadline_type` (`fixed` / `rolling` / `year_round`) records the
  deadline kind; rolling / year-round deadlines have no invented date.
- Entities follow `proposed -> reviewed | rejected`, append-only, with the log
  in `education_reviews`. Only reviewed entities are public; a programme is
  public only while its university is reviewed. Corrections are new proposals.
- New permission `education.manage` (propose). Reviewing uses the existing
  `facts.review`. Complete administrator roles receive `education.manage` via
  the migration, the same rule used for `facts.*` and `sources.manage`.
- Not in this slice: funding-type filter (no evidence-backed funding model
  yet), editing an entity in place, pagination beyond 100 rows.
- Details: `docs/architecture/slice-05.md`,
  `docs/learning/slice-05-universities-programmes.md`.

### 2026-09-23 — Integrity fixes from the Slice 1-4 review

- Conflicts: `review_fact` only pairs facts that are already `reviewed` or
  `conflicted`. Previously a `proposed` fact could become public by being
  marked `conflicted` without its own evidence review (AGENTS.md 1.3).
- Source verification date: `save_source` stamps `last_verified_at` only when a
  source becomes `verified` or the operator explicitly re-verifies
  (`p_reverify`). Other edits keep the previous date; leaving `verified` keeps
  the historical date. Changing the canonical URL or tier of a verified source
  requires re-verification (AGENTS.md Section 12).
- Documentation note: SRS/Product Backlog v0.1 mention Drizzle; the ORM is
  Prisma per Section 3. The .docx files in `documents/` carry an appended
  update section recording this and the decisions above.

### 2026-09-23 — Slice 6a immigration model (recommendations accepted)

Slice 6 is split into 6a (immigration: S6-01, S6-02, S6-05) and 6b (labour
market: S6-03, S6-04, not started).

- `immigration_rules` holds identity only: country, rule type
  (student_residence_permit / work_permit / post_study / permanent_residence /
  citizenship / other), official title, official URL, document + excerpt. No
  free-text `summary`: requirements are facts linked by
  `facts.immigration_rule_id` (at most one linked entity per fact).
- The evidence document for a rule must belong to a `T1` source registered for
  the same country, and the rule's official URL must share that source's
  origin. Requirement facts may come from any tier; non-T1 evidence is labelled
  "not an official (T1) source" in the UI.
- Public visibility: a rule needs `reviewed` status AND a currently `verified`,
  currently `T1` evidence source; a requirement fact additionally needs its own
  evidence source `verified`. Evaluated on every read (RLS), so un-verifying a
  source hides the content immediately.
- `/immigration` and `/immigration/[id]` always show the disclaimer
  "Thông tin nghiên cứu, không phải tư vấn di trú" (research information, not
  immigration advice) and links to the registered T1 immigration authorities.
  A conflict banner is shown when any requirement is `conflicted`.
- New permission `immigration.manage` (propose); reviewing uses `facts.review`.
- Details: `docs/architecture/slice-06-immigration.md`,
  `docs/learning/slice-06-immigration.md`.

### 2026-09-23 — UI design system (Apple-HIG-inspired)

Implements the "UI / Visual Design Direction" section above; no rule there is
changed.

- Design tokens (canvas, surface, ink levels, hairline, one accent, semantic
  positive/caution/critical) in `apps/web/app/globals.css`, with light and dark
  mode. System font stack (SF Pro on Apple devices) replaces the Geist Google
  Font, so no web-font download.
- Shared components in `apps/web/components/ui/` (large-title page header,
  inset grouped list rows, badges, notices, disclosure, form fields). Lists use
  one grouped surface with hairline separators, three text levels, a chevron
  for navigable rows, and details behind disclosures.
- "Reviewed" evidence uses the accent colour, never green, so it is not read as
  verified truth (AGENTS.md Section 15).
- No new dependency. Details: `docs/learning/ui-design-system.md`.
- Update (same day): lists are server-paginated (25 per page) with a name/title
  search box and URL-held state; workspace lists open on the "needs action" tab
  of an iOS-style segmented control; list rows are compact and link to detail
  pages (`/sources/[id]`, `/universities/[id]` added). Search is substring
  matching only; PostgreSQL full-text search remains Slice 7.

### 2026-09-25 — Slice 6b labour market (recommendations accepted)

- `occupations` holds identity only: name, optional classification
  (`ISCO-08` / `ESCO` / `national` / `other` + code, recorded only when the
  source states it; both or neither), optional country scope, document +
  excerpt. No seed rows.
- No `labour_market_items` table: salary, vacancy and other figures are facts
  linked by `facts.occupation_id`. New `facts.reference_period`
  (`YYYY`, `YYYY-Qn`, `YYYY-Hn`, `YYYY-MM`) states the measured period,
  distinct from `valid_from`/`valid_until`. An occupation figure must have a
  country.
- Public visibility: occupation reviewed AND the figure's own evidence source
  registry-`verified`. Non-T1/T2 figures are labelled "not official
  statistics". Figures are presented as past-period research data, not
  forecasts or advice.
- New permission `labour.manage` (propose); reviewing uses `facts.review`.
- Job postings, employers and skills remain out of scope.
- Details: `docs/architecture/slice-06b-labour-market.md`,
  `docs/learning/slice-06b-labour-market.md`.

### 2026-09-26 — Slice 7 search and country comparison (recommendations accepted)

Search (Section 2.11, still PostgreSQL only):
- STORED generated `search_vector` columns (config `simple`) with GIN indexes on
  countries, sources, documents, universities, programmes, immigration rules,
  occupations and facts.
- Accent folding by an IMMUTABLE `search_fold()` (`lower` + `translate`)
  instead of the `unaccent` extension, which is neither installed nor
  available to the test database.
- `search_public()` is SECURITY INVOKER and is called with an anonymous
  client, so results are exactly the public (RLS) view. `/search` groups
  results by type; the header links to it.

Comparison (Section 2.10):
- New admin-curated `comparison_metrics` (definitions only, no seed rows;
  permission `metrics.manage`; key and category immutable after creation;
  edits audited) and `facts.metric_id` (requires a country).
- `/compare` accepts 2–5 countries and shows: a metrics table (every public
  value per cell with source, tier, period and date, conflicts marked),
  immigration rules by type, figures of one chosen occupation, and counts of
  reviewed education entries. No aggregation, normalisation, score or
  ranking.
- Details: `docs/architecture/slice-07-search-comparison.md`,
  `docs/learning/slice-07-search-comparison.md`.

### 2026-09-27 — Slice 8 research workspace (recommendations accepted)

- First user-private data. Tables `research_projects`,
  `research_project_countries`, `saved_items`, `notes`, `user_plans`,
  `user_plan_countries`; owner-only RLS on all of them (no anon access, no
  admin read path, no SECURITY DEFINER bypass). Owners may edit/delete freely.
- Bookmarks and note targets use one real FK per kind (country, university,
  programme, immigration rule, occupation, source), exactly one (bookmark) or at
  most one (note) set; only publicly visible items can be attached.
- `user_plans` = My Europe Plan (one per user); `personal_plans` merged into
  `research_projects`. Optional budget: amount + ISO currency + period,
  all-or-nothing, never used in calculations.
- Personal data cascades on account deletion; `delete_my_workspace()` lets the
  owner wipe it (typed confirmation).
- Plan page offers filtered **shortcuts** labelled as not recommendations; no
  recommendation engine.
- Details: `docs/architecture/slice-08-research-workspace.md`,
  `docs/learning/slice-08-research-workspace.md`.

### 2026-09-25 — Slice 9 crawler (recommendations accepted)

- **Scope**: the crawler fetches only URLs registered in `crawl_targets`
  (`/admin/crawler`, new permission `crawler.manage`) for sources that are
  verified + crawl policy approved + crawl enabled. A sitemap target is
  filtered by path prefix and capped at 100 URLs; sitemap indexes and in-page
  links are not followed. The database re-checks every recorded URL
  (`crawler_url_not_registered`), and switching a source off stops recording
  immediately.
- **Credentials**: replaces the planned service-role key (Sections 4 and 16
  text kept). The worker logs in as an operator-created role that is a member
  of `nordic_crawler_ops` only: no table privileges, EXECUTE on
  `crawler_start_run`, `crawler_due_targets`, `crawler_url_states`,
  `crawler_record`, `crawler_finish_run`. The password lives only in the
  GitHub secret `CRAWLER_DATABASE_URL`, never in the repository or Vercel.
- **Behaviour**: robots.txt respected (`NordicResearchBot`), one request at a
  time, 5 s per-domain delay, 2 retries, 2 MB / 30 s limits, HTML/XML only, no
  cross-domain redirects, conditional requests (ETag / Last-Modified), honest
  User-Agent. Weekly schedule + manual trigger (`.github/workflows/crawler.yml`).
- **Change detection**: crawled documents use `hash_method = sha256-text-v1`
  (SHA-256 of NFC-normalised, whitespace-collapsed extracted text) so rotating
  tokens do not create versions. Same hash → no new document (`unchanged`);
  304 → `not_modified`. Every fetch is logged in `crawler_runs` /
  `crawler_run_items`.
- **Text storage**: extracted text is kept privately in `document_texts`
  (editors only), never published (Section 9 / AGENTS.md 8).
- **Published facts on change**: when a new version of the evidence page is
  recorded, reviewed/conflicted facts stay public with a visible warning
  (`facts.source_changed_at`, link to the new version) and appear in the
  "Nguồn đã đổi" queue. A reviewer records `revalidated` or `rejected`
  (`resolve_source_change`, history in `fact_reviews`). Nothing is decided
  automatically; no AI is involved (Slice 10).
- Details: `docs/architecture/slice-09-crawler.md`,
  `docs/learning/slice-09-crawler.md`, `crawler/README.md`.

### 2026-09-28 — Slice 10a AI extraction of candidate facts (recommendations accepted)

- **Order**: AI extraction first; embeddings / semantic search / RAG (spec
  Slice 10 "pgvector/RAG") deferred to Slice 10b so that retrieval later works
  on reviewed facts.
- **Provider**: any OpenAI-compatible Chat Completions endpoint; first provider
  Google Gemini free tier (model id in the `LLM_MODEL` variable). Only public
  page text from `document_texts` is sent; on the free tier the provider may use
  inputs to improve its products, so no user data, notes or workspaces are ever
  sent.
- **Runtime**: separate `extractor/` worker in GitHub Actions (daily + manual),
  connecting as a login role that is a member of `nordic_extractor_ops` only (no
  table privileges; EXECUTE on six `extractor_*` functions). No LLM key or
  extractor credential in Vercel.
- **Scope**: only documents an editor explicitly requests
  (`extraction_requests`, permission `facts.propose`, one open request per
  document, cancellable).
- **Limits**: 5 documents per run by default (max 10), text cut at 50 000
  characters on a line break, at most 30 proposals per document, retries with
  Retry-After on 429/5xx.
- **Validation in the database**, first failure recorded as the reason: topic
  from a fixed list (`extraction_topics()`), required lengths, excerpt 20–500
  characters and verbatim in the page (NFC, case, whitespace and digit
  separators normalised), known country slug, ISO dates that exist, reference
  period format, every number in value/unit and the year of any date or period
  present in the excerpt, no duplicate (same document, subject, predicate,
  value), cap of 30.
- **Language**: subject/predicate in English (as existing facts); value and
  excerpt in the page's own language.
- **Links**: AI sets only the country. Universities, programmes, rules,
  occupations and metrics are linked by a reviewer.
- **Attribution**: facts get `origin = 'ai'`, `ai_model`, `ai_confidence`
  (self-reported, labelled "mô hình tự đánh giá"); created by the account set
  in `/admin/extraction` (`roles.manage`), which must hold `facts.propose` and
  must not hold `facts.review`. The AI origin stays visible after review.
- **Audit**: `extraction_runs` (provider host, model, prompt version, tokens),
  `extraction_items` (every candidate, outcome, reason, raw JSON), visible to
  editors in `/admin/extraction`.
- The static "Extraction not started" label on document pages was removed
  (`documents.extraction_status` stays `not_started` by constraint; extraction
  state lives in `extraction_requests`).
- Details: `docs/architecture/slice-10a-ai-extraction.md`,
  `docs/learning/slice-10a-ai-extraction.md`, `extractor/README.md`.

### 2026-09-28 — Verified TLS for worker database connections

- Crawler and extractor connect with TLS verified against Supabase's root CA
  (`DATABASE_CA_CERT`, PEM, GitHub secret), handled by
  `packages/db/src/pg-ssl.ts`. Certificate verification is never disabled;
  without the CA the worker logs a warning. Found when the extractor failed with
  "self-signed certificate in certificate chain" using `sslmode=require`.

### 2026-09-28 — LLM response-format fallback

- Gemini's OpenAI-compatible endpoint answered HTTP 400 INVALID_ARGUMENT to the
  strict JSON-schema request. The extractor now falls back (only on 400) to a
  basic schema and then to plain JSON mode, and records the mode used.
  Candidates are validated in the database regardless of mode. Prompt version
  `extract-v2`.

### 2026-09-29 — Slice 10b (pgvector / semantic search / RAG) postponed

Decided by the project owner after reviewing the Slice 10b plan.

- **Status**: postponed, not cancelled. Nothing from Slice 10b is built: no
  `vector` extension, no embeddings table, no embedding provider, no
  question-answering page. Search stays PostgreSQL full-text (Slice 7).
- **Why**:
  - Not required by the MVP scope (Section 15): "Search" is met by Slice 7,
    and "advanced RAG" is listed under Defer.
  - Almost no public (reviewed) records exist yet, so semantic search or RAG
    would have nothing meaningful to retrieve.
  - It adds cost and risk before it adds value: a second AI provider and key
    in Vercel, users' search queries sent to a third party (conflicts with the
    Slice 10a rule that no user data is sent to a free-tier provider), and AI
    answers about immigration rules.
- **Current priority instead**: confirm Slice 10a end to end, verify the
  registered sources, review the pending Swedish proposal batch, grow reviewed
  data with the existing crawler + extraction pipeline, and deploy the MVP.
- **Revisit when**: there is a substantial body of reviewed public records
  and real user feedback shows full-text search is not enough. Before
  building, re-confirm the open decisions from the plan: which provider embeds
  users' queries (and whether it may train on them), who may use semantic
  search, and whether RAG is in scope.

### 2026-09-29 — UI language: Vietnamese now, language switch later

Decided by the project owner.

- **Now**: every user-facing string in the web app is Vietnamese — public
  pages, workspaces, admin, errors, empty states. Until now public pages were
  English and workspaces Vietnamese, often mixed on one page.
- **Not translated**: content that comes from a source (names of countries,
  universities, programmes, rules and occupations as the source writes them;
  evidence excerpts; values), and codes users may need to match against a
  source (T1–T4, SSYK/ISCO codes, ISO dates).
- **Plain language**: internal codes are never shown raw (`needs_verification`,
  `reviewed`, UUIDs, permission keys). Shared terms are defined once — the
  glossary in `docs/learning/ui-design-system.md` — and shared labels live in
  the domain modules (e.g. `tiers`, `verificationLabel`), not in components.
- **Later (not scheduled)**: a Vietnamese/English language switch. To keep that
  cheap, new shared labels go into those domain modules rather than inline
  text, so they can move into per-language dictionaries in one step. Open
  questions for that work: routing (`/en/...` vs cookie), which language the
  AI-extracted `subject`/`predicate` (English today) is shown in, and whether
  the User Guide is translated.
- **UI redesign order** (agreed with the owner): 0 language + glossary;
  1 review forms and public-visibility feedback; 2 guidance for reviewers;
  3 public pages; 4 admin pages. Visual direction unchanged: Apple-HIG-inspired
  and as clear as the `/dashboard` overview.

### 2026-10-02 — Operational details on public pages: editors only

Decided by the project owner.

- **Hidden from visitors** (anyone without an editing or admin area,
  `seesInternalDetails()` in `apps/web/lib/rbac/ui.ts`): a source's crawl state,
  crawl policy, crawl frequency and last crawl date; its authority notes and
  internal notes; a fact's AI origin and model ("Trích bởi AI, đã qua người
  duyệt · <model>"); the "Đã duyệt bằng chứng" badge (every fact a visitor sees
  is reviewed); a country's research status.
- **Supersedes** the Slice 10a line "The AI origin stays visible after review":
  the AI origin is still stored (`facts.origin`, `ai_model`) and shown to
  editors on public pages and in the workspaces, but no longer to visitors.
- **Still shown to everyone** (AGENTS.md §1.5, §12, §23): source name, URL and
  tier, verification and retrieval dates, review date, validity, the
  "Có mâu thuẫn" badge, "not official" notes and the changed-source warning.
- This is display only. RLS and page permissions are unchanged.

### 2026-10-02 — Field-of-study focus for education data (PROPOSED, not approved, not built)

Raised by the project owner: study research should cover universities and
programmes broadly, but be organised by field, so a user can look only at what
they care about — e.g. IT and programmes leading to product owner / project
manager (PO/PM) roles. Analysis and proposal below; nothing here is decided
until the owner approves it and the open questions are answered.

**What exists today (gap analysis)**

- `programmes.field` is free text copied from the source; `/programmes` only
  filters "field contains …". There is no field taxonomy, so "all IT
  programmes" cannot be listed reliably, and "PO/PM" is not a field at all.
- Universities and programmes are entered by editors by hand (Slice 5). AI
  extraction (Slice 10a) proposes facts only and links nothing but the country.
- The crawler re-fetches registered URLs only: sitemap targets are capped at
  100 URLs, in-page links are never followed (Slice 9). It was not designed to
  discover whole programme catalogues.
- `user_plans` stores target degree and role, not fields of interest.

**Proposal**

1. *(Superseded 2026-10-03 — see "Open taxonomy" below.)* *Scope by focus, not "everything".* Each programme still needs a human
   review (AGENTS.md §1.3), and one country lists thousands of programmes.
   Collect programmes only in focus fields chosen by the owner (initially IT
   and PO/PM-related), and widen later. Every programme still requires its own
   evidence document and excerpt (Slice 5).
2. *Two kinds of classification, never mixed up* (AGENTS.md §15):
   - **Official field of study**: ISCED-F 2013 (UNESCO) codes — e.g. the
     "06 Information and Communication Technologies" family and "0413
     Management and administration". Codes and names to be seeded from the
     official ISCED-F 2013 document after verification, not from memory.
   - **Nordic focus tags** (product-defined, labelled as Nordic's grouping, not
     official): e.g. "Quản lý sản phẩm / dự án (PO/PM)". Each tag has a written
     inclusion rule decided by the owner (e.g. the programme page states
     project/product management as a core subject), stored with the tag.
   A programme may have several codes/tags. Assignments live in a join table
   (programme ↔ field/tag) with evidence (excerpt from the programme page),
   who assigned it and review status — the free-text `field` stays as the
   source's own wording.
3. *Who classifies.* An editor proposes; a reviewer approves (same rules as
   facts). Later, AI may *propose* a classification with a verbatim excerpt,
   never assign one silently (AGENTS.md §9).
4. *Discovery (later phase).* Per country, research and register official
   programme catalogues (national admissions/study portals, university
   catalogue pages) source by source (Section 18) — no URL is guessed. Extend
   AI extraction to propose **programme candidates** (name, university, degree,
   language, URL, excerpt) from crawled catalogue pages, filtered to the focus
   fields; out-of-scope candidates are recorded as such, not silently dropped.
   Secondary portals (e.g. Hotcourses, T3) may hint at a programme, but the
   programme is confirmed on the university's own page (Section 7).
5. *User side.* Fields of interest in "Kế hoạch châu Âu" (user_plans), a field
   filter on `/programmes` and on the country page's study card, and plan
   shortcuts such as "Chương trình CNTT ở Thụy Điển" — labelled as a filter
   by the user's choice, not a recommendation (AGENTS.md §15).

**Applying one field list to every university** (approach approved by the
owner on 2026-10-02; the list's content is still a draft, see below)

Universities name and group programmes differently, so the owner's list is a
**Nordic-controlled vocabulary**, never matched against programme names
directly. Four layers:

1. *Category definitions* (owner-provided): display name, definition,
   **inclusion criteria**, **exclusion criteria**, search keywords (English
   plus the local languages), related ISCED-F codes, and a version number.
   The criteria — not the name — decide membership, so two reviewers reach
   the same result for the same programme.
2. *Keywords only find candidates.* They select programmes worth looking at;
   a reviewer decides against the criteria after reading the programme page,
   and records the deciding excerpt. A name that merely sounds right is never
   enough.
3. *Per-source crosswalk.* Most catalogues already group programmes (faculty,
   subject area). For each registered catalogue source, a reviewer maps the
   source's own groups to Nordic categories once (or marks a group "decide per
   programme" when it is ambiguous). New programmes from that source then get
   a *suggested* category; a reviewer still confirms each one. How each source
   groups programmes is checked on that source when it is registered, never
   assumed.
4. *Versioned categories.* Changing a category's criteria creates a new
   version; assignments made under an older version are listed for re-review
   instead of being silently re-labelled.

Draft definitions (IT with subcategories; PO/PM; Business Analysis) —
written by Claude for the owner to edit, not yet approved:
`docs/data/field-taxonomy-draft.md`.

**Suggested phasing**

- Phase 1: taxonomy (ISCED-F subset + owner-defined focus tags), manual
  classification by editors with review, `/programmes` field filter, fields of
  interest in the plan. Needs one migration; no crawler change.
- Phase 2: AI proposes classifications for existing programmes (reviewed).
- Phase 3: programme discovery from registered catalogues (crawler + AI
  programme candidates). Changes Slice 9/10a rules (sitemap cap, candidate
  type) and needs its own decision.

**Owner answers (2026-10-03)** — supersede the matching open questions below:

- Categories: **IT** (with subcategories from the start), **PO/PM**, and a new
  **Business Analysis** category.
- PO/PM counts **only IT** projects/products; project management in other
  domains is excluded.
- Degree levels: **Master's and above** (`master`, `phd`) only.
- Search keywords: **English only**.
- Draft 0.2 of the definitions: `docs/data/field-taxonomy-draft.md`; the owner
  still confirms the Business Analysis definition and the IT subcategories,
  and ISCED-F codes are verified against the official document in Phase 1.

**Open questions for the owner** (as first written; see answers above)

1. Exact focus list for Phase 1: which ISCED-F codes, and the written
   inclusion rule for the PO/PM tag (which programmes count, which do not).
2. Degree levels in scope (Master's only, as in Section 1, or Bachelor's too).
3. Which official catalogue sources per country to research first (manual
   research task; nothing inferred).
4. Review capacity: how many programme proposals per week reviewers can
   handle — this sets how fast discovery may run.
5. Whether a programme outside the focus fields that is already in Nordic
   stays visible (recommended: yes, just unclassified).


### 2026-10-03 — Open taxonomy: every field of study and every career path (owner direction; PROPOSED design)

The owner wants the system built for **all** fields and careers: whatever a
user filters for, the matching universities and programmes should be findable.
IT and PO/PM were only the first examples, not the limit. This supersedes
"Scope by focus" in the 2026-10-02 entry; the four-layer approach, the
evidence and review rules, Master's-and-above and English-only keywords stay.

**Design changes**

1. *Full field-of-study backbone.* The whole **ISCED-F 2013** hierarchy (broad
   → narrow → detailed fields) is the official dimension, so every programme
   has a place. The list is imported from the official UNESCO document and
   checked before use; nothing is written from memory. A programme is
   classified at the most detailed level its page supports.
2. *Career paths as a second, separate dimension.* "PO/PM", "Business Analyst",
   "Data Analyst"… are **career paths** (Nordic-defined, labelled as such, AGENTS.md
   §15), not fields of study. Each has a definition, inclusion/exclusion rules
   and English keywords (same format as the draft), unlimited in number, and
   may later be linked to occupations (ISCO-coded where the source states it)
   so programmes connect to labour-market data. A programme may match several
   fields and several career paths, each with its own evidence.
3. *Taxonomy managed in the app.* Admins add, edit (new version) and retire
   fields and career paths on an admin page (proposed permission
   `taxonomy.manage`); no migration or developer is needed to add a career.
   ISCED-F entries are imported once and only changed if UNESCO changes them.
4. *Scale needs assisted classification early.* Classifying every programme by
   hand is not feasible, so the per-source crosswalk and AI-proposed
   classifications (always reviewed, with an excerpt) move into the core plan
   instead of "later". Coverage grows source by source (registered catalogues),
   not field by field.
5. *Search and filters.* `/programmes` and `/universities` filter by field
   (tree with search) and by career path; a university matches when it has a
   reviewed, classified programme in that field. Unclassified programmes stay
   visible in normal lists and are never shown as belonging to a field.

**Revised phasing** (details: `docs/architecture/field-taxonomy-phase1-plan.md`)

- Phase 1: taxonomy tables (fields + career paths), ISCED-F import from the
  verified document, admin page for career paths, manual classification with
  review, filters, fields/careers of interest in "Kế hoạch châu Âu".
- Phase 2: per-source crosswalk + AI-proposed classifications (reviewed).
- Phase 3: programme discovery from registered catalogues (crawler + AI
  programme candidates); needs its own decision on Slice 9/10a limits.

**Owner answers (2026-10-03, later the same day)**

- Career paths are managed only by holders of a new permission
  `taxonomy.manage`: complete administrator roles receive it through the
  migration (same rule as earlier permissions), and an admin can grant it to
  any other role on the access page.
- No career path is decided in chat or seeded by migration: the owner creates
  and adjusts every career path on the admin page. PO/PM and Business Analysis
  in the draft are only examples of the format.

**Open questions for the owner**

1. ~~Who may manage career paths~~ — answered above.
2. ~~Which career paths to define first~~ — answered above (owner, in the UI).
3. Review capacity per week (sets how fast coverage can grow).
4. Which countries / catalogue sources to start with.
