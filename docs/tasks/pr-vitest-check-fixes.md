# PR Vitest check fixes

## Authorized scope

Repair the five frontend test files reported by the PR check without skipping or deleting tests. No deployment is authorized or required.

## Changes and minimum verification

- Keep the Node-native SEO suite out of Vitest collection; verify the targeted Vitest command and the dedicated SEO command.
- Restore the price-adjustment document entry asserted by `referenceOfferWindow.test.tsx`; verify that targeted component test.
- Make the maintenance-response fixtures compatible with the public-read retry policy while retaining their message assertions; verify that targeted component test.
- Re-run the two reported recommendation/date suites in the same targeted Vitest invocation because their CI failures are part of the authorized acceptance set.
