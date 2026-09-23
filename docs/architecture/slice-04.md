# Slice 4 — evidence-backed proposals

## Boundary and ERD

Document -> Fact -> Evidence; Fact -> FactReview -> optional related Fact.
Country -> optional Fact. Documents continue linking to Source and original URL.
Prisma models mirror SQL tables; auth.users foreign keys are SQL-only.
No AI extraction, fetching, crawler, new dependency, environment variable or
invented factual content is introduced.

The initial workflow stores one immutable claim and one supporting excerpt from
one immutable document version, atomically. A different source can support a
separate proposal; conflict links retain both. Multi-evidence editing and merging
are intentionally deferred. No confidence score is fabricated. Source dates stay
on the document; unknown validity dates stay null.

## Status and verification

- proposed: editor-visible, not published.
- reviewed: reviewer checked evidence, publicly displayed with explicit unknown
  current validity. This is NOT verified truth or authoritative legal guidance.
- rejected: editor-visible, retained.
- conflicted: both claims remain public, explicitly unresolved.

Only proposed claims can receive the initial review/rejection. A reviewer can mark
a non-rejected pair conflicted later. Conflicts cannot silently be cleared in this
slice. Reviews are append-only with notes, actor and timestamp. Claim text and
evidence cannot be overwritten. A correction currently requires a new proposal;
there is no automatic supersession or conflict resolution.

A reviewer must read the original document and check the excerpt's fidelity,
scope, and source authority. An excerpt submitted by an operator is not
automatically validated against stored full text (Slice 3 stores hashes only).
A user holding both capabilities can propose and review; two-person approval is
not enforced. Tier is displayed, never automatically elevated.

## Authorization

facts.propose and facts.review are DB catalogue capabilities. Complete admin roles
(those already holding roles.manage and users.assign_roles) receive both through
the migration; other memberships are unchanged. Admin assigns them through RBAC UI.
No user/email is hardcoded.

RLS exposes only reviewed/conflicted claims and their evidence to anonymous users.
Editors/reviewers see all proposals and the review log. Authenticated users have
no direct table mutation privileges. SECURITY DEFINER RPCs use empty search_path,
fully qualified relations and auth.uid with the live has_permission check.
Permission checking holds the existing RBAC shared transaction lock; reviews
serialize on a separate advisory lock to avoid losing decisions. Public EXECUTE
is revoked. Failed evidence insertion or review validation rolls back all changes.

The public page explicitly filters published statuses even for editors. Review
notes and actor IDs are not rendered on the public page. Public metadata is not
private research workspace data. Database owners remain trusted operators.

## UI and operational limits

/docs is not a route: use /documents, /facts, /facts/workspace.
Document detail links to a preselected proposal form. Dashboard exposes the editor
workspace according to permissions. A deep-linked older document is fetched when
outside the latest 100 documents. Lists and review history show the latest 100;
pagination, per-fact permalink and multi-evidence editing are future extensions.

An out-of-range validity date is visibly flagged. An in-range date does not prove
freshness; the UI always says current validity is unverified. No legal advice,
official badge, inferred dates or synthetic seed facts.

## Update 2026-09-23 — conflicts require reviewed claims; education links

- Migration `20260923090000_fact_conflict_requires_review`: `review_fact` only
  pairs claims already `reviewed` or `conflicted` (error
  `facts_conflict_requires_review`). Previously two `proposed` claims could become
  public via `conflicted` without an evidence review. "A reviewer can mark a
  non-rejected pair conflicted" above now reads "a reviewed/conflicted pair".
- Migration `20260923100000_education` (Slice 5) recreates `propose_fact` with three
  optional trailing parameters: `p_university`, `p_programme`, `p_deadline_type`.
  Existing 10-argument callers are unaffected. See `slice-05.md`.
