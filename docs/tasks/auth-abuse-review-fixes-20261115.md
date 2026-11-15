# Authentication abuse review fixes (2026-11-15)

## Authorized scope

This follow-up is limited to the three findings on PR commit `cb60b2e`: repair the
two stale `StorefrontController` test constructions; retain throttling audit rows
when the expected rejection exception leaves `begin`; and isolate quota/delay
buckets by purpose. It adds focused acceptance tests for quota boundaries, window
recovery, concurrent consumption, trusted proxy headers, and non-enumerating
responses. It does not add routes, change Nginx, add secrets, or enable production
authentication-abuse controls, mail delivery, or verified-only ordering.

## Minimum verification

Run the focused backend tests covering `AuthAbuseService`, proxy resolution,
authentication response enumeration, and the two corrected controller contracts.
Also inspect the three production feature flags, validate the changed migration,
and run `git diff --check`. Do not run the full backend suite.
