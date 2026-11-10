# Bears PostgreSQL and exact-JAR continuation

This records the prepared path and its later execution. Actual Java17/PG2 results
are in `.task-tmp/service-task-packages-20261110/java17-pg-run-r4/`; the exact
formal JAR API/new-process recovery was independently accepted in
`formal-jar-runtime-r2/REPORT.md` (SHA256
`c2d811970e6ab0061cd73e8b581521b717aa42db97c8facaf5bb7ee4a94edc3e`).
Accepted core JAR SHA256:
`8c6ac3c5f75ccb17d02ca935e7171432b162f0d1f3e996a1097179406f12c63f`.
Do not rebuild or rerun that unchanged core just for a frontend integration.
It does not block the independent accepted c378 frontend release. No CI push or
new database is required by the test code; use the existing admitted
synthetic test stack and a real resource window, with hospital priority.

## Confirmed compile/runtime split

Use the existing host JDK22.0.2 with `maven.compiler.release=17` for compilation,
then the cached Linux Java17 JRE for actual Surefire and formal-JAR processes.
An additional Java17 JDK installation is unnecessary. The compiler host remains
22; do not report it as17. Spring Boot parent3.2.4 maps `maven.compiler.release`
to `java.version`17, and the retained original logs record `javac [debug release
17]`. All570 inspected own class files have major61; they predate the new PG
class, which still requires compilation.

Maven3.9.9 already has a POSIX `bin/mvn` in the same installed distribution.
Surefire3.1.2's cached plugin descriptor supports `jvm`, `forkCount` and its
direct `test` goal. Compile on Windows, then run that direct goal in the cached
JRE image with the existing Maven distribution/repository mounted. The test now
rejects a non17 runtime before registering datasource properties. Exact standard
commands and the confirmed synthetic PG boundary are in `RUN-JAVA17-PG.md`.

## Prepared PostgreSQL tests

`ServiceOfferPostgresIntegrationTest` reuses the existing H2 class's exact payload
factories. The old H2 test methods, setup and assertions are unchanged. It does
not inherit their global clear/seed. The new class:

- Is disabled unless `BOBBUY_SERVICE_OFFER_PG=true`.
- Checks its two explicit target modes before a Spring datasource is connected.
- Uses the existing local `bobuy` database's `c2_qa_82b8daf7` schema on the already
  admitted `bobuy-local_default` network. The alternate mode is only the existing
  explicitly isolated hosted PG service, with its original environment guards.
- Forces Hibernate `validate`, no schema generation, Flyway off, SQL init off and
  seed/force-reset off. It does not create, clean, drop, migrate or restore a DB.
- Creates only uniquely identified synthetic users and service posts in Spring
  test transactions. MockMvc calls use the same transaction/thread; flush/clear
  makes the reopen read the actual PG JSONB instead of the first-level entity cache.
- Fingerprints existing table rows in public and the selected schema, plus column
  shape before the transaction; verifies equality after rollback. PostgreSQL
  sequence increments are not rolled back and are not claimed byte-identical.
  No counter reset or data restoration is attempted on failure.

Two new methods are prepared:

1. `sameCandidateReopensOldAndPackageJsonAndPublishesAccurateCards`: legacy staff/
   hours and new package JSON saved and reopened by the same candidate; four
   independent tax-included JPY prices, null unknown/unified amounts, unchanged old
   JSON, both public summaries and source stripping; no product/item creation.
2. `packageSourceRetryVersionOwnershipAndPrivateSourceRemainBound`: source retry
   creates no duplicate, same version/payload replays, stale change conflicts,
   cross-merchant/customer/anonymous writes rejected, original source URL/body/key
   unchanged by rejected attempts.

After host test compilation, inside the cached Java17 JRE attached to the local
test network, with the existing Maven POSIX distribution/repository mounted,
the checkout as working directory and synthetic DB identity from environment:

```sh
# Required environment, from the existing synthetic fixture identity only:
# BOBBUY_SERVICE_OFFER_PG=true
# BOBBUY_SERVICE_TEST_DB_USER=bobuy
# BOBBUY_SERVICE_TEST_DB_PASSWORD=<existing synthetic credential; do not log>
# JAVA_TOOL_OPTIONS=-javaagent:/m2/repository/net/bytebuddy/byte-buddy-agent/1.14.12/byte-buddy-agent-1.14.12.jar
/bin/sh /opt/maven/bin/mvn -o -B --file backend/pom.xml \
  -Dmaven.repo.local=/m2/repository -Djvm=/opt/java/openjdk/bin/java \
  -DforkCount=1 -DfailIfNoTests=true \
  -Dtest=ServiceOfferPostgresIntegrationTest \
  '-Dbobbuy.test.serviceOffer.jdbcUrl=jdbc:postgresql://postgres:5432/bobuy?currentSchema=c2_qa_82b8daf7' \
  org.apache.maven.plugins:maven-surefire-plugin:3.1.2:test
```

