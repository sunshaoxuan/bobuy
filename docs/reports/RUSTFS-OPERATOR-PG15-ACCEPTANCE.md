# Resumable media operator and actual PG15 acceptance

2026-10-28. Local preparation only, following 6bc1dab. No production connection, image copy, credential creation, push or deployment occurred. Product archive/currency changes remain intact; no frontend change or repeated UI gate was needed in this batch.

## Operator contract

`MediaMigrationCommand` is an explicit boot-jar PropertiesLauncher command, not an HTTP importer, startup task or scheduler. It accepts PG as its authoritative binary source and writes only operator JSON/checkpoints to explicitly selected existing directories. It does not import local product/image files or grant browser fileURL access.

```sh
java -Dloader.main=com.bobbuy.service.MediaMigrationCommand -cp /app/app.jar \
  org.springframework.boot.loader.launch.PropertiesLauncher \
  --dry-run --report=/run/media-migration/run001.inventory.json

java -Dloader.main=com.bobbuy.service.MediaMigrationCommand -cp /app/app.jar \
  org.springframework.boot.loader.launch.PropertiesLauncher \
  --apply --checkpoint=/run/media-migration/run001.checkpoint.json \
  --report=/run/media-migration/run001.transfer.json --workers=2 --seconds=300

java -Dloader.main=com.bobbuy.service.MediaMigrationCommand -cp /app/app.jar \
  org.springframework.boot.loader.launch.PropertiesLauncher \
  --verify --report=/run/media-migration/run001.verify.json
```

- Default/no mode is dry-run. Dry-run reads PG only, does not create a Spring/Flyway context or an S3 client, and can inventory a pre-V21 schema. JSON report output is the only intended file write. `--verify` performs read-only PG and S3 GET/list operations and never repairs objects.
- `--apply` requires V21 to have already been applied; it never runs Flyway, seeds data, creates a bucket/user or changes policy. A minimal JPA-only context has no web listener. New CLI configuration is profile-isolated from normal application scanning.
- Source writes retain PG bytes. Resumable cursor scans only create/reconcile metadata/ref/outbox rows. Bounded workers reuse existing content-addressed objects after verification. There is no object DELETE, PG-image DELETE, binary clearing, GC executor or automatic activation.
- Checkpoints use a source database identity (including database OID) and a target endpoint/bucket identity, exclusive file lock, atomic replacement and fsync. A wrong source/target/format is refused. Reports cannot overwrite checkpoints/lock paths or unrelated operator files; symlink state paths are refused. A competing checkpoint owner cannot clobber the active owner's report.
- Controls: batch1–100, workers1–4, bounded pages/transfers and soft run deadline; individual S3 calls and operator JDBC connections/statements/lock waits are bounded. Exit0 means dry-run completed or verification passed, exit3 is incomplete/needs continuation, exit2 is stopped/error. A run near its deadline may stop with a durable checkpoint rather than claim completion. Use a distinct report filename per invocation, require successful exit/status and current timestamp, and retain failed reports.
- Resume uses the same checkpoint. New current-version writes below the saved cursor enqueue transactionally. All writer services must be upgraded before a production scan. If a legacy writer operated without outbox support, a new checkpoint can safely rescan all source rows; an incomplete inventory must never be waived. Corrupt existing remote content is reported, not blindly overwritten/deleted.
- Reconciliation streams every PG source row, recomputes raw SHA256, validates scope/type/size/reference/transfer metadata, checks each unique object's actual bytes/type/hash metadata, and independently lists the CAS prefix with cursor/duplicate guards. Totals include media rows/raw bytes, unique blobs/bytes, shared bytes, verified/pending rows, errors, listed objects/bytes and extras. Unknown extra objects are retained. `objectErrors` reflects affected source-reference checks plus listing inconsistencies, not a claim of that many distinct underlying faults.
- A second source fingerprint prevents a false completed report when source bytes change during verification. It is an as-of audit, not a guarantee against future writes; final cutover still needs a controlled increment/drain/verify boundary.

## Exact real PG15/RustFS rehearsal

The existing stopped `bobuy-local` postgres service was used sequentially, not a parallel stack. Official PG15.19 amd64 image was pinned to `sha256:031f734c375228d25dc805a9924512ecb4c27311d7eb3fa8b08e99c54859df81`. Compose5.6.1 `!override` replaced the PG mount with one owned synthetic volume; merged config and actual mount checks proved the original `bobuy-local_database18` volume was not mounted. Existing RustFS1.0.4/test bucket/app identity/TLS/1GiB/1CPU/no-host-port limits were reused; no second bucket or new credentials were created.

Only the disabled synthetic owner needed for image FK integrity was inserted; no login credential or merchant/admin identity was granted. Fixtures contained no real product/recommendation records or production image bytes.

Actual results:

