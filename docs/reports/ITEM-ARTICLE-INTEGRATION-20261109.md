# V31 item publication with the live article editor

This candidate starts at d460784e8a2187352fc9e37b8148a275da6be19f and retains its
original package, manifest and handoff unchanged. The common base of that branch and
the live bf0ca746 / 00e60cd9 article application is82b8daf7. Only the24 article/router
application/test paths are three-way integrated; the old article release tooling and
accepted-inputs manifest are not copied. Current V31 capture/OCI binding stays in use.
No directory/V28_1, C3/V29, R13/V30, new migration, price change or content data is added.

Retained behavior: the same published post can atomically revise all four reviewed
titles/bodies with owner/version/sourceHash checks, one request intent and complete old
article history. No withdrawal/republication or change to publishedAt/URL/item links.
The00e data router blocks POP/PUSH/REPLACE before unmount, including browser Back;
Cancel retains all drafts and only explicit discard leaves. Same-actor token rotation,
actor isolation, unload, closed-editor and late-response guards remain.

The five merge conflicts retain both language-key sets and compose the monotonic
article/detail acceptance with V31 item publication/append guards. Product responses
now pass through the same ref-based editor acceptance, preserving the already-closed
v5-after-v6 P2. Authentication/route reset clears only the proper scope. Goods issues
still have no whole-post Withdraw control; the article test now explicitly asserts
absence of that control rather than its previous disabled state. Service controls are
unchanged. All original leave/draft/no-publish assertions remain.

Article preservation fixtures mark their111 historical public associations with the
existing legacy fixture helper; they do not auto-publish new candidates. A new real
API test publishes seven products, revises all four article languages, normally adds
an eighth pending product from an existing owned master, publishes that product, then
revises the article again. It asserts seven/eight public counts, no pending leakage,
unchanged original item/snapshot rows and publication timestamps, and all old/new
article histories. This runs in default backend tests and the existing selected
isolated PostgreSQL class. The original six article PG methods are also selected
after the V31 tests in the same existing ephemeral service; no second DB is created.

The first focused frontend run had52 PASS/1 FAIL plus one unhandled Node Request/
JSDOM AbortSignal mismatch during the existing issue-switch assertion. Preserve that
failure; use the same transferableAbortController adapter as the accepted navigation
tests, without relaxing the late-response assertion. TypeScript and1417-key i18n passed.
Real new Java/PG/CI, final archive binding and independent combined GUI acceptance are
not implied by those local checks; their exact results belong to the new CI handoff.

## Recovery boundary

Old V28 82/bf0 cores ignore PENDING and are forbidden recovery applications. The
recovery target must be the exact hash-bound V31-aware core/archive validated against
the mixed published/pending database. Retain that archive outside production before
activation. Existing PG tests prove read isolation in a fresh EntityManager/HTTP
session; they do not prove a packaged-JAR restart. The original QA must validate the
new exact archive/JAR in its coordinated single nonproduction stack and the failure/
maintenance guard. Until that succeeds recovery stays UNBOUND and rollout is blocked.
After any writer reopening, preserve current V31 data and use only the proven aware
application or controlled maintenance plus forward correction; never restore an old
database or boot a PENDING-blind core. This is an executable-package acceptance gate,
not an added permission request or a claim of completed runtime proof.

No production upload/backup/migration/restart/cutover, business content writes, content
Edge access, or local JVM/Docker/database run is part of this integration. The live
post8 shortened article and ongoing normal content edits are protected by unchanged
stored columns and must enter a new fresh baseline before any later production action.

The affected10-case publication group then passed10/10 with its original strict
assertions unchanged. The preceding52 PASS/1 FAIL and AbortSignal error remain
recorded separately; overlapping runs are not added. Type/i18n passed1417 keys.
