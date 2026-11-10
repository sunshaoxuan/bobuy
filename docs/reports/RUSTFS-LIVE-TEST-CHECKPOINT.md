# RustFS approved local test checkpoint — 2026-10-28 01:35 UTC

Historical first checkpoint. Later real application/Flyway and product-archive acceptance supersedes its pending items: see `PRODUCT-ARCHIVE-RUSTFS-APPLICATION-ACCEPTANCE.md` and final restoration evidence.

Candidate base: `90ff0ebaf6c1415e002f881e0d7ace6cd5a81ce5`; policy/test corrections below are local uncommitted changes. This checkpoint is not a production release.

Only the approved OHR0067 existing `bobuy-local` fixture was used. Production was not contacted or changed by these live tests; no production image bytes were copied. All six original containers were stopped before the test, and all six plus the new RustFS container are stopped again afterward. Existing volumes were not reset.

## Actual setup and recovery

- Official RustFS 1.0.4 amd64 image pinned at `sha256:e287e99762a4a3e7b706526e01f2ff755f67db165e9be9f6b907adc6fb6d6ee1`.
- Nonroot service, 1,073,741,824-byte memory limit, 1 CPU, zero published host ports. Dedicated native TLS passed hostname/CA validation from the container. No system/browser/global JVM trust was changed.
- Eight test credential/certificate files persist only in the restricted `.task-tmp/rustfs-local-secrets` directory. Inheritance is disabled and the ACL permits only the current user, SYSTEM and Administrators. Private CA key is not mounted. No credential values are in this report or Git.
- Test private bucket `bobuy-media-test` and one app identity were created. App allows only ListBucket on that bucket and GetObject/PutObject/AbortMultipartUpload in its CAS prefix. No object delete or administrative grant was added. Root credentials are not application credentials.
- Initial policy creation returned 400. A diagnostic write retry was rejected by automatic approval review and did not execute. Subsequent read-only policy lookup returned 404. Official 1.0.4 source exposed two policy-contract errors: mixed S3/admin actions in one statement, and naked `*` resources instead of ARNs. After bounded corrections, create/bind/readback each returned 200. Failed attempts and the review rejection remain failure evidence.
- Native PowerShell ACL setup initially hit a Windows domain-trust lookup error before secrets existed. The same approved ACL was established using raw SID identifiers through icacls; no security scope was broadened.

## Actual protocol evidence (not the Java adapter)

The container's curl SigV4 client used the limited test identity and dedicated CA. Synthetic valid PNGs only:

- Small PUT/GET preserved bytes, SHA metadata and image/png.
- A 7,081,642-byte PNG completed in two multipart parts and GET matched all bytes; separate unfinished multipart abort returned 204.
- Range GET returned 206 with the requested bytes; invalid range returned 416.
- Anonymous GET, object DELETE, outside-prefix PUT and IAM list-users each returned 403. The denied delete left the object readable and unchanged.
- Own-bucket ListObjects succeeded. Root ListBuckets returned **200 filtered to the single permitted test bucket**, not 403; this is a compatibility observation, not proof of a denied all-bucket HTTP operation. Isolation against a second existing bucket was not exercised.

The runner's `pass` means its wire-roundtrip assertions completed, not that every planned migration/application acceptance criterion passed. Java SDK integration, HTTP application routing/fallback, CAS multi-reference/concurrency against real RustFS, TLS rotation, Flyway startup, and browser acceptance are still pending. Existing matching offline tests remain separate evidence.

## Actual PG18.6 additive DDL and restore evidence

The existing local synthetic V20 backup was restored into the disposable `bobuy_rustfs_v21_test_20261028` database in the existing local PG container. V21 DDL created four media tables and preserved all rows of the 31 existing tables, including 14 images / 846,106 bytes. A new custom-format backup was restored again; existing-table fingerprints, 292 constraints and sequence values matched. The disposable database was removed and the original PG stopped state restored. Existing fixture database was not migrated or replaced. This is real PG DDL/restore evidence, **not** an application/Flyway startup pass.

Backup SHA256: `d0ae4a6de641e73145059758480234597eb96a8dd8b57b25706532f484fa6798`.

Five affected RustFsObjectStoreTest cases passed with no failures/errors/skips; the new case guards the known policy syntax/allow-list contract. Other unchanged offline evidence is reused, not rerun.

## Next scope and limits

Finish real Java/application + outbox/CAS tests in the existing fixture, then review production-specific secret/TLS/network proposal and measured rollout/rollback plan. Production identities, 566-object migration and production activation remain unapproved and unexecuted. GC remains audit-only. Test objects, credentials and the new test volume remain retained; no physical object cleanup was performed.

Product archive/navigation consolidation is queued as a separate UI change; no such implementation is claimed here. Independent currency commit f747041 is preserved on local main. Daily media operations stay browser uploads; no new persistent local-file access capability or extension fileURL permission was added.
