# Product introduction delivery evidence

Final acceptance: [acceptance.json](acceptance.json). Task and the13-item missing-evidence table: [PRODUCT-INTRODUCTIONS-20261112.md](../../PRODUCT-INTRODUCTIONS-20261112.md).

Saved through ordinary merchant UI:296 resumed rows,297 total new introductions including the earlier pilot. Coverage is376 complete masters from389 active masters. The existing325 public products all have four-language introductions. Thirteen unresolved private records remain unchanged.

## Content and provenance

- [saved-introductions.json](saved-introductions.json): actual297 saved multilingual summaries, including the independently reviewed pilot wording.
- [source-traceability.json](source-traceability.json): official source URLs, archived hashes/retrieval dates and editorial decisions.
- [coverage-ledger.json](coverage-ledger.json), [unresolved-products.json](unresolved-products.json): complete coverage and specific remaining evidence needs.
- [master-final-audit.json](master-final-audit.json):389-row original-field/version reconciliation. The pilot prepared-text mismatch is intentional retention of its earlier saved wording.
- [public-acceptance.json](public-acceptance.json):325 identities and historical fields preserved;325 four-language current introductions.

Original complete master snapshots, public before/after extracts, source-page fact extracts and preliminary logs/crops are retained under ignored `private/`. Those are formal local records. They are excluded from repository publication.

## Source and runtime binding

- Core `5a9bb64ab8cda965018bddacfe9471c1081ca34b`, release `20261112.product-introductions.2`; [artifact.json](artifact.json), [status.json](status.json), [migration-binding.json](migration-binding.json), [backup-check.json](backup-check.json).
- Frontend `3a8b11ac97eab33f676b523af04af1f9922fd3f1`, release `20261112.product-introductions-currency`; [currency-final/artifact.json](currency-final/artifact.json), [currency-final/production-verify.json](currency-final/production-verify.json).
- [validation.json](validation.json):671 backend tests reported,647 executed,24 skipped, configured coverage passed;89 affected/integrated frontend tests; final build and9 release guards. JavaScript/test evidence is reused for the final CSS-only change.
- [ci.json](ci.json), [currency-final/ci.json](currency-final/ci.json): successful exact application-source CodeQL runs.
- [initial-attempt-status.json](initial-attempt-status.json): first operator assertion used the compact card DTO; guarded application rollback preserved the database. The corrected detail endpoint was verified locally before the second activation.

The existing version-pinned application operators and staged artifacts are preserved on production. Core activation has a fresh stopped-writer, verified dump and unchanged content/schema fingerprints. The final frontend-only operator preserves every other service and uses application rollback. Saved content requires no schema migration or database rollback.

## Actual page acceptance

[ui-production-native-matrix.json](ui-production-native-matrix.json) contains eight real-product locale/viewport states, final network responses and application-console results. [ui-recommendation-acceptance.json](ui-recommendation-acceptance.json) covers the second entry path, four languages, image navigation, close and deep-link reopen.

Whole screenshots use the native browser viewport capture. Their actual captured pixel dimensions are recorded separately from the requested CSS viewport. [ui-original-pixel-crops.json](ui-original-pixel-crops.json) binds each lossless `*-info.png` crop to the whole screenshot hash and original-pixel crop coordinates. The direct-CDP crop experiment is superseded because it changed the captured scroll position. Product introductions flow completely with vertical scrolling.

[gemini-production-final.txt](gemini-production-final.txt) is the independent English/Japanese mobile visual review. The primary agent reviewed all four languages and desktop/mobile whole views and crops, including original-frame boundaries, title/close hierarchy, unchanged controls, price alignment, introduction readability and CTA visibility. Chinese variants and remaining scope were accepted by the primary agent. Historical packaging/units and brand names remain source facts. The blue cursor shadow is an installed browser extension artifact.
