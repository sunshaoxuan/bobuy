# Customer-only self registration

Urgent user request: remove every customer/merchant identity choice from public self registration and enforce CUSTOMER on the server. Preserve protected administrator account management and existing account roles. Do not create production test accounts or change SMTP/public-registration guards.

## Confirmed finding

`/account` displayed CUSTOMER/AGENT checkboxes and called `/api/auth/register-account`, whose AccountRegistration DTO accepted roles and passed them directly to registerWithRoles. The checkout `/api/auth/register` path already forced CUSTOMER. Both public routes are currently blocked at production ingress with the existing explicit HTTP 503 registration gate, so the code defect is real but the examined production entry is guarded. No claim of past exploitation or account-role changes is made.

## Minimal correction / coverage

Both self-service controller paths now enter the same server-side CUSTOMER registration method. AccountRegistration contains only the validated account fields; replayed roles, merchant IDs, role and platformAdmin fields cannot assign identity. The frontend contains no role checkbox, hidden role field or role-bearing registration payload. Existing platform-administrator management still owns explicit merchant assignments.

Existing SecurityConfig requires PLATFORM_ADMIN for `/api/admin/users/**`, denies legacy `/api/users/**` writes and requires AGENT for merchant endpoints. There is no configured OAuth/OIDC/SAML new-user path in this repository; none is invented. Tests cover forged registration fields, duplicate replay, absent roles, attempted legacy user update, attempted admin account creation and forbidden merchant access by the resulting customer, while retaining legitimate administrator role-combination tests. Existing customer order/trip GET permissions remain unchanged.

Frontend registration/checkout form tests: 2 PASS. Browser-only checks at desktop/mobile in Chinese/Japanese/English confirm no identity choices and no business writes. Backend focused result and final exact-head CI/deployment receipts will be appended. A sandboxed local JVM first failed before tests (JaCoCo non-ASCII default destination), then its ByteBuddy attach pipe was denied and hung; the specific test/attacher processes were identified and safely stopped, and the same test is run with an ASCII coverage destination in the permitted attach environment. No agent, coverage threshold or safety check is disabled.

## Separate follow-up boundaries

Postmaster verification-mail delivery is a separate requested registration phase. Existing code defaults From to `accounts@bobuy.cc`, sends a six-digit code and authenticates before email verification. This is not yet the requested verified-email-before-login flow. Do not declare email delivery working or open the 503 guard until the existing `postmaster@bobuy.cc` mailbox, safe SMTP reference and authorized self-owned end-to-end test recipient are verified. No new credential, permission, DNS/security policy or SMTP integration is created by this patch.
