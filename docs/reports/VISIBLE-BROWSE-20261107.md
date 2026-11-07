# Visible browse v1 — developer evidence receipt

Status: offline frontend verification complete; uncommitted candidate, not deployed or accepted by independent QA. The final exact file digest and per-suite results are authoritative in `frontend/test-results/visible-batch-20261107/MANIFEST.json` once generated.

Inputs and pre-change frontend hashes: `INPUTS.json` in that directory. Backend manifest/source digest and preserved permission milestone are recorded there. No source copies were made. Existing unrelated `scripts/local-test.ps1` must retain SHA256 `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9`.

Executed development iterations are retained, not relabeled:

- `paging-first.json`: first pagination-state checks.
- `products-first.json`: initial product/UI/permission checks; one old identity-generation request-count assertion required updating.
- `recommendations-first.json`: first recommendation/shell checks, including a real missing explicit-route pending/pause prop defect, subsequently repaired; fixture status/duplicate caption selection also corrected.
- `bounded-round2.json`: subsequent combined checks; service-price expectation corrected to actual locale formatting.
- Final affected-suite report, type, four-language and diff/source hash checks are recorded by the final manifest. No mock millisecond benchmark or browser speed claim is made.

Coverage intentionally replaces the former in-memory reveal/full-feed startup contract: explicit page/token/error/deferred-pause state, 24-row first readiness without later page/body/history, complete-scope server facets/search, duplicate occurrence identity, directory/current/history mismatch, chosen issue/item deep links, service fees/terms, XSS/plain text/publisher/date, public/private role matrix, save/clear/conflict/identity and both-section refresh, quote bounds/pending/retry/cart review, root/direct/history navigation, images, four-language key/interpolation checks. Admin editing tests are preserved; five old public whole-feed tests were moved/re-expressed under the new page/explicit-open contracts rather than retained as contradictory preload expectations.

Backend compilation/narrow tests are reused only against the exact 13-file input digest. Actual DB isolation/mutations, HTTP payload/timing, GUI, authenticated persistence, runtime binding, CI/CodeQL, Git commit/push and production are NOT_RUN here. Existing denied operations remain stopped. Same original independent QA must review the final changed inputs; earlier permission-only QA is not full acceptance of this refactor.

## Final verification

132 unique tests PASS across 19 suites, merged by latest suite result: `final-targeted.json` then `final-delta.json` then `final-navigation-delta.json`. The initial final-targeted fixture failure is retained in its raw report; the corrected suite is replaced by its passing delta, not counted twice. Final TypeScript no-emit check exited 0; resource checker PASS with 1331 four-language keys; Git diff whitespace check exited 0.

Public page budgets are in the design document. Final checks preserve all 13 backend hashes, HEAD, the unrelated script and the editor/style frozen hashes. No blocking backend contract defect was found during offline integration. This is developer evidence only; no GUI/network timing/performance result is claimed. No source change or test is in flight at ownership release.

## P2 detail pending delta — developer verification

Input candidate: 8c8ed59ceb6f00656d9c97da3e1a86dfb7915021e9a0ae31a7fda479f597bb58. Independent QA P2 source FAIL is preserved in its original report (SHA256 151f70454b3f41191ea148e43fd8a65ade1c52c2331b323b6b35c47ce2c26013), not relabeled. Fix only gives the existing pricePending predicate priority in the detail footer label; disabled and click guards are unchanged.

RED: 10 pass, 4 fail in the existing catalog suite (three product defects and one incorrect test text expectation, corrected to the existing locale value): pending quote, rejected quote, and unresolved purchase context show the wrong footer label. GREEN: all 14 pass, including verified eligible quote and verified no sale. Raw results: frontend/test-results/visible-batch-20261107/p2-detail-pending/{RED,GREEN}.json. Final TypeScript no-emit, 1331 four-language keys and diff checks exited 0. No translation keys changed.

Reuse: the other 18 original suites (123 tests), original backend 13-file/18-test milestone, unchanged editor/style and dependencies retain matching inputs; this does not mean they were rerun. The original 9-case catalog suite is superseded by its 14-case result; original 132 and QA 43 remain historical counts and are not added to this delta. The prior built frontend is now stale for this source change; original main must rebind the affected artifact and original QA must review the delta. No blocking contract change, backend/JAR mutation, build, runtime or release action. Real DB/HTTP/GUI/performance/auth persistence/runtime/CI/production are NOT_RUN.
