# C3.1 R2 — product identity compatibility correction

2026-11-09; isolated branch `c3-order-amendment-20261109`, unchanged baseline `82b8daf7fe275d6dd623b36621f1cf2596dc0e98`.

The first independent candidate incorrectly represented a product key as a numeric order-line key. Existing `Product.id` and C2 checkout `Item.productId` are String values. The database baseline defines `bb_product.id varchar(255)`; checkout accepts a nonblank String of at most 255 characters. R2 corrects the new request and form to that contract. It neither coerces the key to a number nor requires all existing keys to be UUIDs. The exact String is retained rather than silently trimming or rewriting product identity.

Exactly five implementation/test files change from C3.1: request, payload fingerprint, Java test, form type and form test. The request's duplicate set is String-based; the fingerprint sorts String keys and encodes each as length-delimited UTF-8 text. Customer/order identifiers remain their existing numeric types. Policy and server-view source remain byte-for-byte unchanged.

The original four Java test methods remain and now include UUID parsing/preservation, a non-UUID legacy String key, 255-character acceptance, empty/whitespace-only/null/256-character rejection, and distinct String identity fingerprint binding. The original seven form regressions run with a UUID String fixture and explicitly assert that the submitted product ID remains that String. Assertions for account/session isolation, conflicts, retry keys, permissions and quantities remain.

Actual R2 validation: Java17-target narrow compilation PASS (JDK22.0.2, cached Jackson2.15.4/JUnit5.10.2, 128MB heap/one CPU); pure JUnit 4/4 PASS; component tests 7/7 PASS; narrow TypeScript PASS. Outputs are in `.task-tmp/c3-amendment-20261109/r2/`. No earlier result was overwritten. C3.1 patch/manifest/receipts and pre-correction exact source copies remain available.

This remains an unwired C3 candidate. Authenticated API, trusted revision covering all writers, locking/atomic idempotent persistence, catalog/price/trip revalidation, fresh server reload and four-language/address UI wiring, actual PostgreSQL contention, normal remote CI and formal-package browser acceptance remain pending/NOT_RUN. No C2 file, shared index, commit, service, database, browser or production state is changed. The older parent-owned javac-version process is untouched.
