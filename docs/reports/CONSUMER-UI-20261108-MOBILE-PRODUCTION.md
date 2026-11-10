# Consumer UI 20261108.2 — production accepted

Released and public acceptance passed. API reopened **2026-11-08T17:01:55.758Z**. Application web source is **5095f376e27c969b6c5fc03c1687bc04991bf2be**; core explicitly reuses **7828194be02d1e1396f304dfd24124a06b35fc32**. This is a component-bound release, not a claim that the reused core has the web revision. Single-instance replacement used real short maintenance503; it was not a hot/zero-downtime switch.

## Delivered behavior

- Product details use desktop two-column/mobile single-column presentation, natural images, separate product identity/specifications and sale/reference facts, with important periods and conditions retained.
- Customer source links/filenames/provenance UI are hidden; original images and internal provenance/history remain. Card copy opens the existing accessible detail control; redundant preview/details controls are removed and nested purchase/admin actions stay isolated.
- Desktop issue directory is discoverable at the upper right, with hover/focus expansion and mobile inline entry. Pagination, one-page directory metadata and request isolation remain.
- Homepage duplicate brand navigation is removed, including crawlable initial HTML. Current public merchant naming uses its public ID/current name while historical publication identity is retained.
- Only an actually eligible reservation uses the visible plus action; no repeated unopened text under every card. Real public data currently has zero bookable trips, and the available-plus count is zero. Positive purchase paths remain covered by accepted synthetic QA, not real transactions.
- A genuinely zero full-scope marked total hides the complete public marked region. Actual public scope225/marked0 is verified; filter/error/lifecycle boundaries reuse the independent evidence.
- All three recommendation routes fit358px, preserve both card columns, and keep return focus/viewport stable. Hidden directory geometry and late image headers no longer move the returning card; card viewing areas contain natural images. Maintenance is concise, four-language and mobile readable.

## Exact checks and artifacts

