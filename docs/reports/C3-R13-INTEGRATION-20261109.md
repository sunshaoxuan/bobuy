# C3 / R13 integration candidate — 2026-11-09

C3 lets an authenticated customer amend their own NEW, UNPAID order before procurement or delivery commitments. The customer sends a revision and an explicit request key; competing changes retain the draft and require a fresh read. Merchant writes use the same locking order. Payment, refund and fulfillment commands are outside this change.

R13 adds durable merchant-scoped Costco item-number/photo intake, shared evidence acquisition and pinned-model review, task leases, idempotent catalog commits, and a backend catalog entry. Deterministic checks enforce format, permissions and evidence provenance; semantic acceptance remains a model decision. Missing selling prices remain unknown and a new product stays NEEDS_INPUT. The worker is disabled by default. No real website/model/catalog call is claimed by source or mocked tests.

## Inputs and integration

- C2 remains fixed at `82b8daf7fe275d6dd623b36621f1cf2596dc0e98` on `reference-offer-windows`.
- Independently reviewed C3 source: `1c7c8e94c4e7a5422e0d109ff2c1a7b134204f33`, 36 files; frozen manifest `3122b466748347d46be08b7507957e6908d252fbeb2ed61e43c08fd888606930`.
- Independently reviewed R13 source: `7b56767e998e02e642b2d9bcb0df411791de1814`, 46 files; frozen manifest `c4615a8ea4e9baf3fbfc66733ace4e9ce9c5faf672dd8d0dce3a179706f102cc`.
- Source merge: `82f5948cdf50c165da347fde7f091dbfadfa1225`. The five shared files are `frontend/src/api.ts` and the four locale dictionaries. Git merged disjoint hunks without conflicts; all other source blobs equal their reviewed parent.
- V28 remains unchanged. V29 adds the order revision and private amendment receipts; V30 adds private onboarding jobs, evidence and commit receipts. No production migration is part of this integration.

## Validation and CI gates

The actual merged frontend passed 38 unique component/API tests, TypeScript and the four-language check (1457 resource keys). These use JSDOM and mocked APIs; they do not prove real browser or server behavior. Prior source reviews and their original failures remain preserved in their own evidence directories.

The existing hosted CI workflow selects `CustomerOrderAmendmentIntegrationTest` and `CostcoOnboardingPersistenceIntegrationTest` on its explicitly isolated PostgreSQL service. It also verifies populated V28→V29→V30 preservation, using every prior table's original-column projection, before running the transaction group. CI captures new source, migration, class, image and web hashes under `docs/reports/c3-r13-20261109/accepted-inputs.json`; compiled bytes and formal-browser acceptance remain pending independent artifact QA. Exact run results are recorded separately after CI finishes, without rewriting this source-stage claim.

Remaining runtime gates: normal Java 17 CI, actual PostgreSQL concurrency/rollback/JSONB and preservation, final artifact binding, formal nonproduction browser journeys, and authorized real official-source/model/catalog integration. Mock success is not real AI, SMTP or catalog persistence evidence. No production upload, backup, migration, service restart, activation or cleanup is authorized by this candidate.

## First exact CI fixture correction

Run `42611769108` preserved V27→V28 successfully, then rejected the new V28 synthetic-user fixture: it named the old V1 `role` column, which V5 had replaced with non-null `roles` JSONB. The fixture now inserts the exact AGENT/CUSTOMER role arrays. A narrow fixture regression records this contract. The original PostgreSQL log is retained; V29/V30 preservation and the downstream transaction group were not run to completion on that failed path. No application, migration, business-data or safety assertion was changed by this correction.

The same run compiled Java 17 sources but failed its backend suite (515 tests, 1 assertion failure, 13 errors, 8 skipped). Order-line JSON values lacked value equality, so Hibernate could treat an unchanged deep-copy snapshot as dirty and advance the new optimistic version during reads. The correction adds equality/hashCode over the serialized business fields and a real-context read-only-preview/version regression. Missing-trip updates regain their prior Optional contract, while required locking still rejects absent trips. One legacy controller fixture now sends the required explicit revision. Existing ownership, payment, revision and conflict guards remain intact. Narrow source compilation and 15 pure tests passed; real Spring/H2/PG closure and coverage require the next exact CI, and the affected source delta remains pending independent review. The initial frontend build, release guard checks, CodeQL and dependency checks passed; Docker artifact construction was skipped after backend failure.

## Actual storage-mapper follow-up

Run `42614311891` passed both populated migration stages and all six real PostgreSQL onboarding-persistence methods. Its full PostgreSQL group remained FAIL (44 tests /26 setup errors): synthetic catalog/recovery JSON used fields outside the actual persisted records. Those fixtures now use `ProductCatalogData` and `ProductCatalogRecovery.State` shapes; history rows and preservation assertions remain present. Fourteen pure fixture/comparator tests passed.

The backend suite remained FAIL (520 tests /2 failures /6 errors /8 skipped), now isolated to C3. The real Hibernate storage mapper strips six identity metadata fields from legacy `lines` JSON; post-load hydration then reattaches them from `product_identities`. Default-ObjectMapper tests missed that lifecycle. The new delta keeps full HTTP/value equality, compares legacy JSON dirty state through the actual storage mapper, and synchronizes explicit metadata changes into the owning header's existing identity sidecar. It preserves the 17-field legacy JSON format, SKU/unit association guard, version checks and all first-PATCH/concurrency assertions. New regression sources cover hydration, metadata-only versioning, removed/cross-header callbacks and stable preview fingerprints. This delta had source/whitespace checks only before remote CI; its new Java/runtime results must come from that exact CI, with no previous pure-test result substituted. No migration or production action changed.
