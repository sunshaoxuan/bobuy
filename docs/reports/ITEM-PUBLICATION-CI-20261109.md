# Item publication V31: precise CI candidate

This batch is the single-item publication candidate based on C2 commit
82b8daf7fe275d6dd623b36621f1cf2596dc0e98. It contains no C3/V29 or R13/V30.
The independent late-response P2 source review passed 15/15; its receipt SHA256 is
23933dbf97087ed5513fe3b7ec8268c9bbeb797296f3cd638d53a36f0cf85600.
Those three frontend P2 files and the other frozen application sources remain unchanged.

The next delta integrates two test sources previously held in ignored evidence:
the migration fixture now uses actual roles JSONB, verifies true PG identity before
its existing isolated clean, creates its four INSERTs atomically, deserializes genuine
catalog/media DTO shapes and cleans only its exact own identities in inverse FK order.
The original two migration test methods and every old-column/history/source/SQL-rejection
assertion remain. Full pending-row rollback and eight exact additive V31 columns are
also asserted. A preservation report is emitted only after those real PG assertions,
before synthetic cleanup; it explicitly is not acceptance of the whole test class.

The recovery class adds two rollback-only actual public HTTP/PG methods, with random
merchants, 45 published and two pending associations, real 20/24 page boundaries and
a fresh EntityManager/HTTP session. It checks exact original source/price/gallery/image
bytes and raw own-row equality. The old post-only SQL predicate is a negative control,
not an executed old V28 JAR. A new persistence/HTTP session is not a full JAR restart.

The existing isolated postgres-migration-verify job retains C2's V27->V28 preservation
and transaction regressions. It then runs three separate sequential commands:
the V28->V31 migration class (2 methods), publication API/locking/rollback class (3),
and recovery read-isolation class (2). No other database, H2 substitute, concurrent
Flyway clean, production datasource or new permission is introduced.
V31 SQL refers only to existing V28 post/item fields and its own added columns.
Its V28->V31 execution and preservation remain to be proven by that actual CI.

CI artifact binding now requires unchanged C2/V28 migrations plus exactly the reviewed
V31 SQL, and pins its canonical bytes. V29/V30, extra/duplicate/missing migrations,
wrong prior manifest and old-byte drift reject. The accepted-inputs manifest binds
all inherited sources, this precise delta and required publication classes; it does
not claim any local Java compile or exact executable-byte acceptance.

The Python artifact-tool contract suite passed 15 tests. The initial ordinary Python
alias could not start; its null-status result is preserved and was never counted.
The same existing executable ran successfully through the normal tool approval path.
No test assertion was dropped or skipped to obtain this result.

**Recovery remains UNBOUND.** Old 82b8daf/V28 reads PENDING rows in published posts and
cannot be the V31 fallback. Positive or unknown pending rejects that recovery; zero
pending is not runtime proof either. A permitted target is an independently hash-bound
recoverable package of the same PENDING-aware code (or another proven aware artifact),
validated against real V31 data. The first V31 has no earlier stable aware deployment.
An exact archived JAR/new-process PG probe and failure/maintenance guard are still
required. If no verified aware artifact is safe, retain controlled maintenance and
forward-fix; preserve all current V31 data. No old DB restore or whole-post withdrawal.

Current candidate status: ready for precise source/tool review and normal remote CI,
not accepted for production. New Java 17 compilation, full backend suite, actual
five publication PG and two recovery methods, populated V31 execution, formal package
browser acceptance and packaged-JAR recovery are NOT_RUN. Earlier source compile or
mock/browser results are reused only within their original exact scope.

No shared index/stage/commit/push, local JVM/Docker/PG/service, browser, content edit,
production upload/backup/migration/activation or deployment occurred in this preparation.
All old failure records and 44-file manifests remain intact.

## First exact CI failure and minimal correction

Commit 09d4c6e6644c1e4d2132c76776ce4538cf21c6c0, CI 42645738275 failed. Backend job 129258384951 and PostgreSQL job 129258384459 both failed testCompile at PublicCatalogRealProjectionNoAgentTest.java:58:35 because p was never bound in the canonical projection fixture. CodeQL 42645743918 Java build failed for that same compiler error; its Actions and JS/TS analyses passed. Dependency workflow 42645748869 passed.

The minimal Java correction binds the already-created projection to var p. Original assertions, the second already-public occurrence and snapshot behavior stay unchanged. No application implementation/constraint is relaxed. The actual V27->V28 populated 38-table preservation step passed; no Java tests or later V28->V31/publication/recovery PG method ran because test compilation failed. The original logs are retained under the CI monitor directory.

Frontend job 129258384858 separately ran 470 methods across 89 files: 469 passed, one failed (keeps an article draft through conflict/reload and requires a fresh review and new attempt, save spy had zero calls). Its original assertion/log remain. A separate frontend owner is investigating that precise difference; this Java fix does not claim to close it. Formal web/core OCI construction was skipped, so no formal artifact is accepted from this run. New Java/PG/recovery execution remains NOT_RUN until a subsequent exact CI succeeds. Recovery stays UNBOUND.

### Frontend fixture completion for the same fix1

FE fix1 is test-only: RecommendationsItemPublication.test.tsx adds three lines waiting for Reload settlement (enabled and no ant-btn-loading), then waits for the fresh review checkbox after saving. The original exact save(8, Kept local draft, Saved article body, 7), new version/hash, review and new UUID assertions are unchanged. Official CI42645738275 remains469PASS/1FAIL; unmodified local target passed. A bounded same-fresh-result100ms GET settlement probe reproduced original calls0 with disabled=false/loading=true; the fixed test passed the identical probe with loading=false. The final targeted3-file group passed23/23(10 publication+9 FromProduct+4 P2 revision race), not summed with overlapping control executions. No application source, API guard, old44 manifest, index, report or accepted file changed by this FE task. Remote CI/formal browser/Java/PG are NOT_RUN here.

This precise fix1 changes only test fixtures plus this report/accepted metadata. The prior CI failures and original assertions remain retained. No application implementation, schema SQL, P2 late-response guard, required-class list or recovery policy changes. Full new Java/PG/CI acceptance is still pending; frontend narrow fixture checks do not turn the previous failed full suite into a pass.
