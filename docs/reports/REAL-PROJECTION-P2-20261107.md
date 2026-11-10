# P2 pending-price fix and real projection supplemental evidence

Unreleased source checkpoint. Requirements and design remain
[visible browse plan](../plans/PLAN-VISIBLE-BROWSE-20261107.md) and
[read/permission design](../design/VISIBLE-BROWSE-V1.md). PM owns scope; original main
owns integration, original frontend owns implementation and original QA independent review.
This report adds the P2 rebuild and supplemental tests without overwriting old FAIL receipts.

## Change and candidate

P2 changes only the product-detail footer label to prioritize pending price; disabled/click
conditions remain unchanged. Runtime source candidate is
`d7a130d7207a949e47a32231613476f6d9d68dd759af80c3c79ab92c9631d0c9`.
Its exact frontend input is `frontend/test-results/visible-batch-20261107/p2-detail-pending/`.
Prior `8c8ed59c...` build and QA FAIL remain preserved; no patch reapplied to dirty source.

Main adds only `PublicCatalogRealProjectionNoAgentTest.java`, a test-only supplement.
Its hash is recorded separately: do not claim the P2 runtime digest includes this later
test file. Backend runtime source/JAR are unchanged and reused, not unnecessarily repackaged.
No migration, prices, catalog fields, source associations or orders are rewritten.

## Supplemental assertion mapping (new suite, not old Mockito execution)

All twelve methods in `PublicCatalogRealProjectionNoAgentTest` deliberately match the
following old assertion names. Only repository interfaces are in-memory Java proxies;
`RecommendationTaxonomyService`, `ProductCatalogProjection`, `ReferenceQuoteService`,
`ReferenceOfferWindow` and `PublicProductCatalogService` execute their real implementation.
Unexpected repository operations fail; saves/deletes/flushes are forbidden. No Mockito,
agent, attach pipe, database or network is used.

| Original suite | Assertion / corresponding new method |
|---|---|
| PublicProductCatalogServiceTest | allPagesIncludeUnpricedPublicMastersWithoutAnyTrip |
| same | privateDeletedAndUnknownVisibilityNeverExpandThroughCatalog |
| same | merchantFilterDoesNotReturnOtherOwners |
| same | invalidQueryRejectedAndPageBeyondEndIsEmpty |
| same | legacyEmptySourceBrandAndGalleryDoNotEraseKnownMasterEvidence |
| same | foreignPostCannotSupplyMetadataToAnotherMerchantMaster |
| same | productionShapeIncludes225OwnedPublishedMastersButNot13UnpublishedOr16Deleted |
| same | drafterProjectionNeverAddsPrivateMasterFieldsOrFallbackMedia |
| same | onlyCurrentSameOwnerPublishedSourcesGrantDrafterEligibility |
| PublicProductCatalogProjectionTest | legacyDrafterFieldsExactlyReusePublishedProjectionWithoutMasterFallback |
| same | canonicalDrafterUsesExactlyAlreadyPublicMasterProjectionAndVisibleMedia |
| same | withdrawalRemovesDrafterEntryWithoutChangingVisibilityOrSaleData |

The canonical test additionally verifies actual quotation behavior: different source/master
ITEMs do not receive each other's price (NO_ACTIVE_OFFER); exact matching ITEM resolves
ACTIVE with the real amount, while public referenceContext removes supplier identity.
This is not an assertion that similar products can merge or that inventory is inferred.

New suite final result: 12 PASS / 0 FAIL / 0 ERROR / 0 SKIP, offline Maven with
`-Djacoco.skip=true -Dtest=PublicCatalogRealProjectionNoAgentTest test`. Initial fixture
failures are preserved in the receipt: deletedIds was misclassified as a write, then one
test incorrectly expected ACTIVE despite intentionally different ITEMs. Only test fixtures/
assertions changed; no business code change was needed. Exact final XML/hash and test
source hash are in the main P2 evidence receipt.

## Frontend evidence and build

P2 developer 14 PASS is separate from old 132 and QA 43; they overlap and are not added.
Other 18 suites / 123 assertions may be reused only with matching input hashes. The
new formal frontend build includes i18n/TypeScript/Vite/home prerender. Its exact new
dist files and hashes are bound in `backend/test-results/p2-integration-20261107/`.
No frontend implementation was edited by main; frozen editor/badge CSS and the unrelated
scripts/local-test.ps1 remain unchanged. The old backend JAR hash is verified unchanged.

## Git, rollout and remaining gates

Source checkpoint staging/commit, when permitted, uses only the precise candidate source,
tests and these requirements/design/report/changelog documents; unrelated local-test.ps1,
compiled artifacts, local configuration and bulk temporary evidence are excluded. Stage
and commit are separate controlled actions, with actual results recorded in the receipt.
No local checkpoint implies push/CI/QA/release success. Do not infer a commit from this text.

Runtime binding, actual SQL isolation/concurrent changes, live HTTP bytes/timing, genuine
GUI/authenticated persistence, independent delta acceptance, CI/CodeQL and production
remain separate and untested here. Existing login/Docker/CIM/attach/push refusals remain
stopped. No new stack/test copy, cleanup or user-browser operation occurs. Parent routes
the exact result to original QA after main explicitly returns write/test authority.

Eventual deployment pairs new core/frontend via the existing operator and preserves
customer writes; this test-only supplement needs no schema rollback or database restore.
