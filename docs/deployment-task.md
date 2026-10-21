# Bobuy deployment task

## Local Docker coordination hold (2026-10-22 JST)

Objective: provide a quiet local Docker maintenance window while preserving
running business services. Allow any active build to finish naturally, then do
not start local builds, cache cleanup or container replacements until a resume
notice arrives in this chat. Inspect build records and local build processes
read-only; report the observed state here without messaging other chats.
Acceptance: no local build owned by this chat remains active; no stop, prune,
replacement or remote production change is performed for this coordination.

Observed result: PASS for this chat's quiet window. All Bobuy build records are
Completed, including the five final service builds. Shared builder still reports
candidate (build), ref e09jofgvou4h6lrfekwox1ipf, Running, created
2026-10-22 01:10:51 JST; a local docker build client PID 45104 was observed.
Global Docker inactivity is NOT confirmed. No active build was interrupted,
and no container, cache or production service was changed. This chat remains
on hold for local Docker mutations until the resume notice.

Date: 2026-10-21 (Asia/Tokyo)

## Objective

Rename sunshaoxuan/bobbuy to sunshaoxuan/bobuy. Deploy on the
RHOSPITAL-GREENCLOUD-DR-JP node managed by server-admin-app.
Configure bobuy.cc with Cloudflare HTTPS.

## Requirements and boundaries

- Dedicated Docker project, images, networks and volumes.
- Preserve existing games, standby images, sleep policies, routes and data.
- Never record authentication secrets.
- Production deployment and domain configuration are authorized.
- Exclude unrelated application and infrastructure changes.

## Method

1. Read repository and server-admin-app instructions and deployment documents.
2. Inspect app requirements, node resources, ingress and Cloudflare access.
3. Record protected-resource baseline and isolated deployment boundaries.
4. Rename repository, update references and prepare deployment configuration.
5. Test, deploy, configure DNS/TLS and verify public application behavior.
6. Compare protected state, record actual results and commit scoped changes.

## Acceptance

Canonical repository name bobuy; healthy dedicated Docker project; persistent
app data; valid HTTPS at bobuy.cc; unchanged protected resources; relevant
build/tests and browser console/network, responsive and screenshot checks.
Visible UI changes require additional visual review gates.
Record actual PASS, FAIL or incomplete evidence for every requirement.

## Evidence and status

- Local directory initially has no commits, files or remotes.
- GitHub connector confirmed repository and admin permission.
- Implementation and production inspection recorded below.

## Observed baseline and deployment decision

- GitHub renamed to sunshaoxuan/bobuy; local origin updated.
- Target SSH identity verified using existing known_hosts and managed key.
- Node: 7894 MiB RAM, 5976 MiB available, 34 GiB free disk at inspection.
- Protected: rhospital-ha-bbs-replica, rhospital-ha-game-replica,
  rhospital-etcd, stopped rhospital-postgres-dr, existing hospital-backend images,
  replication tunnels and firewall units. No restart, prune or policy changes.
- bobuy.cc already points to the target; nameservers are Cloudflare.
- Preserve all existing service shells and core-only Flyway ownership.
- Production overlay uses /opt/bobuy data, bobuy project/container/image names,
  bobuy-net, no published management ports, bounded JVM/container memory.
- Optional OCR stays off pending a separately verified capacity budget.
- TLS uses a dedicated bobuy.cc certificate and same-origin secure cookies.
- No application UI changes planned. Browser verification covers deployment.
- Official MinIO registries fail to resolve the original image. Build the fixed
  upstream RELEASE.2025-10-15T17-29-55Z into a dedicated bobuy/minio image;
  preserve the S3 interface. Upstream repository is archived, so future storage
  maintenance remains an operational risk requiring a separate migration task.

## Verification progress

- PASS: backend tests, 175 total, zero failures, two external AI manual tests skipped.
- PASS: frontend build and 74 tests after using the task-local temporary directory.
  Initial highly parallel run had temporary-file IO errors; rerun completed cleanly.
