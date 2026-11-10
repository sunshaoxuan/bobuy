# Consumer UI mobile recovery R2 — developer correction

Status: narrow independent QA required; not committed, uploaded or deployed. Sole original worktree, HEAD `7828194be02d1e1396f304dfd24124a06b35fc32`. R1's independent FAIL remains unchanged. Root was returned by QA at 2026-11-08 15:37:17 UTC. User approved the phone repair/maintenance/verified republication at 13:48:20 UTC. This correction is returned to that same QA before publication.

## Publisher P2

Metadata correctly permitted the explicit accepted782 core plus future new-web revision, but image verification, pending Compose identity and readiness still required the global new revision. Added `image_binding(image)` and used its per-component validated manifest revision and immutable IDs in these three consumers. Metadata still pins exact permitted core/web sources. Final payload hashes, fresh recovery identity, full-schema checks, sealed Compose consumption, unknown-state protection and bounded operation/recovery budgets are unchanged.

Candidate SHA256 `f7fc64cf50e1caf487a1ae48d0ae725aedfca291756cb3e3d9fa3cc846d7f232`. Canonical candidate remains in `mobile-recovery-r1/production_v27_update.candidate.py`; R2 stores an identical frozen copy and exact delta. It remains UNBOUND and refuses execution. Accepted f71 adapter is unchanged.

`COMPONENT-IDENTITY-TESTS.json`: **20/20 developer PASS** using actual AST-extracted functions/pending assignments/observer/update-readiness contract. Covers legal mixed sources, fc57 rejection, wrong tags/revisions/digests/layers, unknown runtime/project, known forward/recovery identities and strict final payload checks. Other safety-code ASTs are unchanged. Real Docker/SSH/SQL/network/memfd/Compose calls: **0**. Initial fixture namespace error remains in `COMPONENT-IDENTITY-TESTS-R0.json`; product assertions were not weakened.

## Desktop 624px and mobile 111px investigation

Replayed the original desktop selected-issue path with the original waits, screenshot and two-level Escape, adding passive input/layout/focus telemetry. `ORIGINAL-PATH-TRACE.json` reproduces the **624px** old measurement: at 3116.2ms scrollY0/target top1037.78125; pointerdown at3155.3ms scrollY624/target top413.78125; documentTop stays1037.78125. Return and later samples stay624 with correct `7:236` name focus and original URL. Locator click scrolled the off-screen target before dispatching input, after the old measurement. Actual input-to-return difference was already0. The historical FAIL and reproduced624 remain; the old assertion is not relabeled PASS.

Mobile was not dismissed because one later run happened to return0. `LAYOUT-TRACE.json` shows detail opening removed the directory's93.796875px height plus18px margin, shifting the list **111.796875px**. AntD reset `[hidden]{display:none!important}` overrode the intended retained layout. The scoped `.issue-directory[hidden]` display rule now also uses important; visibility:hidden/pointer suppression remain.

After that correction alone, the same second-page direct and two-level paths still failed by **112px /266px**, with **266.515625px** target-document displacement. Full raw failure is retained as `RETURN-AFTER-DIRECTORY-FIX-FAIL.json`; its script exit0 is not acceptance. Image metadata above the target changed naturalHeight0→1200/rendered height0→155 while complete was stillfalse. Image headers establish intrinsic size before load. Three affected keys included7:241/7:243/7:244; grid row changes accounted for the266.515625px shift. Original QA111px did not record image-event chronology, so its exact historical interleaving cannot uniquely be reconstructed. Both demonstrated layout causes are fixed rather than calling all mobile failures observational error.

Second CSS fix: only public server-browse recommendation cards reserve a square photo area, containing each image at its natural ratio without crop/stretch. This creates some card-photo whitespace but stable geometry before image headers. Original image bytes, detail/gallery/fullscreen, request/lazy loading/paging, scroll/focus restoration code and all business data are unchanged. No delay, all-image prefetch or scroll-to-card workaround was introduced.

## Final developer evidence

`RESERVED-RETURN-TRACE.json`,16:02:00–16:02:15 UTC:

| Original user path | Width | Input/return scroll | Target document / visible top | Focus |
| --- | ---: | ---: | ---: | --- |
| Selected issue, fullscreen then two Escapes |1440|0px|0px /0px|7:236 name|
| Current list second page, Enter then Escape |390|0px|0px /0px|7:260 name|
| Current list second page, fullscreen then two Escapes |390|0px|0px /0px|7:260 name|

Later samples stay stable and original URLs return correctly. Mobile still has pending images; their frame height stays stable. Desktop and phone returned PNGs were actually viewed: both columns fit, natural image content is contained and the intended name control is visible. These are **developer** results, not independent acceptance.

Reproduce from the same frontend: start existing Vite with `--config test-results/consumer-ui-20261108/mobile-recovery-r2/vite.config.ts --host 127.0.0.1 --port 5173 --strictPort`, then `node test-results/consumer-ui-20261108/mobile-recovery-r2/trace-reserved.mjs`. The config permits only anonymous storefront GET/HEAD and strips credentials; no login, user browser or transaction. Script finally closes isolated headless Edge. Inspect JSON metrics, not process exit alone. Original script/waits/events/requests and all PNGs are hash-bound by HANDOFF.

## Reuse, continuation and safety

Only two of R1's649 build inputs differ: `frontend/src/components/issue-directory.css`, `frontend/src/browse-pages.css`. Exact hashes/source digest are in R2 SOURCE-MANIFEST. No TS/locale/dependency/backend/migration change. R1 independent12/12 widths and17/17 maintenance remain valid for unchanged logic; new photo/directory geometry and return paths require narrow original-QA verification. Prior79 unit/type/i18n passes are reused, not rerun or counted anew. Speech NOT_RUN remains the accepted nonblocking limitation.

Original QA should check legal mixed component bindings and negative identity cases with isolated stubs; then the original desktop/second-page direct/two-level Escape paths with actual input baseline, URL, visible focus, directory layout and pending-image geometry. Check natural photo containment at the two widths. Preserve all old failures; no unrelated whole-suite repeat is requested.

Exact new-source CI/security, web artifact/manifest, native nginx parse of new full-page maintenance template, fresh production baseline/private consistent V27 backup/full38-table data comparison, controlled activation and public acceptance are **NOT_RUN**. Accepted782 core/native Java17/Compose evidence is reusable only with exact bytes and explicit component source; fc57 core is not equivalent. Production was last read15:01UTC as20261107.1/fc57/V27; this turn made no SSH/production read or write, backup, migration, upload, restart, cleanup or activation.

Finalizer checks protected dirty script, accepted f71 adapter, production/recovery evidence, Costco handoff and original QA hashes. All production data including82799v2/560874v4/28668v4 must enter the eventual fresh baseline; no old backup restoration. Seven containers and Meelok claim untouched. HANDOFF records actual resource/root return and remaining gates.
