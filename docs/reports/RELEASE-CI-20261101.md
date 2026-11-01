# Release CI follow-up (test-only correction)

Candidate `5979f7b26d71894a246badbd6d46c21cc1c2fca4` was fast-forwarded to main after read-only checks found no repository webhook, deployment workflow or Pages configuration. Push triggered CI/security checks only; no production SSH or activation was performed.

Its CodeQL run 41288473333 and Maven dependency-check 41288473390 passed. Main CI 41288473303 passed backend-test and release-tools, but frontend-quality failed 3/183 cases, so docker-build was skipped. It is not a passing release gate.

Two test-only corrections preserve production behavior:

- RecommendationHistory's expired fixture now supplies its explicit start date. An end-only fixture conflicts with the user's rule that unknown starts cannot be automatically treated expired. A public-history regression explicitly retains an end-only issue among current topics.
- StockMaster's top-level save-reject/retry test gets a bounded 15-second deadline for both persistence attempts and Drawer transition under parallel CI, preserving every assertion. Cleanup/spies/messages/locale are isolated in afterEach rather than an async test body that can finish after timeout and unmount the next test. This explains the following missing compact-management control with only a leftover message in the failed DOM. No application timeout, UI logic, permissions or test gates are disabled.

There are no runtime, migration, dependency, source translation, price, media or production content changes in this follow-up. The actual PG18/UI/codec evidence remains applicable to identical runtime inputs. The follow-up commit must obtain its own main CI and security records; the failed run is retained, not relabeled or blindly rerun.
