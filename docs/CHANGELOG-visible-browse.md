# Candidate change history

## visible-browse-v1.frontend.20261107 — UNRELEASED

- Consume backend browse v1 summary pages, complete-scope facets/totals, inline badges and distinct query/shared-dataset revisions.
- Load public product/recommendation sections by viewport intent and subsequent bounded pages; stop eager full catalog/issue traversal on public routes.
- Defer issue directory/history/body/gallery and product detail; bound sale reads, retain pending price/eligibility and existing cart quote/checkout review rules.
- Separate shopping-shell metadata from direct route readiness; preserve root home/menu/merchant context and root quantity flow.
- Preserve resolved-owner management actions and draft/busy/conflict protections, invalidate both product streams after save, reject late generations and changed datasets visibly.
- Keep one execution root; add requirements/design/test-input/request-budget evidence. No migration/cache infrastructure, backend change in this frontend step, dependency installation, runtime replacement, CI, push or production activation.

Source lineage is HEAD e26cab4 plus hash-bound permission-context and backend v1 changes; no new commit or production version is claimed. Final developer tests/type/i18n and source hashes are in the visible-batch evidence manifest. Real performance and release acceptance remain pending original main/QA gates.

## visible-browse-v1.frontend.20261107-p2-detail-pending — UNRELEASED

- Correct the open product-detail action label while price/availability or purchase context remains unverified; preserve disabled and click guards.
- Add five regression cases for pending/rejected quotes, successful eligible quote, verified missing quote and unresolved purchase context.
- Delta evidence lives in `frontend/test-results/visible-batch-20261107/p2-detail-pending`. Prior QA FAIL and build receipts remain immutable; changed frontend requires original-main artifact rebind and original-QA delta acceptance.

## visible-browse-v1.frontend.20261107-p1-gallery-source — UNRELEASED

- Fix public recommendation detail white screen for null/missing/invalid image source attribution. Preserve genuine images, valid links and supplied labels without generating invalid links.
- Add ten attribution boundary cases and close/switch/return regression to the existing recommendation suite.
- Based on committed 634e77c; source-only candidate, no build/runtime/push/production action by frontend owner. Original anonymous QA FAIL remains unchanged; main rebinds minimal assets and same QA rechecks affected detail/navigation.