Application checks for5095f376 completed success: [CI42500665259](https://github.com/sunshaoxuan/bobuy/actions/runs/42500665259), [CodeQL42500671224](https://github.com/sunshaoxuan/bobuy/actions/runs/42500671224), [dependency42500677715](https://github.com/sunshaoxuan/bobuy/actions/runs/42500677715). Three optional manual CI jobs were skipped, not PASS. Dependency execution success preserves existing debt and scan scope; it does not mean zero vulnerabilities.

Independent [R2 acceptance](CONSUMER-UI-20261108-MOBILE-RECOVERY-R2-QA.md) binds649 source inputs, source digest869889956fb81d1ed2a85cb3a2bd6bd5fa71e3011bce7c53dad016a06c0de194,19 operator scenarios and6 real browser paths. Unchanged R1/R4/core-Java17/native-Compose evidence is reused within its stated scope. Actual speech NOT_RUN remains the accepted nonblocking limitation.

Hosted ZIP372075849bytes SHA256 a5ca421e2e22e79f1402f5d0e6cbe157fbdea40c7fed8679708d257a03b8a774. Combined accepted782-core/new5095-web archive247961600bytes SHA256 8da9c8448bb516f32735865d0034116a44dfba5a40aa4308cde91e3beaabcd03. Full selected OCI config/manifest/layer identities and all47 web files were verified; new CI core was not silently substituted for the accepted reused core.

Running core image f382d7db55a2ffd59bddc7d4c86ac9519cb507cd93ba15ae3b70fadc508c871d, JAR ed4f0b21fe6a17ef46daba0b804c0118bfe96bd7cf8f2f2efda05424377a0e6a. Running web image359674934c11ccbcb43f4f1842f76518fb328cee553c8a7eb35a896600dd72f2, index7e5dadbffb072d0f22f4542553d578081943af1b4804ee56fedba6127ddc9b45. The server checked all47 files/JAR/nginx; public browser checked97 loaded asset responses, all matching.

## Preserved pre-write failure and maintenance-only correction

First update16:50:45–16:50:49UTC failed before context/config/runtime mutation: real nginx has both an HTTP redirect root and an application root; the previous helper incorrectly required one global root. Old runtime and config were directly reread unchanged;21 prior preparation/input files and the old backup are preserved, not erased or relabeled successful.

The only semantic function change after independent R2 is friendly_maintenance_config: require exactly one frontend proxy stanza, preserve the redirect and strict API freeze. All identity, sealed-Compose, full-schema, deadlines, unknown-state and recovery function/class ASTs remain unchanged.10 pure actual-topology checks and19 developer reruns of the prior independent full-flow fixtures pass, plus native nginx two-root503/exact UTF8/no-store/recovery200. This is scoped developer/native evidence, not a new independent QA run or coverage by the earlier application CI.

Fixed semantic template SHA256 b051e83c6c80cb5deb62914877dce8a656692bb1bd10cb72b99dd0255c3722e7; executable bound adapter SHA256 b1ac912eff4448f501ce11015a02af37b81679f9c5b9c82188d6b5c6b73bae18; final artifact metadata SHA256 6eeaa2e1987840387bb4a12eb2522e945028df5f3e109b990323518b2f6e5994. The checked-in template stays UNBOUND. Real SOURCE/artifact substitutions are separately hash-bound in private release evidence. No application source or image changed for this matcher fix.

Actual public maintenance: 4/4 locales at358px, HTML and API503, no-store, readable44px retry. The initial native fixture's capability/chown failure is preserved; its temporary-worker fixture was corrected without adding capabilities. All native probes were removed and existing services unchanged. Full maintenance exited before public acceptance.

## Data and public acceptance

Fresh private consistent V27 dump at16:59UTC: 70563204bytes, SHA256 f75164508a6ae4750a6b9ade5beb59e12aca659c2cca1ae8614fe0583de7c21c; pg_restore --list passed. The database was never downloaded or restored. Complete columns/defaults/constraints/indexes and migration history stayed unchanged. All38 business-table fingerprints matched the fresh current baseline during backup, under freeze and at17:02–17:03 live verification. No migration replay, old snapshot or user-data overwrite.

Costco masters remain82799v2/gallery5,560874v4/gallery4,28668v4/gallery3, with full row fingerprints preserved. All13 protected/other-project running container identities/start times remain unchanged; cleanup also preserved all18 existing running/stopped container identities.

Public1440/358 checks completed 2026-11-08T17:03:34.036Z: three recommendation routes, directory expansion/Escape, exact initial no-JS home, desktop/mobile detail layout, hidden customer sources/admin controls, zero-scope markers, no-trip plus suppression, correct merchant display, and phone second-page two-level Escape. Seven recorded opener returns have0px scroll/visible rectangle delta and original URL/focus. No page exceptions, bad responses, login or real transaction. Desktop/mobile list/detail and real maintenance screenshots were actually viewed.

## Capacity and recovery

After stable acceptance,15 exact unreferenced old core/web images and10 byte-identical recoverable image archives were removed, with complete nonproduction recovery config/manifest/layer graphs verified. Core and web now each retain only their running image. No containers, data volumes, backups, config, helper libraries, other-service images or global prune were touched. Free disk increased 15999942656→22951669760bytes (about6.95GB reclaimed).

25 other historical archives (11229425152bytes), including configuration/cross-version recovery material, remain because exact nonproduction recovery was not established; this is explicitly incomplete broader archive cleanup, not a claim that all historical storage is gone. Retired MinIO/init/other-project containers were retained. Application rollback now requires re-uploading/loading the verified nonproduction old image archive before a guarded app-only switch; old database restoration remains forbidden.

Detailed inputs, failures, native logs, backup metadata, operation/readiness timestamps, source/asset hashes, public screenshots and exact cleanup/recovery inventory remain under frontend/test-results/consumer-ui-20261108/production-mobile-20261108/. Original evidence is preserved. Root/browser return and final receipt hashes are recorded by the finalizer. No local Docker/JVM work or Meelok claim operation occurred.