- PASS: production isolation validator, including exposed-database negative case.
- PASS: infrastructure health for PostgreSQL, Redis, RabbitMQ and Nacos.
- PASS: protected resource snapshot unchanged after infrastructure startup.
- PASS: origin certificate issued through 2027-01-19; Cloudflare Universal SSL
  active, Full (strict) saved and Always Use HTTPS enabled.
- Resolved runtime blocker: authenticated GET /api/auth/me deleted the CSRF cookie.
  Trace identifies Spring Security's default CsrfAuthenticationStrategy clearing
  it on Bearer authentication. Add a regression test and retain explicit login
  token issuance, refresh validation and logout clearing in AuthCookieService.
  Disable only the session-based CSRF authentication strategy for stateless JWT.
  Rebuild affected service images and repeat browser and security checks.
- Protection snapshot correction: Docker inspect returns mounts in unstable order.
  Raw game-replica hashes alternated between the original baseline and a second
  value. Six reads with mounts sorted by Destination produced one stable digest.
  Original baseline retained; canonical baseline will preserve this reconciliation.
- Residual: npm runtime audit reports three moderate findings; zero high/critical
  runtime findings. Full development dependency tree has additional findings.
- Fixed release 20261021.1: backend regression failed against the original code
  and passed after the stateless authentication strategy fix. Complete backend
  run: 176 tests, zero failures/errors, two external AI manual tests skipped.
  Five service modules packaged and images built successfully.
- Certificate renewal is explicitly scoped to the bobuy.cc certificate name.

## Final Acceptance

- PASS: canonical GitHub repository and origin are sunshaoxuan/bobuy.
- PASS: release 20261021.1 imported; 12 containers running, all 10 configured
  health checks healthy, zero restarts and no OOM flags. Nacos init exited 0.
- PASS: only Bobuy gateway publishes 80/443; independent project, network,
  credentials and persistent data. Three Flyway migrations applied successfully.
- PASS: protected resource comparison after the application upgrade is identical
  to the reconciled canonical baseline. Original raw baseline retained on node.
- PASS: public HTTPS 200 through Cloudflare, /health returns gateway-service ok;
  HTTP and HTTPS www redirect to canonical HTTPS. Full (strict) read back in UI.
- PASS: desktop 1440x1000 and mobile 390x844 browser login, dashboard reload,
  refresh, logout, secure cookies, anonymous rejection and CSRF negative cases.
  Console/page errors and browser HTTP errors: zero. One aborted Cloudflare RUM
  telemetry request is recorded separately from application requests.
- PASS: screenshots inspected in deployment-evidence/. No horizontal overflow.
  Existing mobile full-page blank overflow is recorded, outside UI change scope.
- PASS: backend 176 tests, zero failures/errors, two external AI tests skipped;
  frontend 74 tests and production build; service packaging; isolation gate and
  its published-database negative case. Regression fails before the CSRF fix.
- PASS: scoped bobuy.cc dry-run renewed both apex and www successfully;
  nginx configuration validation and reload succeeded. Dedicated renewal timer
  is enabled and active. Script executable permissions verified after transfer.
- PASS: final isolation positive/negative validation, Python source syntax,
  JavaScript source syntax and git whitespace checks.
- PASS: source committed and pushed as 28d37e14ff2253dd00fd20b88d935872ec3b9a4d;
  origin/main read back at the identical SHA. Worktree clean after that commit.
  No matching new GitHub Actions run was returned at the delivery check;
  automated CI success is not claimed. Local and production checks are above.
- INCOMPLETE: cleanup commands were rejected by the execution policy. Local
  .task-tmp, ignored build outputs and remote transfer archives remain confined
  to this task's directories. No cleanup success is claimed; no global prune or
  alternate deletion mechanism was attempted. Formal evidence is retained.
- Product scope limits: external AI/OCR unconfigured; internal MinIO attachment
  URLs need separate public-access work. Full business acceptance and visual UI
  conformance are not claimed. Storage upstream maintenance and dependency
  advisories remain recorded in production-deployment.md.
