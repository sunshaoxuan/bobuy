# C1 registration and self profile — 2026-11-09

This batch completes the authenticated self-profile journey around existing customer-only registration and email verification. Source/independent component acceptance permits a precise commit and normal remote CI. It is not production acceptance or proof of delivered mail.

## Requirements and resulting contract

- Registration still requires email and creates CUSTOMER only. Phone, address and social accounts can be supplied later. Existing login, own orders/billing and management authorization remain.
- Authenticated GET/PATCH `/api/auth/profile` selects the caller from Authentication. Explicit response and presence-aware input DTOs accept name/email/phone/address/social fields, preserve omitted fields and allow clearing optional fields. Identity, roles, merchant assignment, email/social verification and internal notes cannot be self-asserted. `/api/auth/me` is unchanged; aggregate `/api/users` writes remain denied.
- Email is normalized and unique under the existing PostgreSQL lower(email) index. Profile changes, verification/resend and admin email changes share a freshly reloaded user row lock. A changed email clears verification and consumes the old OTP without resetting its send time. A successfully verified OTP is also retained as an expired/exhausted per-user record so verification followed by email change cannot bypass 60 seconds. Five-attempt/expiry/one-time and send-failure rollback rules remain; no schema migration.
- The account UI accepts profile/session reads only when common identity/email/verification fields agree, with one bounded reread. Persistent disagreement hides the verification summary and offers localized recovery. No contradictory session is stored. Account switching, unmount, response ordering and token rotation are guarded.
- Private preview only: a scoped inset reset fixes the retained relative-position offsets. Fourteen quotation labels use Traditional Chinese. Prices, image pixels, offer/coupon conditions, booking rules and business content are unchanged.

## Independent evidence before this commit

The C1 R2 delta is `50f9b4fc4b0635272868859042d68822a330b1de880aab8e2717215734265670`; combined 18-file candidate is `655dddf881585fc3913144dab96fda2feff7bdf7a5030b419485383bccda4781` (SHA256 patch digests). QA receipt `d76507d75befaa9deb7d3a32f560c598e101b4c039eac1801289d6ae8b7b32d1` accepted precise commit and remote CI, not release.

Independent account component cases passed 20/20; exact-source memory scenarios passed 12/12 and overlap, so they are not summed. The original contradiction remains a failing negative control. Developer account/registration/verification checks passed 27/27; type/i18n checks passed. Independent preview CSS controls reproduced 131/135 and 147/151 before, then 131/131 and 147/147 after; fixtures also checked keyboard/details/focus and unchanged public style. Real current post8 acceptance is not claimed.

## CI scope and remaining gates

The existing hosted JDK17 default suite uses an isolated H2 memory datasource and includes SelfProfileServiceTest/StorefrontIntegrationTest. The existing optional PostgreSQL 18 migration job is extended to run those two C1 classes on its own loopback service after actual Flyway migration, with explicit PostgreSQL driver, credentials belonging only to that disposable service, schema validation and Flyway enabled. It imports no business backup or production settings. Tests use mocked SMTP; success is not inbox delivery. Destructive seed/deleteAll tests must never use a business datasource.

The existing artifact capturer accepts a batch-specific pinned input file. C1 has no accepted local JVM compile/web build under the shared-machine resource boundary, so CI captures actual required class/JAR/web/image digests and explicitly leaves compiled-byte equality/independent artifact QA pending. Previous release byte hashes are not reused as C1 acceptance.

At document creation, new remote CI, actual Java/PostgreSQL transactions/concurrency, final artifacts, real account GUI and SMTP/inbox are PENDING/NOT_RUN. Run receipts and immutable artifact IDs/digests are recorded separately after completion; old release CI is not substituted. Any additional CI-driven source correction requires a new candidate and affected independent review. Exact artifact QA and fresh production/data/rollback preflight precede any service switch. Preserve V27 and every newer customer/content write; never restore an old database to publish this application change.

## First remote CI and isolated fixture correction

Commit `72e5e3454e427568f6d5b5bb8c62331c4a00cea8`, run [42551690269](https://github.com/sunshaoxuan/bobuy/actions/runs/42551690269), passed the default backend suite (403 total, no failures/errors, 2 skipped), frontend quality and release guard jobs. The actual PostgreSQL C1 run compiled and started but encountered 8 setup errors: retained refresh-token sessions prevented the next seed from deleting their referenced test users under `fk_bb_refresh_token_session_user`. The original failed run is retained.

The correction is test-only: bulk-delete synthetic refresh sessions before reseeding and in cleanup, clearing user and rotation-source references in one statement. No production seeding, schema, authentication policy or application behavior changes. The corrected test fixture and refreshed source-input manifest need their own precise CI/affected review; earlier PostgreSQL failure is not relabeled as a pass.