1. Flyway built the V20 fixture on PG15.19:566 synthetic PNG media rows,500 unique raw hashes,68,111,874 bytes. A consistent custom-format V20 backup was saved.
2. The formal CLI dry-run before V21 passed without media metadata writes. Actual full application Flyway V20→V21 and Hibernate validation passed on PG15.19. Post-migration dry-run retained the identical source fingerprint and zero bound/verified transfer rows.
3. First formal CLI process used two pages/80 transfers, returned exit3 as intended and left80 verified rows plus durable cursor `synthetic-00099` (21.203 seconds).
4. A new formal CLI process resumed while another minimal-context writer inserted20 rows below that cursor and updated5 source rows. Actual write/process overlap was recorded. Final reconciliation passed:586 media rows,525 unique blobs,70,518,654 raw bytes,586 verified references,530 listed objects including5 previous test objects retained separately. Concurrent resume stage was46.129 seconds, including process/context work, transfer and audit; this is not a production downtime estimate.
5. A real PG15 V21 backup was restored into an independent temporary database. All table rows/image bytes, columns/indexes, every constraint including validation/deferral flags, and sequence values matched. Old source-bound checkpoint was actually rejected on the restored database without source changes; restored dry-run matched the final source fingerprint and586 verified rows. The restore database was removed.

Verified V21 synthetic backup:80,651,632 bytes, SHA256 `fd69d7521317f6792842ceac0e8b1209cd4228226c90eb5683eddabdc8ade033`. It remains local/ignored for recovery; no image dump is committed.

## Gates, failures and recovery

MediaMigrationExecutorTest6 cases passed: true read-only inventory, bounded/resumable cursor with lower-ID delta, independent corruption detection/no rewrite, concurrent source change preventing false verification, source/target binding and exclusive lock, and unrelated-file protection. Existing5 SDK cases retained PASS; new CAS-list pagination/prefix case passed separately. These H2/fake cases are not represented as real S3 evidence. Existing 6bc1dab application/S3/UI evidence is reused where unchanged.

Fixture-only failures remain failures: initial owner SQL used old role/omitted current roles JSONB; both transactions rolled back with0 images/users, then the exact V5 schema was used with a disabled CUSTOMER owner. The successful application fixture left an unmanaged JVM alive after its completion report; zero active writes were verified before terminating only that completed test process. Fixture success now explicitly exits, as the formal CLI already does; no successful migration was rerun. Raw restored CHECK text differed due PostgreSQL's reparsing of array casts. The existing `publish-production.py` parser-normalization gate was reused, preserving every constraint and its flags, rather than removing checks or repeating restore.

Final restoration passed: original six service image IDs restored, all seven services stopped, original PG18 volume/V20 summary unchanged (34 products,60 recommendations,14 images/846106 bytes), and backend test mounts removed. Only this newly created, no-longer-referenced synthetic PG15 volume was removed after verified backup/restore; all original volumes, test RustFS objects and backups remain. No production data or other project was touched.

## Approval and remaining readiness stages

1. Optional exact additional test approval: create one empty private bucket `bobuy-media-test-denied` on the same approved test RustFS, using the existing root only for creation and existing app for negative reads/listing. No identity/permission/public port expansion. Not executed. ListBuckets currently returns200 filtered to the sole allowed bucket; cross-bucket isolation cannot be inferred from that.
2. Production security approval remains required: host185.184.223.41; one `bobuy-rustfs` service with pinned1.0.4 digest, private `bobuy-media`, existing `bobuy-net` alias `bobuy-rustfs`, console off/no host ports. Exactly root/bootstrap and limited app credential pairs; no third migration identity or app delete/IAM grant. Private CA and server TLS key, SDK-only CA trust, hostname/expiry checks. Restricted `/etc/bobuy/secrets/rustfs`0700, individual0400 secret mounts (root to RustFS only, app to core/operator only, CA private key never mounted). Metadata state `/var/lib/bobuy/media-migration`0700 mounted RW only to operator/core; secret mounts remain RO. Existing authorized SSH is the recovery/retrieval path, not chat/Git. Host capacity must be rechecked; no production keys or service were created.
3. After approval, stage private service/TLS and recovery material first with reads still PG; then separately approve the final application/V21 deployment window after exact candidate/CI/images and rollback material are bound. All writers must use the outbox before online copy. Reconcile and drain increments before a separately confirmed read switch; preserve source bytes and retain the new logical-delete/authorization code when rolling back to PG reads. No PG18 production upgrade is bundled.
4. Still independent readiness work: actual TLS renewal/native service-outage latency drill and the steady-state increment-worker activation plan. This command is an explicit bounded operator, not an automatically running daemon. Current writes intentionally retain PG binary staging/rollback copies. Safely releasing PG binaries and transitioning away from permanent dual storage needs its own compatible design/acceptance and specific cleanup approval after migration, not a false claim that this prep has already removed PG storage.

No production cutover window is asserted from the synthetic46-second stage. Currency Basic data and unified product archive are included locally but remain unpushed/undeployed. Daily content remains normal webpage upload; no new operational local-file access feature was introduced.
