"""Keep source-only CI capture distinct from accepted compiled-byte evidence."""
import importlib.util
from pathlib import Path
import unittest
import hashlib
import json

spec = importlib.util.spec_from_file_location('ci_artifacts', Path(__file__).with_name('prepare-ci-release-artifacts.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ClassAcceptanceTest(unittest.TestCase):
    def test_legacy_exact_class_hashes_remain_required(self):
        paths, expected = module.class_acceptance({'acceptedBackendClasses': [{'path': 'com/bobbuy/Example.class', 'sha256': 'abc'}]})
        self.assertEqual(paths, ['com/bobbuy/Example.class'])
        self.assertEqual(expected, {'com/bobbuy/Example.class': 'abc'})

    def test_source_only_capture_does_not_claim_a_local_compile_match(self):
        paths, expected = module.class_acceptance({'compiledByteAcceptance': 'PENDING_INDEPENDENT_ARTIFACT_QA', 'requiredBackendClasses': ['com/bobbuy/service/SelfProfileService.class']})
        self.assertEqual(paths, ['com/bobbuy/service/SelfProfileService.class'])
        self.assertIsNone(expected)

    def test_missing_or_unsafe_source_only_acceptance_is_rejected(self):
        for value in [{}, {'requiredBackendClasses': ['com/bobbuy/A.class']}, {'compiledByteAcceptance': 'PENDING_INDEPENDENT_ARTIFACT_QA', 'requiredBackendClasses': []}, {'compiledByteAcceptance': 'PENDING_INDEPENDENT_ARTIFACT_QA', 'requiredBackendClasses': ['../A.class']}]:
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                module.class_acceptance(value)


class SchemaAcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.old = [{'path': 'V27__explicit_product_markers.sql', 'bytes': 3, 'sha256': 'old'}]
        self.new = self.old + [{'path': 'V28__checkout_delivery_snapshot.sql', 'bytes': 4, 'sha256': 'new'}]
        self.baseline = {'schemaAfter': 27, 'migrationChanges': False, 'migrations': self.old}
        self.accepted = {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True, 'migrations': self.new}

    def test_legacy_v27_capture_stays_strict(self):
        self.assertEqual(module.schema_acceptance({'migrations': self.old}, self.old), {'schemaBefore': 27, 'schemaAfter': 27, 'migrationChanges': False})
        with self.assertRaises(RuntimeError):
            module.schema_acceptance({'migrations': self.old}, self.new)

    def test_c2_explicit_transition_requires_unchanged_prior_migrations(self):
        self.assertEqual(module.schema_acceptance(self.accepted, self.new, self.baseline), {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True})
        for baseline in [None, {**self.baseline, 'migrations': []}, {**self.baseline, 'schemaAfter': 28}]:
            with self.subTest(baseline=baseline), self.assertRaises(RuntimeError):
                module.schema_acceptance(self.accepted, self.new, baseline)

    def test_unknown_or_misrepresented_schema_cannot_be_captured(self):
        for change in [{'schemaAfter': 29}, {'migrationChanges': False}, {'schemaBefore': 26}]:
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, **change}, self.new, self.baseline)
        with self.assertRaises(RuntimeError):
            module.schema_acceptance({'migrations': self.new}, self.new)

    def test_changed_old_bytes_or_extra_migration_rejects(self):
        for actual in [[{**self.old[0], 'sha256': 'changed'}, self.new[1]], self.new + [{'path': 'V29__unexpected.sql'}]]:
            with self.subTest(actual=actual), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': actual}, actual, self.baseline)

    def test_checkout_sql_accepts_only_the_two_nullable_columns(self):
        sql = b'-- add facts\nALTER TABLE bb_order_header ADD COLUMN delivery_snapshot jsonb;\nALTER TABLE bb_order_header ADD COLUMN checkout_payload_hash varchar(64);\n'
        module.checkout_migration_acceptance(sql)
        for altered in [sql+b'DELETE FROM bb_order_header;', sql.replace(b'jsonb;', b'jsonb NOT NULL;'), sql.replace(b'varchar(64)', b'varchar(64) DEFAULT 0'), sql.replace(b'ADD COLUMN delivery_snapshot', b'DROP COLUMN delivery_snapshot')]:
            with self.subTest(altered=altered), self.assertRaises(RuntimeError):
                module.checkout_migration_acceptance(altered)

    def test_new_source_digest_is_verified_not_just_copied(self):
        entries = [{'path': 'frontend/src/cart.ts', 'gitLfBytes': 2, 'gitLfSha256': 'hash'}]
        digest = hashlib.sha256(json.dumps(entries, separators=(',', ':')).encode()).hexdigest()
        accepted = {'sourceFiles': entries, 'sourceDigestAlgorithm': 'sha256-json-utf8-sourceFiles-v1', 'sourceDigest': digest}
        module.source_digest_acceptance(accepted)
        with self.assertRaises(RuntimeError):
            module.source_digest_acceptance({**accepted, 'sourceDigest': 'stale'})
        with self.assertRaises(RuntimeError):
            module.source_digest_acceptance({**accepted, 'sourceDigestAlgorithm': 'unknown'})


class PublicationSchemaAcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.previous = [
            {'path': 'V27__explicit_product_markers.sql', 'bytes': 3, 'sha256': 'old27'},
            {'path': 'V28__checkout_delivery_snapshot.sql', 'bytes': 4, 'sha256': 'old28'},
        ]
        self.added = {'path': 'V31__recommendation_item_publication.sql', 'bytes': 5, 'sha256': 'new31'}
        self.actual = self.previous + [self.added]
        self.baseline = {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True,
                         'migrations': self.previous}
        self.accepted = {'schemaBefore': 28, 'schemaAfter': 31, 'migrationChanges': True,
                         'migrations': self.actual}

    def test_publication_allows_only_the_direct_reviewed_28_to_31_transition(self):
        self.assertEqual(module.schema_acceptance(self.accepted, self.actual, self.baseline),
                         {'schemaBefore': 28, 'schemaAfter': 31, 'migrationChanges': True})
        for change in [{'schemaBefore': 27}, {'schemaAfter': 30}, {'migrationChanges': False}]:
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, **change}, self.actual, self.baseline)

    def test_publication_requires_actual_exact_prior_v28_manifest(self):
        for baseline in [None, {**self.baseline, 'schemaBefore': 26},
                         {**self.baseline, 'schemaAfter': 27},
                         {**self.baseline, 'migrationChanges': False},
                         {**self.baseline, 'migrations': []}]:
            with self.subTest(baseline=baseline), self.assertRaises(RuntimeError):
                module.schema_acceptance(self.accepted, self.actual, baseline)

    def test_old_byte_drift_missing_duplicate_and_c3_r13_migrations_reject(self):
        candidates = [
            [{**self.previous[0], 'sha256': 'drift'}, self.previous[1], self.added],
            self.previous,
            self.actual + [self.added],
            self.actual + [{'path': 'V29__customer_order_amendment.sql'}],
            self.actual + [{'path': 'V30__costco_onboarding.sql'}],
            self.actual + [{'path': 'V32__unknown.sql'}],
        ]
        for actual in candidates:
            with self.subTest(actual=actual), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': actual}, actual, self.baseline)

    def test_v31_sql_acceptance_is_pinned_to_exact_reviewed_source(self):
        content = Path('backend/src/main/resources/db/migration/V31__recommendation_item_publication.sql').read_bytes()
        module.publication_migration_acceptance(content)
        for changed in [content+b'\nDELETE FROM bb_recommendation_item;',
                        content.replace(b"DEFAULT 'PENDING'", b"DEFAULT 'PUBLISHED'"),
                        content.replace(b') IS TRUE)', b'))')]:
            self.assertNotEqual(content, changed)
            with self.subTest(changed=changed[-80:]), self.assertRaises(RuntimeError):
                module.publication_migration_acceptance(changed)

    def test_v31_baseline_path_and_hash_cannot_reuse_the_v27_binding(self):
        path = Path('docs/reports/c2-cart-20261109/accepted-inputs.json')
        accepted = {**self.accepted, 'migrationBaseline': {'path': path.as_posix(), 'sha256': module.digest(path)}}
        self.assertEqual(module.migration_baseline(accepted)['schemaAfter'], 28)
        for binding in [{'path': 'docs/reports/c1-profile-20261109/accepted-inputs.json',
                         'sha256': module.digest(Path('docs/reports/c1-profile-20261109/accepted-inputs.json'))},
                        {'path': path.as_posix(), 'sha256': 'wrong'}]:
            with self.subTest(binding=binding), self.assertRaises(RuntimeError):
                module.migration_baseline({**accepted, 'migrationBaseline': binding})

    def test_capture_never_claims_v31_runtime_or_old_v28_recovery_acceptance(self):
        contract = module.recovery_contract(self.accepted)
        self.assertEqual(contract['status'], 'UNBOUND_EXACT_V31_AWARE_ARCHIVE_AND_PG_RUNTIME_REQUIRED')
        self.assertFalse(contract['oldV28CoreAllowed'])
        self.assertFalse(contract['oldDatabaseRestoreAllowed'])
        self.assertFalse(contract['metadataOrClassPresenceIsRuntimeProof'])
        self.assertIn('PENDING-aware core/JAR', contract['requirement'])
        description = module.rollback_description(self.accepted)
        self.assertIn('keep controlled maintenance and forward-fix', description)
        self.assertIn('authorizes no activation', description)
        self.assertIsNone(module.recovery_contract(self.baseline))
        self.assertIn('retain V28', module.rollback_description(self.baseline))
