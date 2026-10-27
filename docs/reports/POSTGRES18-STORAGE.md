# PostgreSQL 18 and retirement of the object-storage dependency

**Latest checkpoint:** [approved real restore, final local acceptance and proposed cutover](POSTGRES18-RESTORE-ACCEPTANCE.md). The earlier blocked restore and Flyway warning recorded below are resolved; production activation is still pending.

## Current checkpoint — preparation, not production cutover

Production remains release **20261027.1**, PostgreSQL **15.19**, migration **V17**. No production outage/write freeze, mail activation, image deletion or data-directory deletion has occurred. The application candidate is modified locally and is not yet committed/pushed for this batch. RustFS is outside this engineering batch and is not installed.

Bounded scope: retire the project's object-storage SDK/service/config/proxy/backup dependency; retain image bytes in the existing PostgreSQL table with explicit public/private access; upgrade PostgreSQL through verified dump/restore into a separate 18 directory; preserve all business data, accounts, roles, sequences, constraints and rollback data. Historical release evidence remains historical; it is not an active storage prerequisite.

## Version and source binding

On 2026-10-27 the [official release notes](https://www.postgresql.org/docs/release/) list **18.6** as the latest released 18.x. Version 19 is a release candidate and is excluded. The [official Docker image](https://hub.docker.com/_/postgres) offers `18.6-alpine3.23`:

- Multi-platform index: `sha256:1a0c23d53c1ad77468c8653fa6eed4f4105cfbef9e6f027bc1dfeb16949a8c29`.
- Linux amd64 manifest: `sha256:dd504ba15d335bb17f83ed48a75899501be82726126a691f597fb91e1e505373`.
- The local official pull resolved that same index. Compose/local/CI now pin the tag and index digest; production activation is still pending.

Official 18 images change PGDATA to `/var/lib/postgresql/18/docker` and the mount to `/var/lib/postgresql`. Candidate production storage uses `data/postgres18` at that parent mount. The original `data/postgres` is retained. Local service uses a distinct `database18` volume; the previous 16 volume remains intact. Do not point 18 at the old data directory or prune either version's rollback data.

## Actual production storage audit

[Audit](evidence/postgres18-storage/audit-before.json): authenticated read-only S3 inventory found exactly one bucket, `bobbuy-media`, with **0 objects, 0 bytes, 0 versions, 0 delete markers**, and no truncated version listing. PostgreSQL text/JSON fields had no legacy object URL references; procurement receipts, expenses and their object-key references were all zero. This does not authorize deleting the directory: its system/config data must be archived before the retired service is stopped/removed during an approved cutover.

Database size was 101,252,455 bytes, with 27 public tables and 3 sequences. Only `plpgsql` is installed. Locale is libc `en_US.utf8`, with no stored/actual collation-version mismatch. The sole non-system role is `bobuy`; its existing rights are captured, not broadened. The 142 masters, 152 recommendation occurrences and 566 image blobs remain production data and must retain original IDs, bytes, publication state and sales state.

## Implemented candidate

`ImageStorageService` now writes validated PNG/JPEG bytes to the existing `bb_recommendation_image`, reusing validation limits and merchant-scoped deduplication. V19 adds `access_scope` with PUBLIC as the existing-row default; no original image byte, hash or ID is rewritten. Receipt images use PRIVATE scope, an authenticated `/api/merchant/media/{id}` route, ownership checks and no-store responses; the public image route rejects private IDs. The frontend fetches private bytes with bearer authentication and revokes browser blob URLs. Product photography retains public media behavior.

The SDK dependencies, build recipe, Compose service/dependencies/environment, Nacos fields, nginx object proxy, environment template and object-storage backup requirement have been removed from the candidate. Old `/media/` URLs return 410; the audited production database has no such references. Receipt and expense preview workflows use the new storage; actual UI acceptance against PostgreSQL 18 is pending. Documentation/runbooks now point here. Historical reports/plans are retained as evidence rather than rewritten to pretend earlier releases used the new architecture.

Verification so far: image/receipt/recommendation affected backend tests **28 PASS**; frontend image/procurement tests **3 PASS**; TypeScript/Vite and i18n build PASS; publisher tests **9 PASS**; Compose production isolation and published-database negative case PASS. Existing image tests verify anonymous/customer/cross-merchant rejection, public-route privacy, invalid/oversized image rejection, deduplication and public-product compatibility. No relevant gate was lowered.

## Backup and local 18.6 restore evidence

An online source backup used `pg_export_snapshot()` plus `pg_dump --snapshot`, with a retained read-only source transaction for all row/metadata hashes. Production stayed online and writable. A separate private globals backup retains role recovery material. Backup files are outside Git, server directory `/opt/bobuy/backups/pg18-preflight-20261027T024113Z`, mode restricted by umask 077. Manifest:

- Source 15.19, 27 tables, elapsed **17.24 seconds**.
- `database.dump`: 69,999,161 bytes, SHA-256 `86fd87b85ccf650fda057769024dbbcad3a5badf144f6223241ff7d9bd149025`.
- Globals and fingerprint artifacts are present; their contents and credentials are not printed or committed.
- The source production backup has been copied privately for a real 15→18 restore rehearsal; **that restore has not yet executed**.

The existing shared local PostgreSQL service was upgraded from **16.13 to 18.6**, without a parallel test stack and retaining the old volume/image. Its 30-table fixture backup restored in **39.33 seconds**, including role settings. All row hashes, columns, indexes, sequence states, owners, privileges, roles, memberships, extensions and locale/sort probes match. Thirteen CHECK definitions had different cross-version textual rendering; each old definition was actually parsed on 18 in an empty temporary table and rolled back, matching the restored predicate and validation metadata. Original differences are retained, not stripped from evidence. [Local result](evidence/postgres18-storage/local-pg18-upgrade.json). Three verifier semantic-negative/scope tests also pass. The original local application was restarted after this check.

The first attempt at local inspection failed before any service mutation because Windows default cp932 could not decode Docker metadata. The helper now explicitly uses UTF-8. A second stop at constraint-text mismatch was resolved by the PostgreSQL-parser comparison above; no constraint or migration-history repair was applied.

## Remaining gates and required production window

1. Restore the real production 15.19 backup into a disposable database in the existing local 18.6 service. Verify every table/hash/column/sequence/constraint/owner/ACL/role, JSONB and image bytes; retain restore timings. Do not overwrite the local fixture database or replace its credential with the production role password.
2. Load the frozen candidate into that same local environment, apply compatible V19 (and verify the already present V18), run actual image upload/reopen/private preview plus public recommendation/browser checks, and verify JDBC/Flyway compatibility on 18.6. Capture any warning instead of calling it certified support. Current driver/Flyway are unchanged pending that evidence.
3. Complete final source/dependency/publisher/upgrade-tool checks, commit and use one exact-candidate CI run. A candidate release based on current main also contains the inactive additive V18 mail tables/code; **no mail key, credential, SMTP setting or registration opening is authorized or implied**. This membership must be explicit in the release receipt.
4. Provide the measured downtime/write-freeze estimate, exact cutover and rollback triggers to the parent for confirmation **before production interruption**. The online preflight backup is rehearsal evidence, not the final cutover snapshot. At the approved window freeze API writes and stop all application writers, take a fresh consistent DB/globals backup, archive the retired storage directory/config, restore to the new 18 directory, verify before opening writers, activate the tested application/config, and verify again before removing maintenance.
5. On failure before writes reopen, stop new writers and reconnect the unchanged original 15 directory/config/images, then verify health/data. Do not restore an older whole DB over legitimate post-cutover writes; if any occurred, stop and reconcile before rollback. Keep rollback directories and recoverable backups regardless of image cleanup.
6. Only after successful production switch and acceptance: stop/remove the retired project container without volume deletion, inventory every container/tag reference, confirm exact old images are unreferenced and retrievable, then remove only those explicitly identified image IDs/tags without force/prune. Do not touch shared/other-project images or delete old database/storage directories.

Production freeze approval has not been requested yet: the real-source restore and final UI gates above must finish first. No production downtime or destructive cleanup is currently pending execution.

## Follow-up checkpoint: independent fixture acceptance and blocked private restore

The attempted `restore-production-pg18-rehearsal.py` action was rejected by automatic approval review **before the process was created**. Exact proposed destination: existing OHR0067 `bobuy-local-postgres-1`, independent temporary database `bobuy18_restore_20261027`. Reason: the backup contains private production user data and review requires explicit user authorization for this sensitive copy destination. No restore database was created and no source row was restored. The action was not retried or routed to another destination. A concrete approval must name this host/service/temporary database, project-only validation use, no external disclosure and eventual removal of the temporary copy while retaining recoverable backups. This remains an unmet production-upgrade gate, not a passing rehearsal.

Independent work continued solely on the existing synthetic local fixture. No concurrent local UI test was identified, original product count remained 33, and the candidate was staged in the same existing application/container. V19 applied successfully on PostgreSQL18.6; original application class bytes match the candidate with only the preexisting local V7/V8 compatibility resources retained. No retired SDK remains in the packaged backend libraries. [Package proof](evidence/postgres18-storage/local-package.json).

[Actual browser fixture result](evidence/postgres18-storage/browser.json) passes visible synthetic PNG upload, expense save, page reload/reopen, bearer-authenticated private blob preview, mobile layout and anonymous HTTP refusal. The private image was not made public. Mobile screenshot was inspected; the desktop functional image-loaded assertion passes but its screenshot did not fully capture the animated modal and needs a corrected stable-frame capture before final visual acceptance. A fixture-file-path failure occurred before save and was fixed; the later anonymous rejection-navigation harness failure was resumed against the same saved record without duplicate creation. The only created synthetic expense, its matching audit row and new unreferenced private image were then removed with exact marker/ID guards. All preexisting image IDs remain, no whole-database restoration or sequence rewind was used, and no unrelated local change was overwritten. [Cleanup proof](evidence/postgres18-storage/ui-fixture-cleanup.json).

[JDBC/Flyway probe](evidence/postgres18-storage/local-jdbc.json): actual target18.6, pgJDBC42.7.11, V19 validation PASS; Japanese JSONB, bytea and identity/CHECK write/read in a rolled-back temporary table PASS. The existing JRE lacks a source compiler, so the helper was compiled by the existing JDK to Java17 bytecode and executed without installing software. **Flyway10.15.2 emits an explicit newer-database warning that its latest tested PostgreSQL version is16.** This is retained in the log; empirical local validation does not establish vendor-tested18 support. Resolve the narrow Flyway compatibility dependency and retest affected paths before final candidate freeze/CI.

This storage batch still has no commit/push/CI run. Prior `0369a4c` CI success belongs to the preceding mail-settings candidate, not these storage changes. No background restore/build/test process remains at this checkpoint. Production remains unchanged; mail keys/SMTP/registration/sales stay untouched. Next work is the specific sensitive-restore approval, Flyway compatibility, stable desktop/public-image visual acceptance and exact-candidate CI. The measured17.24-second online source backup and39.33-second local16→18 restore are available, but a production15→18 cutover duration is not yet validated, so no production outage window is requested or authorized yet.
