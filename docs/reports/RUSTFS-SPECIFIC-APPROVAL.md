# RustFS exact proposed security/test setup — NOT EXECUTED

This proposal creates no secrets, users, certificates, buckets, ports or services by itself. No production migration/cutover window is requested yet. Image1.0.4 is pinned to linux/amd64 manifest `sha256:e287e99762a4a3e7b706526e01f2ff755f67db165e9be9f6b907adc6fb6d6ee1`; do not use latest/alpha/CLI tags.

## Concrete production target and identities

- Existing Bobuy host185.184.223.41; one new container `bobuy-rustfs`; data only `/opt/bobuy/data/rustfs`. Private bucket **bobuy-media**, no anonymous policy, no bucket/object ACL, default object versioning disabled so identical CAS-key PUTs do not create duplicate physical versions. Do not mount the old MinIO directory.
- Exactly **two S3 credential identities**, each with its own access/secret pair: (1) RustFS bootstrap/root, reserved for bucket/IAM initialization and recovery, never mounted into application containers; (2) `bobuy-media-app`, scoped by `infra/rustfs/media-policy.proposed.json` to the Bobuy bucket/CAS prefix. Same limited application identity handles migration data and normal binary reads/writes; no third persistent migration account.
- Application permission: GetObject/PutObject/AbortMultipartUpload on `bobuy-media/blobs/v1/sha256/*`. ListBucket only on this private Bobuy bucket is proposed to distinguish missing objects from access denial during HEAD/retry validation; its exact necessity/behavior must be checked on1.0.4 before final approval. No all-bucket listing, IAM management, bucket policy/ACL change or object deletion. Existing application authorization still distinguishes merchant/private/public identities; shared physical hashes are not exposed as browser URLs or existence queries.
- Bootstrap uses the documented native SigV4 admin endpoints (`/rustfs/admin/v3/add-user`, add-canned-policy, set-user-or-group-policy) through a bounded operator helper with request bodies and credentials held in memory from restricted files, no secrets in CLI arguments/logs. Exact1.0.4 endpoint execution remains to be tested. Bucket creation/public-access blocking and binding this policy are the only intended administrative changes. Console remains disabled, so no new browser admin login or console port is needed.

## Secret persistence, access and recovery

Use `/etc/bobuy/secrets/rustfs/`, host root-owned0700, not Git/env interpolation/ChatGPT memory or the currently unresolved Windows SecretStore. Separate subdirectories and read-only individual file mounts:

| Material | Host storage | Container consumer |
|---|---|---|
| root access/secret pair | root-credential files, mode0400, file owner UID10001 for RustFS read | RustFS only, `/run/secrets/rustfs-root-access` and `...root-secret`; *_FILE variables |
| application access/secret pair | app-credential files, root-owned0400 | core-service only, `/run/secrets/bobuy-media-access` and `...secret`; Java explicit file provider |
| private signing CA key | `pki/ca-key.pem`, root-owned0400, never mounted | none; offline signing/recovery only |
| dedicated RustFS server TLS key | `pki/server-key.pem`, UID10001 mode0400 | RustFS only, native TLS key filename via read-only bind |
| CA certificate/server certificate chain | nonsecret certificate files, readable read-only | CA cert to core-service only; chain to RustFS |

The existing application image runs as container root, so a root-owned0400 individual bind can be read without granting another host account access. Do not mount the whole secrets directory. AI and other services retain transactional PG/outbox writes without credentials; only core media reads and the explicit migration worker need S3 access. Verify actual routing before activation.

User retrieval uses the **existing authorized root SSH channel** into this host, not a new permanent SSH account or a plaintext chat response. Before generation, user must approve restricted-file persistence and this retrieval/recovery route. Values remain available in those files across service restarts; they are not promised recoverable after host-disk loss without a separately agreed encrypted backup. Since all PG binaries remain, lost RustFS credentials/data can still be reinitialized and rehydrated from PG during this phase; no irreversible PG cleanup is approved. No credential has yet been generated.

## Exact network and TLS delta

Read-only inspection confirmed the existing **bobuy-net** bridge network is not Docker-internal, but only Bobuy containers were attached at inspection. Reuse it; attach only `bobuy-rustfs`, with alias `bobuy-rustfs`. **No host-port publishing, firewall rule, public DNS, gateway route, external bucket or other-project network change.** Existing public gateway80/443 stays unchanged. Do not claim this existing network blocks all egress.

Native RustFS listener `:9000` uses TLS, endpoint `https://bobuy-rustfs:9000`. A dedicated private CA and dedicated leaf certificate with SAN DNS:bobuy-rustfs are proposed, avoiding wider access to Bobuy's public Let's Encrypt private key. This entails **two new TLS private keys** in addition to the two S3 credential pairs; CA key never enters a container. The leaf key is mounted only to RustFS. The CA certificate is installed only in this SDK client's trust manager (not the host/JVM/browser global trust store); hostname and expiry verification stay enabled. No insecure HTTP/trust-all switch exists in the adapter. Certificate issuance/secret mounts/new service-network membership require specific approval. Renewal/restart must be rehearsed before production dependency is enabled.

## Test-environment request, separate from production

Resume the **existing** stopped `bobuy-local` project on OHR: postgres18/backend/web/rabbitmq/redis/mail and their current volumes, no reset or data replacement, then add only the needed RustFS service to the same compose project. Current local Bobuy ports remain127.0.0.1:18080 and18025; RustFS publishes no host port. Synthetic-only bucket/credentials/CA material stay in a test-only restricted directory, never production keys or566 real image copies. This starts existing services and consumes CPU/RAM/disk; do it only after confirming no other operator is using the shared fixture. No test container was started in the offline batch. New container/data/mount configuration should be reviewed together; no parallel stack or other project's credentials/storage.

## Rollback and later cutover

Revoke/disable app identity, stop new RustFS service, switch reads to retained PG and stop transfer worker. Preserve object data, PG binaries and reference/outbox audit rows; no prune/deletion. Default RustFS adapter and preferred reads remain false; no scheduler/startup backfill exists. V21 is additive metadata only, but production application deployment/migration approval is separate. **No production downtime estimate is asserted:** measure test startup/transfer/delta reconciliation/PG fallback/restore first, then request one exact service rollout and final-write-freeze window. The prior PG-image maintenance approval does not cover it. Currency f747041, post3 upload permission, SMTP, registration, sales, PG18 and content publication are excluded.
