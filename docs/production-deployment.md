# Bobuy production deployment

## Boundary

Repository: sunshaoxuan/bobuy. Target: RHOSPITAL-GREENCLOUD-DR-JP.
Install root /opt/bobuy; Compose project bobuy; network bobuy-net.
All application images use bobuy/* release tags. Persistent bind mounts are
under /opt/bobuy/data. Only the dedicated gateway publishes TCP 80 and 443.
Existing rhospital containers, image tags, tunnels and sleep policy are protected.
Never run global Docker cleanup or modify their Compose projects.

## Configuration

Release 20261023.1 is staged for the public storefront. The previous release is
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
The mobile full-page screenshot also shows excess blank overflow below the fixed
navigation; the visible viewport and horizontal-fit check pass. No frontend code
or product branding was changed by this deployment.

The frontend audit found three moderate runtime dependency advisories and
additional development advisories. No dependency upgrades were included.
