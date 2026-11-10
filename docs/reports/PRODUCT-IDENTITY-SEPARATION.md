# Product identity separation — local candidate, 2026-11-05

Recovery follow-up: see PRODUCT-IDENTITY-RECOVERY.md for the implemented sidecar/checkpoint solution and latest actual verification. Earlier blocker evidence below is historical.


The existing model has brand, localized name/specification, model and packaging. Actual
production readback shows concatenated names despite those fields, plus older recommendation
profiles with empty brand/model/packaging. Independent ITEMs must remain independent.

This candidate carries explicit identity fields through recommendation facts/form/schema
and profile creation, shows brand separately in recommendation and catalog views, preserves
specification in catalog mapping, and adds purchase-time order metadata. Historical
OrderLine.spec is unchanged because it often holds a sale unit. New fields retain package
combinations and are copied rather than linked to later master edits. Orders, customer
receipts and procurement reconciliation can display those snapshots independently.

The read-only catalog audit endpoint and visible master utility return actual values,
record versions, canonical/legacy state, original catalog data and source item/issue links
with raw quote and coupon windows. It batches source reads and is merchant scoped. It
does not canonicalize legacy masters or save anything. It is not yet live.

Production writes performed for this repair: zero. Current225 active cards observed;
all225 distinct masters read in all four languages through the normal UI.82 brand fields
are empty, not proof that82 brands can be inferred. All225 show the canonical projection
indicator. Numeric versions/reverse-link freshness are not claimed complete. Full-value
original files cover the initial39; later full reads remain in the CUA runtime, not a
complete persisted rollback export. Original receipts, the225-read summary and ten explicit
metadata-only proposed changes are in the existing task folder.
Do not apply them until the separate-field display is live and verified. A master change
affects every linked issue projection, while original source facts/quotes must be preserved.

Rollback boundaries:
- Same canonical master metadata: capture original four-language fields and current version,
  then normalUI save/reopen per small batch. Never change IDs, galleries, prices or memberships.
- catalogData=null: first save changes projection mode. Ordinary UI field edits cannot
  restore null; hold these separately until a genuine reversible workflow is proven.
- New order JSON fields: absent on untouched legacy orders; old payloads remain readable.
  A previous strict binary may reject new fields. Retain a compatible-reader recovery
  build; do not call arbitrary downgrade safe or erase new snapshots for rollback.

Validation boundaries:
- Real local synthetic unit/component tests and production bundle are recorded in the task receipt.
- Initial full ProductCatalog HTTP integration was blocked during FxRateService HttpClient
  construction with loopback SocketException Permission denied: connect. After new scoped
  authorization, one formal per-command reviewed retry passed all5 tests in explicit H2
  memory database bobbuy_identity_gate. Original denial evidence is preserved separately.
  No production connection or security configuration change was used. MockMvc integration
  does not substitute for real browser desktop/mobile save/reopen acceptance.
- JaCoCo javaagent startup failed on installed JDK22; subsequent named pure tests were
  run with jacoco.skip=true, so no coverage claim. No Docker, installs or production changes.

Remaining: complete actual desktop-mobile acceptance and reader-compatible
release plan, then deploy through an allowed path before reviewed data correction.
Procurement deficit/picking responses now retain purchase-time identity, including distinct
snapshots within a deficit SKU group; legacy quantities and grouping are unchanged. Ledger
order-line responses retain the snapshot too. Real browser acceptance of these views is
still pending; catalog integration/component/pure tests are not a production claim.

Final local checks on the frozen candidate:
- Backend named pure tests: 8 passed, 0 failures/errors (4 order snapshot, 2 identity facts,
  2 read-only audit/projection). Surefire text/XML reports are under backend/target/surefire-reports.
- Frontend affected tests: 44 passed, 0 failed across 10 files. Machine-readable report:
  frontend/test-results/identity-separation.json. No live browser or production-write claim.
- Production bundle: check:i18n (1226 keys), TypeScript and Vite passed; existing vendor
  chunk size warning remains. git diff --check passed.
- Project Costco case helper: 21 tests passed. Skill documentation now records identity
  separation and the canonical/legacy and old-reader rollback limits.

No production data repair, release, new issue publication, Docker operation or credential
change was performed. The unrelated pre-existing scripts/local-test.ps1 edit is excluded.

Additional offline recovery-boundary evidence (three tests passed):
- ProductIdentityRecoveryTest calls the real catalog save/get service against isolated
  repository proxies: restoring original fields after a legacy first save leaves canonical
  state enabled. Therefore ordinary field restoration is not a complete legacy rollback.
- Existing canonical fields can be restored semantically in the isolated service fixture;
  review timestamps change. No database transaction/CAS, media-reference recovery or real
  browser rollback is claimed by this fixture.
- PreviousOrderLine is the exact c15da922 baseline class shape with only package/class names
  changed. Its strict Jackson reader reads untouched historical JSON and rejects new snapshot
  JSON. The candidate reader preserves the new snapshot and the original sale-unit spec.
  This proves an ordinary binary downgrade unsafe, not a complete recovery release ready.

Permission evidence: Git failed creating .git/worktrees/media-upload-fix/index.lock before
staging. The current managed filesystem profile explicitly exposes .git read-only. The
integration stack fails inside JDK PipeImpl LoopbackConnector/SelectorManager while building
FxRateService's HttpClient, before any external FX request or HTTP test assertion. No exact
OS policy rule is exposed by this stack. Subsequently, exact scoped Git staging and H2
integration commands were each reviewed via the tool's require_escalated path once and
succeeded. No ACL, identity, context, authentication, firewall or persistent access changed.

Current identity overlap requiring reference review: independent HEAD1601706 and1601707
profiles coexist with one1601707/1601706 composite-number profile. No automatic merge,
split or deletion was performed. The regular active-profile UI exposes no numeric version
or full reverse-link export; the new read-only audit utility is still local, not live.
