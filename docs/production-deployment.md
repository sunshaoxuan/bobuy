# Bobuy production deployment

## Current Status (2026-10-25)

Production runs 20261025.2 from candidate 1c8d255, with regional delivery
implementation 68c88fd. Flyway V1-V6 succeeded. Trip creation accepts only
deliveryArea and deliveryDate; current authenticated administrator ownership and
existing RBAC remain. Procurement, delivery and settlement drive trip status.
Real HTTPS desktop/mobile independent sessions created trips, refreshed
concurrently and retained the mobile session after desktop logout. Labelled
zero-value fixtures were removed; production returned to one user and zero
trips, orders, products and wallet transactions. REPORT-21 and PLAN-63 contain
the release, browser and runtime evidence.

The first attempt 20261025.1 stopped before migration on an equivalent-schema
fingerprint mismatch and recovered 20261024.1. The corrected gate reparses CHECK
definitions through PostgreSQL and ignores physical dropped-column ordinal gaps;
data, semantic column definitions, indexes, constraint metadata and sequences
remain checked. Isolated restore and genuine constraint-mutation rejection passed.
Both attempts' recovery material remains under /opt/bobuy/releases/.
V6 rollback requires stopping writers, restoring the verified V5 snapshot and
switching to the matching 20261024.1 images together. Never connect old code to V6.

### Previous User-Management Release

Release 20261024.1 used implementation c17ff0d. Platform administrators
can create and edit users at /admin/users, with CUSTOMER and AGENT selected
individually or together. Checkout registration is fixed to CUSTOMER in code;
production public registration remains HTTP 503 pending SMTP, abuse and recovery
gates. REPORT-20 and PLAN-61 remain the user-management release receipts.
The 2026-10-24 continuation reverified live login, exact frontend assets, security
and 16 viewport/locale combinations. No duplicate deployment was required.
Release-specific configuration and receipts below describe the earlier storefront
publication and must be read with this current status.

## Boundary

Repository: sunshaoxuan/bobuy. Target: RHOSPITAL-GREENCLOUD-DR-JP.
Install root /opt/bobuy; Compose project bobuy; network bobuy-net.
All application images use bobuy/* release tags. Persistent bind mounts are
under /opt/bobuy/data. Only the dedicated gateway publishes TCP 80 and 443.
Existing rhospital containers, image tags, tunnels and sleep policy are protected.
Never run global Docker cleanup or modify their Compose projects.

## Configuration

Release 20261023.1 is published for the public storefront. The previous release is
20261021.1. Publication status is recorded in deployment-task.md and release
evidence under docs/reports/evidence/release-20261023.1/.

Preflight found one operator and no products, trips or orders. Never insert local
demo data during release. Public signup/email routes return explicit HTTP 503
at the sole public ingress until formal SMTP, abuse quotas and account recovery
gates pass. Existing merchant login remains available at /admin. This release is
a storefront preview; full public-registration readiness is not claimed.

Use docker-compose.yml with compose.production.yml, Docker Compose >=2.24.4.
Supply --env-file /etc/bobuy.env for every command. This root-only file contains
independent random database, object storage, RabbitMQ, JWT and service secrets.
Set BOBUY_RELEASE to the imported release tag. Set secure refresh cookies true,
header authentication false, demo seeding false and allowed CORS origin
https://bobuy.cc. Never reuse the repository development environment file.
Optional OCR is excluded from normal startup; AI integrations require separate
provider configuration and capacity verification.
Create the initial operator with scripts/bootstrap-production-owner.py after
schema migration. It accepts only an empty user table and stores its randomly
generated credentials in /etc/bobuy-admin.json with mode 0600 on the node.
The bootstrap uses the node's Python 3.12 crypt BCrypt support.

Current production operator username is admin following the user-authorized
2026-10-23 rename. Its ID and AGENT permissions are unchanged. Password is stored
only in the root-only credential file; no universal default password. Rotation
revoked the account's prior refresh sessions. Existing signed access JWTs retain
their configured expiry; this operation did not rotate the shared signing key.

The original MinIO container registries are unavailable. Build
infra/minio.Dockerfile from the fixed upstream release into bobuy/minio.
The upstream community repository is archived; track storage maintenance as an
explicit residual risk. Replacing the storage engine requires its own verified
migration and is outside this deployment's scope.

Start infrastructure, then core-service to apply Flyway migrations, then the
remaining service shells and gateway. Only core owns Flyway. Back up the Bobuy
database and data before subsequent upgrades. Review migration compatibility
before application rollback; never roll back schema by deleting data.

## TLS and renewal

The dedicated Nginx config redirects HTTP and www to https://bobuy.cc.
Origin certificate: /etc/letsencrypt/live/bobuy.cc. ACME challenge webroot:
/opt/bobuy/data/acme. Install the service and timer in infra/ into
/etc/systemd/system and enable bobuy-cert-renew.timer. The renewal script
uses only Bobuy mounts and reloads only bobuy-gateway after nginx validation.
Cloudflare apex and www records should be proxied with Full (strict) TLS.
Preserve existing MX and TXT records.

## Verification

Run python scripts/check-production-isolation.py locally before deployment.
Record scripts/protected-node-state.py output before and after deployment;
compare protected container identities, start times, restarts, config hashes,
protected image references and service state. Verify Compose health, public
HTTPS, redirects, login, secure cookies, unauthorized access rejection, browser
console/network and desktop/mobile screenshots. Record actual results in
deployment-task.md. The previously accepted storefront assets are published
unchanged. Run BOBUY_RELEASE=20261023.1 node scripts/verify-production.mjs with
the existing local group available for browser-only fixture checks. Real
production empty-catalog screenshots and fixture screenshots remain separate.

The deployment fixed an existing stateless JWT/CSRF interaction: authenticated
reads cleared the refresh CSRF cookie. AuthCookieService retains ownership of
login/refresh issuance and logout clearing; session-based CSRF authentication
clearing is disabled. Missing and forged refresh CSRF tokens remain rejected.

## Remaining Product Limits

External AI credentials and optional OCR are unconfigured. Two manual external
AI tests are skipped. ImageStorageService currently builds object URLs from its
internal MinIO endpoint, including signed previews. Public attachment URL behavior
is unverified and needs a separate storage URL configuration change and tests.
The merchant admin mobile full-page screenshot still shows excess blank overflow
below its visible viewport. Record this as an existing visual failure, separate
from functional login/reload checks. The public storefront now serves the accepted
宝宝败 masonry design and lighter overlay from 9924339, with no further design
changes during release. Production catalog is empty; fixture screenshots are
browser-only checks and do not prove real inventory or complete business readiness.

The frontend audit found three moderate runtime dependency advisories and
additional development advisories. No dependency upgrades were included.

## Earlier Storefront Release Receipt

Source: 19e5203fe21b9285a3960173b52a036a28916024; images: 20261023.1.
See [REPORT-18](reports/REPORT-18-生产商城预览发布.md). Release staging and root-only
backups are at /opt/bobuy/releases/20261023.1/. Old 20261021.1 images/config remain
available. V4 is additive for this empty pilot; app rollback retains the schema
and data, and requires a compatibility check. No destructive schema downgrade.
scripts/publish-production.py compares restored table content, columns, indexes,
constraints and sequences with the actual stopped-writer snapshot. It rejects
any difference before migration, independent of pilot account counts. Never repeat a partially completed publish
blindly; inspect its receipts and current service state first.

Future user-requested changes may publish after the affected tests, build,
isolation/migration checks and production browser verification. Reuse this group;
no automatic scheduler or extra environment was created.
