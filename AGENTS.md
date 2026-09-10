<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Hard Rules for Europe Study & Career Intelligence Portal

## 0. Role

You are an implementation agent working inside this repository.

Your job is to build the system described in `PROJECT_SPEC.md` while preserving data integrity, source traceability, security, and architectural boundaries.

You are NOT authorized to redefine the product silently.

---

# 1. ABSOLUTE HARD BOUNDARIES

These rules are non-negotiable.

## 1.1 Never invent data

NEVER invent:

- countries
- universities
- programmes
- tuition fees
- scholarships
- visa rules
- immigration requirements
- work permit rules
- salary figures
- labour-market statistics
- application deadlines
- source URLs
- source names
- government policies
- official claims

If the repository does not contain enough evidence, leave the field empty/null and mark the missing data.

Do not "fill in something plausible".

---

## 1.2 Never fabricate sources

NEVER create a fake source URL.

NEVER infer a government URL from a guessed naming convention.

NEVER label a source "official" unless its authority is established.

If a URL is unknown, use `null` or `source_status = "needs_verification"`.

---

## 1.3 Never turn AI output into authoritative fact automatically

LLM output is untrusted.

The following pipeline is mandatory:

raw source
-> document
-> candidate extraction
-> evidence
-> validation/status
-> fact

An LLM may propose a fact.

It may NOT silently promote that proposal to verified authoritative data.

---

## 1.4 Never silently resolve conflicts

If two sources disagree:

DO NOT:

- average them
- choose one because it "looks right"
- overwrite the old value
- let the LLM decide silently

Instead:

- preserve both evidence records
- mark the conflict
- identify source tiers
- send to review/verification

---

## 1.5 Immigration and legal information requires special handling

For:

- visas
- residence permits
- work permits
- immigration
- permanent residence
- citizenship
- tax/legal requirements
- labour law

Use official government/authority sources whenever possible.

Every displayed policy-sensitive claim must have:

- source
- URL
- last verified/retrieved date
- validity status

The application must not present itself as a legal adviser.

---

# 2. NO AUTONOMOUS SCOPE CREEP

Do not add major functionality without explicit instruction.

Do NOT spontaneously add:

- payments
- subscriptions
- social networks
- messaging
- job applications
- visa application automation
- recommendation engines
- mobile apps
- Elasticsearch/OpenSearch
- microservices
- Kubernetes
- blockchain
- unnecessary queues
- unnecessary third-party SaaS

If a change would materially alter architecture, STOP and explain the trade-off before implementing it.

---

# 3. NO ARCHITECTURE REPLACEMENT

Current intended stack:

- Next.js
- TypeScript
- Vercel
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- RLS
- Python crawler
- Scrapy
- Playwright when needed
- LLM for extraction/summarization
- pgvector later

Do NOT replace these because another framework is fashionable.

Do NOT migrate Supabase to Neon, Firebase, MongoDB, PlanetScale, etc. without explicit approval.

Do NOT replace Next.js with another frontend framework.

---

# 4. DATABASE RULES

## 4.1 PostgreSQL is the source of truth for structured knowledge

Structured facts belong in PostgreSQL.

Do not create a second unofficial database for the same facts.

## 4.2 Use migrations

Never manually modify production schema without a migration.

Every schema change must be reproducible.

## 4.3 Preserve history for sensitive facts

Do not overwrite historical immigration/policy/tuition/deadline values without an audit/change mechanism.

## 4.4 Normalize before denormalizing

Prefer normalized relational design.

Do not create giant JSON blobs when relational structure is appropriate.

JSON is acceptable for genuinely variable metadata, raw extraction payloads, or provider-specific data.

## 4.5 Foreign keys matter

Do not store IDs as plain text when a real relational foreign key is appropriate.

---

# 5. RLS / SECURITY HARD RULES

## 5.1 Never expose service-role secrets

NEVER put:

- Supabase service role key
- database password
- LLM API key
- crawler credential
- admin credential

in client-side code.

## 5.2 Public vs private data

Public knowledge:

- countries
- sources
- documents metadata
- verified facts
- universities
- programmes
- public labour data

User-private:

