# Recommendation workflow and offer facts — 2026-10-26

## Scope and identity

User authorized a normal visible recommendation workflow for Costco mail facts,
per-item offer periods on customer pages, minimum human effort, no database import,
and normal non-game/forum release after acceptance. No real goods publication.

Observed repository: sunshaoxuan/bobuy, local branch codex-regional-delivery,
HEAD and remote main 20db3b4e011e871fcea2954c0ccf4f8e7422b8a6.
Read-only SSH container inspection confirms production bobuy/*:20261025.2.
The existing uncommitted PLAN-64 module is already implemented under
/admin/recommendations and /recommendations, with navigation in App.tsx.
It is absent from deployed source. The stock-master screen is separate.

Existing worktree contained extensive PLAN-64 and AI-settings changes before this
task. Preserve them. This task extends the recommendation module only; it does
not claim authorship or acceptance of the entire previous worktree.

## Bounded change and acceptance

- Preserve the recommendation editor and manual draft/publication boundary.
- Recommendation facts stay independent of catalog stock and USD selling prices.
- Optional string item numbers and JPY price/discount/unit fields preserve unknowns.
- Per-item offer/redemption and coupon-issue date pairs, notes, inclusive Japan dates.
- Visible JSON paste with strict validation, review queue, official Costco image URL
  or matching local file; correction, retry, dedup, saved-item edit and draft preview.
- Existing owner scope, image decoding limits and optimistic version protection.
- V9 is additive/nullable; original V7/V8 migration files remain unchanged.

Required: affected backend/frontend tests and build, real existing shared local UI
checks (entry, batch validation/preview/edit/save, customer periods, no end/start,
expired/upcoming/cross-Japan-midnight, per-item exceptions, mobile), PostgreSQL V9
migration/restore verification, and production release guards before publication.

## Current execution

Existing bobuy-local backend/web/postgres containers were found running. Initial
sandbox Docker access failed; authorized read-only elevated inspection succeeded.
No environment, container or image was created by this task.
Maven default sandbox access to its existing registry failed; elevated compile,
focused tests and package succeeded. No permission request remains pending.

## Formal UI data contract

Batch: JSON array, maximum 200 rows. `name` and an image reference are required.
Use `imageUrl` for HTTPS cds2.costcojapan.jp/cds/mail-images/ images, or
`fileName` matching a file selected with the normal file picker. Prices are JPY.
`itemNumber` must be a string (e.g. `"001234"`), or omitted/null.
Optional: `referencePrice`, `originalPrice`, `discountAmount`, `priceUnit`,
`offerStart`, `offerEnd`, `couponStart`, `couponEnd`, `offerNotes`.
Dates: YYYY-MM-DD. Missing facts stay null; no whole-issue dates are inferred.
`offerStart`/`offerEnd` describe offer/redemption; coupon dates describe issue only.
Use notes for additional conditions, exceptions and source language.

Previewing never writes. Registering writes a draft; publication is a separate
explicit action after title/body review. Same post + exact string code + image
hash reuses its existing row; different images remain separate. A missing code
deduplicates only the identical image within the same post. Separate issues retain
separate facts. No inventory product is created or repriced.

## Actual validation and remaining release work

- PASS: `mvn -f backend/pom.xml -Dtest=RecommendationIntegrationTest,RecommendationSourceImageTest test`:
  10 tests, zero failures/errors. Covers owner isolation, publication boundary,
  stale edits, retries, exact dedup, unknown facts, leading-zero string codes,
  separate periods/units, invalid date/code rejection and no catalog writes.
- PASS: two affected frontend test files, 10 tests. Includes Japan midnight and
  inclusive end-date status, missing facts, numeric-code/foreign-currency rejection.
- PASS: final frontend i18n (909 keys), TypeScript and Vite build; backend package;
  Git whitespace check. Existing bundle-size advisory remains.
- PASS: V9 applied to a snapshot clone in the existing PostgreSQL; counts preserved,
  invalid date ordering rejected, original snapshot restored and verified, temporary
  database removed. Backup is ignored at `.task-tmp/offer-before-migration.dump`.
- PASS: real Chrome UI at http://127.0.0.1:18080, normal seeded login, visible menu,
  JSON validation, local-image matching, pending preview without writes, six-row
  registration, exact duplicate replay, saved-item edit/error correction/reload,
  customer single-ended/unknown/expired/upcoming/individual exception and coupon
  dates. See `evidence/recommendation-offers/ui.json`.
- PASS: final desktop 1440px/mobile 390px offer layout: all offer facts outside the
  bounded image overlay, no clipping or horizontal overflow, final card scrolls
  above mobile navigation. See `visual.json` and customer screenshots. Synthetic
  post 10 is withdrawn and labelled; its draft remains only in the shared local DB.
- Browser page errors and console errors: zero. Physical phones were not tested.
  Official remote-image fetching has rejection tests but its real network-positive
  path has not been verified; the tested normal file-picker path is available.

A frontend translation edit initially removed old recommendation resource entries.
They were restored from the preserved original local web bundle, retaining the four
original language dictionaries. A subsequent visual inspection found the new facts
could overflow the existing photo overlay. The final layout places facts below the
photo and passed focused display verification. Only affected checks were repeated;
the successful backend/migration/full editor workflow evidence was reused.

Existing shared container identities remain
`43ca83656253986defaec64cd35b03c19b0aa68aa0d9331515f1284a19bc774f`
(backend) and `039231e225710aa49b66b32adb07664c803c1686e839a6fd13687c3d4467f8ef`
(web). Existing images were not rebuilt: tested JAR/static files were copied into
those same containers after preserving their previous files in `.task-tmp/offer-*`.
Normal Flyway startup applied V9; startup skipped reseeding existing data. Image
tags alone therefore do not identify this local hot-update candidate.

**Publication status: pending, not denied or attempted.** No new commit, push,
production migration or production content publication occurred. Production still
serves 20261025.2. The complete candidate depends on the pre-existing uncommitted
PLAN-64 recommendation/AI settings/security/encryption worktree, whose own report
records a failed full coverage gate. This task's focused PASS does not establish
that whole candidate's release acceptance or override that gate. The owning release
task must reconcile that candidate and its necessary release checks before a
cohesive commit on the actual main workflow and recoverable production release.
Do not publish a partial commit that references absent untracked modules or silently
include unrelated changes. Production final browser and remote-commit/version
binding remain pending. No automatic approval denial remains outstanding.

V9 retains old data but permits null prices/catalog links; an older recommendation
binary may assume those fields are non-null. Rollback must restore the verified
pre-upgrade snapshot together with the matching prior application, after stopping
writers; do not simply swap to the older recommendation code against new null data.

## Shortest tested operator path

1. Open `/admin/recommendations` → new recommendation.
2. Paste the JSON array (and select matching local images when using `fileName`).
3. Validate and preview; correct any row; register all. This persists a draft only.
4. Review customer preview/title/body; explicitly publish only when authorized.

Customer entry is `/recommendations`, each article `/recommendations/{postId}`.
These routes currently work on the shared local test site. They are **not yet
available on production** because the recommendation module has not been released.


## Scoped publication candidate (continuation)

The independent main checkout at `.task-tmp/recommendation-release` excludes all
unpublished AI settings/keys/encryption/security/compose and catalog-mutating
changes. The original checkout remains intact. Optional AI authoring UI/API is
not included in this recommendation-ingestion release. ProductRepository adds
only owner-scoped read lookup. V7 creates recommendation tables without imposing
the unrelated catalog-code uniqueness index; V9 adds source facts. V8 AI settings
is deliberately absent (Flyway supports a version gap). Production starts at V6.

The previous 81.2% coverage was shared legacy service code, mostly untested
acceptance-fixture initialization and quick-order branches. Meaningful fixture
consistency/non-reseed and repeated quick-order pricing tests were added; original
90% line / 70% branch thresholds and release guards are unchanged. The candidate
will run the full gate once; earlier affected tests and workflow evidence remain
applicable to matching code, with only changed candidate checks refreshed.


### Final scoped-candidate gate

All backend test reports now total 195 tests, zero failures/errors and two existing
external-AI skips; frontend 27 files / 94 tests passed. The actual instrumented
BobbuyStore coverage gate now passes unchanged 90% line / 70% branch limits (see
candidate.json). Earlier runs with no agent output were explicitly rejected as
coverage evidence. Windows Unicode output paths were the cause; the new one-pass
coverage runner uses a unique temporary path, verifies the data file and counters,
and is the backend CI command, preventing silent skips and duplicate test stages.
Only test/build-gate metadata changed after the runtime service packages/images
were built; runtime source, dependencies, configurations and frontend bytes match.
The ordinary main CI still checks release guards, frontend and Docker packaging.

Official source-image import passed through the scoped visible editor using one
static official Costco header image and synthetic metadata, then was unlinked.
No full-mail extraction or production product insertion occurred. The image path
is no longer an unverified limitation. Production release archive is staged and
SHA256-verified; activation and final public checks follow the main commit.
