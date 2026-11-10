# Bears local Java17/PG commands and verified runtime continuation

PG2 and exact-JAR API/fresh-process recovery subsequently passed; refer to
POSTGRES-RUNTIME.md for the immutable result locations and accepted JAR hash.
Those results are reused when backend/dependency bytes are unchanged.

Use only after the actual hospital-priority segment returns. No new JDK, image,
DB, credentials, network or public CI is needed. This is ordinary Maven/Docker
invocation, not another execution controller. Existing10 Java/52 frontend tests
are not rerun. Check that the own container name is unused at execution.

## Host compilation, no tests

From the Bears worktree in cmd, use ordinary Maven, not the `mvn -> mvnd` alias:

```bat
set "JAVA_HOME=C:\Program Files\Java\jdk-22"
"C:\Users\X02851\.m2\wrapper\dists\apache-maven-3.9.9\977a63e90f436cd6ade95b4c0e10c20c\bin\mvn.cmd" -o -B -V --file backend/pom.xml -Dmaven.compiler.release=17 -DskipTests test-compile
```

Retain native exit/log and check all resulting own classes, including the new PG
class, for major61. The existing570 major61 classes do not include that new class.
`--release17` constrains APIs as well as bytecode. The compile host is JDK22.

## The two PG methods on actual Java17

Before this standard PowerShell argv command, supply the existing local
synthetic identity through inherited `BOBBUY_SERVICE_TEST_DB_USER` and
`BOBBUY_SERVICE_TEST_DB_PASSWORD`. Values are not written to source/CLI/logs.
The required user is `bobuy`. Mounts use the same worktree and installed Maven;
the old image is a JRE carrier, and its `/app/app.jar` is never executed.

```powershell
$bearsRoot = (Get-Location).Path
$bearsMaven = Join-Path $env:USERPROFILE '.m2/wrapper/dists/apache-maven-3.9.9/977a63e90f436cd6ade95b4c0e10c20c'
$bearsRepository = Join-Path $env:USERPROFILE '.m2/repository'
$bearsArgs = @(
  '--context', 'desktop-linux', 'run', '--rm', '--pull=never',
  '--name', 'bobuy-bears-pg-r2', '--label', 'bobuy.owner=bears-service-packages-20261110',
  '--network', 'bobuy-local_default', '--workdir', '/workspace',
  '--mount', "type=bind,source=$bearsRoot,target=/workspace",
  '--mount', "type=bind,source=$bearsMaven,target=/opt/maven,readonly",
  '--mount', "type=bind,source=$bearsRepository,target=/m2/repository,readonly",
  '--env', 'BOBBUY_SERVICE_OFFER_PG=true',
  '--env', 'BOBBUY_SERVICE_TEST_DB_USER', '--env', 'BOBBUY_SERVICE_TEST_DB_PASSWORD',
  '--env', 'JAVA_TOOL_OPTIONS=-javaagent:/m2/repository/net/bytebuddy/byte-buddy-agent/1.14.12/byte-buddy-agent-1.14.12.jar',
  '--env', 'BOBBUY_FX_JPY_CNY_RATE=0.05', '--entrypoint', '/bin/sh',
  'sha256:5dc2c7ef369bce5af954c2460102d1e9348a6b55030193d94d926bf25a27d64b',
  '/opt/maven/bin/mvn', '-o', '-B', '--file', 'backend/pom.xml',
  '-Dmaven.repo.local=/m2/repository', '-Djvm=/opt/java/openjdk/bin/java',
  '-DforkCount=1', '-DfailIfNoTests=true', '-Dtest=ServiceOfferPostgresIntegrationTest',
  '-Dbobbuy.test.serviceOffer.jdbcUrl=jdbc:postgresql://postgres:5432/bobuy?currentSchema=c2_qa_82b8daf7',
  'org.apache.maven.plugins:maven-surefire-plugin:3.1.2:test'
)
& docker @bearsArgs
if ($LASTEXITCODE -ne 0) { throw "Bears PG native exit $LASTEXITCODE; retain the original failure" }
```

The existing synthetic FX rate avoids live lookup; it is not a production price.
The existing Byte Buddy agent is preloaded through the actual JVM environment;
this avoids unsupported self-attachment on a JRE without weakening Mockito or
changing assertions. The PG-specific profile disables dev role injection.
The pinned image is linux/amd64 with `JAVA_HOME=/opt/java/openjdk`. Surefire forks
that actual JRE17. The PG class checks runtime17 before datasource registration.
No compile goal runs inside the JRE. No port is published, no image is pulled,
no public CI is triggered and only the two new PG methods execute. Preserve any
offline dependency or application failure; don't relabel it as a permission issue.

## Confirmed local synthetic boundary

Read-only2026-11-10 inspection confirmed original local Compose PG18.6 container
`fc55d6bd0133b50a43ae18407f45f42776dcf2b7b763a863547548be28d95bf5`, volume
`bobuy-local_database18`, network `bobuy-local_default`, database/user `bobuy`, no
published PG host port. Its Compose working directory is this same project's
`.task-tmp/recommendation-release`, not production.

Retained C2 QA evidence records creation of an empty `c2_qa_82b8daf7` schema and
synthetic seeding. Article QA later created tagged posts and canvas images via
normal local APIs. Current read-only aggregates:39tables, all migrations through
28.1 successful,7users all matching seed/QA/test identities (0unclassified),
24tagged QA/synthetic posts (0untagged),4orders,158items,119products,0mail settings,
0service offers. No cross-schema foreign keys, column defaults pointing to
public or user-created triggers were found. No user details were emitted.

Reuse this synthetic schema rather than creating another physical instance.
The exact JDBC currentSchema and Hibernate default schema match; seed/reset,
DDL/Flyway/SQL init are disabled. UUID-tagged new rows are transactional and roll
back; row/column fingerprints protect both target schema and public. Sequences
may advance and are not falsely claimed to roll back. Refresh actual writer/
identity conditions at execution; don't infer a machine-wide lock from a thread.

## Formal JAR and fresh process remain separate actual results

After PG acceptance, package with the same host JDK22/`--release17` commands:

```bat
"C:\Users\X02851\.m2\wrapper\dists\apache-maven-3.9.9\977a63e90f436cd6ade95b4c0e10c20c\bin\mvn.cmd" -o -B --file backend/pom.xml -Dmaven.compiler.release=17 -DskipTests package
"C:\Users\X02851\.m2\wrapper\dists\apache-maven-3.9.9\977a63e90f436cd6ade95b4c0e10c20c\bin\mvn.cmd" -o -B -Dmaven.compiler.release=17 -DskipTests package -pl bobbuy-core -am
```

Hash-bind `bobbuy-core/target/bobbuy-core-0.1.0.jar` and its nested common classes.
In that same cached JRE image override `--entrypoint /opt/java/openjdk/bin/java`
and invoke `-jar /workspace/bobbuy-core/target/bobbuy-core-0.1.0.jar` with the
existing isolated runtime configuration specified in POSTGRES-RUNTIME.md.
Keep the new JAR hash and actual Java17 startup evidence for each owned process.

The rollback suite leaves no committed Bears records. The normal synthetic API
must save one old-format and one package record, then a fresh process of the
same package-aware Bears JAR must read both unchanged, with current DB preserved.
Old48433 is not a valid package-JSON recovery reader. Formal JAR, fresh-process
readback and formal web tests remain NOT_RUN until actually executed.
