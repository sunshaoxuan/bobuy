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