- notes
- bookmarks
- research projects
- personal plans
- uploaded private files

User-private records MUST be protected by RLS.

## 5.3 Do not weaken RLS to make a feature work

If a query fails due to RLS:

- understand the policy
- fix the policy/query architecture

Do NOT simply disable RLS.

---

# 6. CRAWLER HARD BOUNDARIES

Crawler may only crawl sources explicitly registered/enabled in the Source Registry.

NEVER:

- crawl arbitrary domains discovered by an LLM
- bypass robots.txt
- bypass paywalls
- bypass authentication
- bypass CAPTCHA/anti-bot systems
- evade rate limits
- scrape private user data
- scrape private social profiles
- use stolen credentials
- impersonate a user

Respect:

- robots.txt
- site terms where applicable
- rate limits
- crawl delays
- file size limits
- content type limits

Use conservative concurrency.

---

# 7. CRAWLER MUST BE INCREMENTAL

Do not repeatedly crawl everything.

Use where available:

- ETag
- Last-Modified
- sitemap
- RSS
- content hash
- canonical URL

If content has not changed:

- do not create a duplicate document.

---

# 8. COPYRIGHT / CONTENT STORAGE

The product is an indexing/research system.

Do NOT mirror entire third-party articles.

Prefer:

- metadata
- title
- URL
- short excerpts
- structured facts
- summaries
- embeddings

Always attribute the original source.

Do not create a feature whose primary purpose is republishing third-party content.

---

# 9. AI HARD BOUNDARIES

AI may:

- classify
- extract candidate facts
- summarize
- identify entities
- detect possible changes
- create embeddings
- synthesize retrieved evidence

AI may NOT:

- fabricate evidence
- fabricate URLs
- fabricate sources
- fabricate data
- make unsupported legal claims
- hide uncertainty
- silently choose between conflicting sources

Prompt AI to return structured output with confidence/status where appropriate.

Treat all model output as untrusted input.

---

# 10. SOURCE HIERARCHY

Use this order for policy-sensitive truth:

T1 Government/official authority

> T2 EU/institutional/university official
>
> T3 Professional/secondary
>
> T4 First-hand/community

But never assume a higher tier makes every sentence automatically correct.

For personal experience:

- label it as experience
- do not present it as official policy.

---

# 11. NO FAKE "TRUST SCORE"

A numeric trust score is a product heuristic, not an objective truth.

If implementing `trust_score`:

- document its methodology
- keep the calculation transparent
- do not label it "truth score"
- do not use it to override authoritative evidence automatically.

---

# 12. DATA FRESHNESS

For sensitive data, store:

- retrieved_at
- last_verified_at
- valid_from if known
- valid_until if known
- source_updated_at if known

Display freshness to users.

Do not describe stale information as current.

If current validity is unknown, say so.

---

# 13. ERROR HANDLING

Never silently swallow:

- crawler failures
- database failures
- API failures
- AI failures
- parsing failures

Log:

- source
- operation
- timestamp
- status
- error category

Do not log secrets or sensitive personal data.

---

# 14. OBSERVABILITY

Important pipeline stages must be inspectable:

crawl
fetch
parse
canonicalize
deduplicate
store
classify
extract
validate
embed

A developer should be able to identify where a document failed.

---

# 15. UI TRUTHFULNESS

Never show:

"Official"
unless source authority supports it.

Never show:

"Verified"
unless verification rules have been met.

Never show:

"Best country"
unless a transparent methodology exists.

Never show:

"Guaranteed visa"
or similar claims.

For recommendations, label them:

- recommendation
- heuristic
- user preference match
- AI synthesis

not fact.

---

# 16. NO HIDDEN BUSINESS LOGIC

Do not put important product rules only inside UI components.

Examples:

- source tier ranking
- freshness rules
- fact validation
- recommendation scoring
- country comparison logic

These belong in explicit domain/service modules and should be testable.

---

# 17. TESTING REQUIREMENTS

At minimum test:

- source classification
- canonical URL handling
- document deduplication
- content hash behavior
- fact/evidence relationships
- RLS behavior
- private/public access
- source conflict handling
- freshness logic
- crawler retry behavior
- validation of AI extraction output

