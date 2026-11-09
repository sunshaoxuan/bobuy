"""Keep source-only CI capture distinct from accepted compiled-byte evidence."""
import importlib.util
from pathlib import Path
import unittest
import hashlib
import json
from unittest.mock import patch

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


class AmendmentOnboardingSchemaAcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.old = [{'path': 'V28__checkout_delivery_snapshot.sql', 'bytes': 4, 'sha256': 'unchanged-c2'}]
        self.added = [{'path': 'V29__customer_order_amendments.sql', 'bytes': 5, 'sha256': 'c3'},
                      {'path': 'V30__costco_onboarding_jobs.sql', 'bytes': 6, 'sha256': 'r13'}]
        self.baseline = {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True, 'migrations': self.old}
        self.accepted = {'schemaBefore': 28, 'schemaAfter': 30, 'migrationChanges': True, 'migrations': self.old + self.added}

    def test_exact_c2_prefix_and_only_reviewed_additions_are_accepted(self):
        self.assertEqual(module.schema_acceptance(self.accepted, self.accepted['migrations'], self.baseline),
                         {'schemaBefore': 28, 'schemaAfter': 30, 'migrationChanges': True})

    def test_drift_missing_misrepresented_or_extra_migrations_reject(self):
        for changes in [self.old + self.added[:1], [{**self.old[0], 'sha256': 'changed'}] + self.added,
                        self.old + self.added + [{'path': 'V31__unexpected.sql'}],
                        self.old + self.added + [self.added[0]]]:
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': changes}, changes, self.baseline)
        for baseline in [None, {**self.baseline, 'schemaAfter': 27}, {**self.baseline, 'migrationChanges': False}]:
            with self.subTest(baseline=baseline), self.assertRaises(RuntimeError):
                module.schema_acceptance(self.accepted, self.accepted['migrations'], baseline)
        with self.assertRaises(RuntimeError):
            module.schema_acceptance({**self.accepted, 'schemaBefore': 27}, self.accepted['migrations'], self.baseline)

    def test_baseline_requires_fixed_c2_manifest_path_and_bytes(self):
        sha = '48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba'
        path = 'docs/reports/c2-cart-20261109/accepted-inputs.json'
        accepted = {**self.accepted, 'migrationBaseline': {'path': path, 'sha256': sha}}
        with patch.object(module, 'digest', return_value=sha), patch.object(Path, 'read_text', return_value=json.dumps(self.baseline)):
            self.assertEqual(module.migration_baseline(accepted), self.baseline)
        for binding in [{'path': path, 'sha256': 'changed'}, {'path': '../unsafe.json', 'sha256': sha}]:
            with self.subTest(binding=binding), patch.object(module, 'digest', return_value=binding['sha256']), self.assertRaises(RuntimeError):
                module.migration_baseline({**accepted, 'migrationBaseline': binding})