Use ordinary Maven, not the OHR host's `mvn -> mvnd` alias. Current source records
show local PG has no published host port; do not invent127.0.0.1:15432 or open a
new port. Recheck the test-runner's actual identity and retained PG boundary at
execution. The cached JRE image is now pinned in RUN-JAVA17-PG.md. Current host
Java22/release17 alone does not satisfy an actual Java17 run.

The alternate existing hosted service uses URL
`jdbc:postgresql://127.0.0.1:5432/bobbuy`, user `bobbuy`, and requires actual
`GITHUB_ACTIONS=true`, `GITHUB_JOB=postgres-migration-verify`,
`BOBBUY_ISOLATED_CI_POSTGRES=true` plus the opt-in above. Do not spoof those flags
locally or create a public push to obtain this run. No workflow was triggered.
Both targets must already have the exact accepted V28.1 schema; this suite does
not run Flyway to make an unknown database fit. Stop if the schema differs.

The PG profile disables the generic test application's dev role injection,
preserving a genuinely anonymous401 check. On the existing JRE17, preload the
already cached Byte Buddy agent through `JAVA_TOOL_OPTIONS`; setting only
`jacocoArgLine` as a user property did not preload it in the actual direct-goal
run. Original initialization errors and the original401/403 fixture failure are
retained in runs1-3. No permission assertion was relaxed.

## Exact formal application and recovery inputs

The PG suite is Spring/MockMvc against source. It is **not** the production core
wrapper startup or a new-process recovery test. The actual formal artifacts
still need to be built and independently bound after the test-source candidate
is frozen and necessary real PG validation is accepted. Repository standard
packaging commands on the host JDK22 with explicit Java17 API target are:

```sh
mvn -B --file backend/pom.xml -Dmaven.compiler.release=17 -DskipTests package
mvn -B -Dmaven.compiler.release=17 -DskipTests package -pl bobbuy-core -am
```

The production application is `bobbuy-core/target/bobbuy-core-0.1.0.jar`, containing
the newly built common dependency; the monolith is supporting test evidence.
Pin the exact source, JAR SHA256, nested common JAR/class hashes, migration list
throughV28.1, image config/manifest/layers, and matching web assets. No actual
formal JAR/image/digest is produced or assumed here. If the date/node UI has been
released first, integrate it onto this branch before packaging; never regress it.

Future normal core invocation, **only inside the separately admitted existing
test runtime/network**, uses the exact formal JAR, existing synthetic DB identity
and schema, `prod` profile, seed/reset off, Hibernate validate, Flyway off and no
config-service import. The existing owner-bound runtime tools supply lifecycle;
this document adds no executable controller. The core command shape is:

```sh
java -jar <bound-core.jar> \
  --spring.profiles.active=prod --spring.config.import= \
  '--spring.datasource.url=jdbc:postgresql://postgres:5432/bobuy?currentSchema=c2_qa_82b8daf7' \
  --spring.datasource.driver-class-name=org.postgresql.Driver \
  --spring.jpa.properties.hibernate.default_schema=c2_qa_82b8daf7 \
  --spring.jpa.hibernate.ddl-auto=validate --spring.flyway.enabled=false \
  --spring.sql.init.mode=never --bobbuy.seed.enabled=false \
  --bobbuy.seed.force-reset-on-invoke=false
```

Do not execute this literal shape without the existing runtime's full accepted
service configuration, same-image identity and credential injection. It is an
input/command specification, not a new approved startup. No test credential is
placed in source or command arguments here.

Required real-process acceptance remains:

1. Capture fresh local schema/public/owned-fixture baselines and original service
   identities without resetting the retained synthetic dataset.
2. Boot the exact new package-aware formal core; save old-format and new-format
   service records via the normal synthetic merchant API, and record IDs,
   versions, raw JSON/source/hash/public projection and history. These committed
   fixtures need a separate normal owner-bound runtime scenario; the rollback
   JUnit tests do not create them for a later process.
3. Stop only that owned candidate, then boot a fresh process of the exact same
   bound package-aware recovery image/JAR on the same retained schema. Read both
   persisted forms and verify all prior rows, prices/nulls/source/history and
   public projections remain. Recovery leaves current DB/data in place.
4. Use the exact matching formal web for normal save/reopen and mobile/four-locale
   display. Preserve data and return only owned runtime resources after the segment.

**48433 is not a supported recovery application for new TASK_PACKAGES JSON.** Its
record rejects the new fields. Do not downgrade the running application to it or
erase/convert the new JSON to manufacture compatibility. A package-aware bound
recovery artifact and actual fresh-process readback are still NOT_RUN. Passing
these prepared source tests later will not by itself close that recovery gate.
