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

## Fix1 real runtime findings and precise fix2

Commit61934df5e5469d0e841606c637518cb852e909cd / CI42647734584 compiled successfully but failed backend434 methods:420 PASS/7 FAIL/1 ERROR/6 SKIPPED. CodeQL42647739486 and dependency42647745037 succeeded. Frontend470/470 across89 files,1400 resource keys/type/build passed on unchanged frontend source. The original first run and this second failure are preserved in separate monitor directories.

The quote mismatch exposed one actual implementation defect: catalog display projection replaced a frozen source ITEM with its reviewed-master display ITEM before quote-scope matching. Fix2 restores only the internal candidate itemNumber from its immutable publication snapshot before sameScope comparison. Display metadata, stored snapshot, supplier/channel/variant/unit/window rules, amounts, images and no-write behavior stay unchanged. The new regression asserts SOURCE100 versus display MASTER does not silently match, a genuinely matching public MASTER80 does, later live edits cannot rewrite frozen source/image/price, and the entire snapshot bytes stay unchanged. Another old quote test now explicitly marks its already-public history as a legacy published snapshot; its ACTIVE amount/redaction and draft exclusion expectations remain.

The API status failure is a separate fixture contract error: the actual no-Authorization request receives the existing SecurityConfig401, while foreign authenticated404 and CUSTOMER403 both passed. Fix2 retains those denial assertions, corrects only anonymous401 and adds pre/post version/publication metadata/item count/history no-write assertions. The rollback test now uses the actual server merchant-review DTO instead of hashing detached TEN(scale0) against fresh numeric(14,2). The strict service hash/version/ownership guard is unchanged. Inside the rollback transaction it proves item snapshot, post publication and history exist before rollback-only; all original full rollback/same-key retry assertions remain.

Three other test fixtures are aligned with real authenticated workflows: node posts get explicit legacy public item snapshots with true owner/publisher and unknown master binding; commerce explicitly reviews the real uploaded picture gallery instead of a generic helper substituting another image; catalog uses real managed image upload and actual reviewed master name/version, with an additional wrong-name400/no-write check. All98 original strict assertion fragments and9 original methods are retained. No production service/profile/visibility constraint is relaxed to make fixtures pass.

Real isolated PG from CI42647734584 contains34 unique XML methods:32 PASS/1 FAIL/1 ERROR,0 skipped. C1/C2 29 pass and V28->V31 migration2 genuinely pass. All38 old-table column fingerprints/history prefix are unchanged, only8 item columns added. V31 proof bytes31ab59e2408158880a69e7da43af8272562ee97317e11b1ca52861598025403a were captured before synthetic cleanup. API3 then had concurrency PASS plus the two fixture failures above; recovery2 was skipped. Supporting ZIP13688881651 is not a formal release artifact.

All7 fix2 source files are frozen with owner manifests. No local Java/javac/H2/PG/JVM/Docker/service ran for these new sources; their runtime acceptance is NOT_RUN pending the next exact remote CI. Earlier unchanged FE and migration subset evidence is reused only within its exact scope, not promoted to a full new backend/PG pass. The61 required class names,28 SQL files, V28->V31 transition and UNBOUND recovery policy remain exact. Old V28 is still not a recovery target; exact aware-JAR/archive runtime proof or controlled maintenance/forward correction remains mandatory. No production action or deployment is authorised here.

## Visible-at-cutover correction

The resumed eight-file patch starts at 3fdd94b3, with all paused evidence retained.
The previous legacy migration copied only source text/gallery, although the V28 public
projection already displayed the confirmed same-owner master correction. That would
silently turn the confirmed carton specification/gallery back into obsolete source copy.
V31 now retains that already-visible metadata in the immutable occurrence snapshot,
with explicit `VISIBLE_AT_V31_CUTOVER` provenance and its cutover product version.
The original publication-time master version/review remain UNKNOWN. Source facts,
offer amounts, tax/unit/channel/windows, sourceHash, original images and associations
are unchanged; no live price/stock is copied. Unlinked, deleted and foreign masters are
not borrowed. Subsequent recipe/packaging changes require a separate reviewed occurrence
and cannot rewrite the earlier snapshot. Draft posts and newly added rows remain PENDING.

The pure regression includes the former catalog=null negative control and checks the
confirmed carton/gallery, frozen source, later recipe isolation, pending public feed/
catalog exclusion and independent publication. The existing isolated PG migration class
now has three methods: complete old-column/history preservation, unknown-shape rejection,
and later recipe/pending isolation. The recovery class remains two rollback-only methods.
These new Java/PG methods require the exact new CI; prior green runs are not substituted.

Manifest replacement requires the exact previous file SHA, retaining independent review
and all runtime/recovery gates as pending. This is a V31 source candidate, not a production
release: current production is 20261109.4 / bf0 core / 00e web / V28, with live article
editing and content changes. Those application changes must be integrated and protected
before any later production release; the independent frozen 48433bd7/V28.1 package is
not changed or included here. PENDING-aware archived application recovery remains UNBOUND.