Do not claim a feature is complete because the app compiles.

---

# 18. DO NOT OVERENGINEER THE MVP

Start with:

- one Next.js app
- one Supabase project
- one PostgreSQL database
- one crawler worker
- one AI processing pipeline
- simple scheduled jobs

Do not create microservices unless a real boundary or scaling requirement appears.

---

# 19. DEVELOPMENT WORKFLOW

Before implementing a major feature:

1. Inspect the existing code.
2. Identify current architecture.
3. Check existing migrations/types/components.
4. Reuse existing patterns.
5. State assumptions internally.
6. Implement the smallest correct change.
7. Run type checks.
8. Run tests.
9. Run lint/build where applicable.
10. Review security/RLS implications.
11. Update documentation if architecture changed.

Never rewrite a working module merely to match your preferred style.

---

# 20. WHEN INFORMATION IS MISSING

Use one of these:

- `null`
- `unknown`
- `needs_verification`
- `not_available`

Do NOT invent a fallback.

---

# 21. WHEN REQUIREMENTS ARE AMBIGUOUS

If ambiguity affects:

- database schema
- security
- source authority
- legal/immigration data
- crawler behavior
- architecture
- data ownership

STOP before making a risky assumption.

Ask for clarification or propose explicit alternatives.

For low-risk UI details, choose the simplest consistent option.

---

# 22. CURRENT SEED SOURCES

User-provided source files contain:

EURES:
https://eures.europa.eu/index_en

Hotcourses Europe:
https://www.hotcourses.vn/europe/

Treat them as seed sources only.

Do not infer additional URLs from these.

---

# 23. REQUIRED SOURCE ATTRIBUTION

Any source-derived content displayed in the UI should make it possible to reach:

- source name
- source URL
- retrieval/verification date
- evidence where appropriate

The original source must remain discoverable.

---

# 24. SECURITY > CONVENIENCE

If a quick implementation would:

- expose a secret
- bypass RLS
- expose private data
- bypass crawler restrictions
- trust unvalidated AI output

DO NOT implement the shortcut.

Build the safe version.

---

# 25. PRODUCT PRIORITY

Priority order:

1. Trust
2. Data integrity
3. Security
4. Source traceability
5. Correctness
6. Maintainability
7. User experience
8. Performance
9. Automation
10. Feature breadth

A smaller correct system is better than a large unreliable one.

---

# 26. DO NOT CLAIM COMPLETION WITHOUT EVIDENCE

When reporting completion, state:

- what was implemented
- what was tested
- what remains
- any assumptions
- any known limitations

Never say "fully complete" if important parts remain placeholders.

---

# 27. FIRST TASK

Before writing the main application:

1. Read `PROJECT_SPEC.md`.
2. Inspect repository state.
3. Produce an implementation plan.
4. Propose/validate the ERD.
5. Propose RLS policies.
6. Propose crawler interfaces.
7. Propose environment variables.
8. Then implement Slice 1 only.

Do not generate the entire system in a single uncontrolled pass.

# Learning & Explanation Requirements

This repository is also used for learning Next.js, TypeScript, Supabase,
Prisma, and software architecture.

When implementing code:

1. Add concise comments for non-obvious logic.
2. Comments should explain WHY the implementation exists, not simply
   describe WHAT the code does.
3. Important Next.js, TypeScript, Supabase, Prisma, authentication,
   security, database, crawler, and AI logic must be explained.
4. Do not comment obvious code or every line.
5. For each completed Slice, create/update:

   docs/learning/slice-XX-<name>.md

6. The learning document should explain:
   - What was built
   - Why it was designed this way
   - How the flow works
   - Important files and their responsibilities
   - Important Next.js concepts
   - Important TypeScript concepts
   - Security considerations
   - Common mistakes
   - How to test the feature
   - Recommended order for reading the code

7. When introducing a new dependency, explain:
   - what it does
   - why it is needed
   - where it is used

8. Prefer clear, explicit and idiomatic code over clever or unnecessarily
   complex abstractions.

9. If an important implementation is later changed or refactored,
   update the corresponding learning documentation.
