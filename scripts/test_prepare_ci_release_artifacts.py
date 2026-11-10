"""Keep source-only CI capture distinct from accepted compiled-byte evidence."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
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


class CombinedUiPublicationSchemaAcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.path = Path('docs/reports/consumer-ui-integration-20261109/accepted-inputs.json')
        self.baseline = json.loads(self.path.read_text(encoding='utf-8'))
        sql = Path('backend/src/main/resources/db/migration/V31__recommendation_item_publication.sql')
        self.suffix = {'path': sql.name, 'bytes': sql.stat().st_size, 'sha256': module.digest(sql)}
        self.actual = self.baseline['migrations'] + [self.suffix]
        self.accepted = {'schemaBefore': '28.1', 'schemaAfter': 31, 'migrationChanges': True,
                         'migrations': self.actual, 'migrationBaseline': {
                             'path': self.path.as_posix(), 'sha256': module.digest(self.path)}}

    def test_exact_immutable_ui_prefix_plus_only_v31_passes(self):
        baseline = module.migration_baseline(self.accepted)
        self.assertEqual(module.schema_acceptance(self.accepted, self.actual, baseline),
                         {'schemaBefore': '28.1', 'schemaAfter': 31, 'migrationChanges': True})

    def test_old_baseline_float_version_and_changed_prefix_reject(self):
        for before in [28, 28.1, '28_1']:
            with self.subTest(before=before), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'schemaBefore': before}, self.actual, self.baseline)
        for prefix in [None, {**self.baseline, 'schemaAfter': 28}, {**self.baseline, 'migrations': []}]:
            with self.subTest(prefix=prefix), self.assertRaises(RuntimeError):
                module.schema_acceptance(self.accepted, self.actual, prefix)

    def test_date_sql_missing_drift_extra_and_duplicate_reject(self):
        for actual in [self.actual[:-2] + [self.suffix],
                       [{**v, 'sha256': 'wrong'} if v['path'] == module.ISSUE_DATE_MIGRATION else v for v in self.actual],
                       self.actual + [{'path': 'V29__unrelated.sql'}], self.actual + [self.suffix]]:
            with self.subTest(actual=actual), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': actual}, actual, self.baseline)

    def test_exact_baseline_hash_and_pending_aware_recovery_still_required(self):
        for path, digest in [('other.json', module.digest(self.path)), (self.path.as_posix(), '0' * 64)]:
            with self.subTest(path=path), self.assertRaises(RuntimeError):
                module.migration_baseline({**self.accepted, 'migrationBaseline': {'path': path, 'sha256': digest}})
        recovery = module.recovery_contract(self.accepted)
        self.assertFalse(recovery['oldV28CoreAllowed'])
        self.assertEqual(recovery['status'], 'UNBOUND_EXACT_V31_AWARE_ARCHIVE_AND_PG_RUNTIME_REQUIRED')


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
class ArticleSchemaAcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parents[1]
        self.path = self.root / module.ARTICLE_BASELINE_PATH
        self.baseline = json.loads(self.path.read_text(encoding='utf-8'))
        self.migrations = self.baseline['migrations']
        self.accepted = {'candidateKind': 'ARTICLE_DIGEST_EDITOR_V1', 'schemaBefore': 28,
                         'schemaAfter': 28, 'migrationChanges': False, 'migrations': self.migrations,
                         'migrationBaseline': {'path': module.ARTICLE_BASELINE_PATH,
                                               'sha256': module.ARTICLE_BASELINE_SHA256}}

    def test_article_exact_unchanged_27_migrations_is_accepted(self):
        self.assertEqual(module.schema_acceptance(self.accepted, self.migrations, self.baseline),
                         {'schemaBefore': 28, 'schemaAfter': 28, 'migrationChanges': False})

    def test_changed_deleted_added_or_reordered_sql_is_rejected(self):
        for actual in [[{**self.migrations[0], 'sha256': 'changed'}, *self.migrations[1:]],
                       self.migrations[:-1], [*self.migrations, {'path': 'V29__unexpected.sql'}],
                       list(reversed(self.migrations))]:
            with self.subTest(actual=actual), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': actual}, actual, self.baseline)

    def test_article_kind_baseline_and_schema_cannot_be_broadened(self):
        for change in [{'candidateKind': 'anything'}, {'schemaAfter': 29}, {'migrationChanges': True}, {'schemaBefore': 27}]:
            with self.subTest(change=change), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, **change}, self.migrations, self.baseline)
        with self.assertRaises(RuntimeError):
            module.schema_acceptance(self.accepted, self.migrations, None)

    def test_article_baseline_is_fixed_path_and_exact_c2_bytes(self):
        with patch.object(module, 'digest', return_value=module.ARTICLE_BASELINE_SHA256), patch.object(Path, 'read_text', return_value=json.dumps(self.baseline)):
            self.assertEqual(module.migration_baseline(self.accepted), self.baseline)
        for binding in [{'path': 'other.json', 'sha256': module.ARTICLE_BASELINE_SHA256},
                        {'path': module.ARTICLE_BASELINE_PATH, 'sha256': '0' * 64}]:
            with self.subTest(binding=binding), self.assertRaises(RuntimeError):
                module.migration_baseline({**self.accepted, 'migrationBaseline': binding})
        with patch.object(module, 'digest', return_value='0' * 64), self.assertRaises(RuntimeError):
            module.migration_baseline(self.accepted)

    def test_real_committed_c2_baseline_hash_stays_bound(self):
        canonical = self.path.read_bytes().replace(b'\r\n', b'\n')
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), module.ARTICLE_BASELINE_SHA256)

    def test_dynamic_source_and_class_counts_cannot_lie(self):
        with self.assertRaises(RuntimeError):
            module.source_digest_acceptance({'sourceFiles': [], 'sourceFileCount': 675})
        with self.assertRaises(RuntimeError):
            module.class_acceptance({'compiledByteAcceptance': 'PENDING_INDEPENDENT_ARTIFACT_QA',
                                     'requiredBackendClasses': ['com/bobbuy/Real.class'], 'requiredBackendClassCount': 34})
        with self.assertRaises(RuntimeError):
            module.class_acceptance({'acceptedBackendClasses': [{'path': 'com/bobbuy/Real.class', 'sha256': 'actual'}],
                                     'requiredBackendClassCount': 34})


class IssueDateSchemaAcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.old = [{'path': 'V27__explicit_product_markers.sql', 'bytes': 3, 'sha256': 'old'},
                    {'path': 'V28__checkout_delivery_snapshot.sql', 'bytes': 4, 'sha256': 'c2'}]
        self.added = {'path': module.ISSUE_DATE_MIGRATION, 'bytes': 1172, 'sha256': module.ISSUE_DATE_SHA256}
        self.baseline = {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True, 'migrations': self.old}
        self.accepted = {'schemaBefore': 28, 'schemaAfter': '28.1', 'migrationChanges': True, 'migrations': self.old + [self.added]}

    def test_exact_pinned_28_1_suffix_and_c2_prefix_pass(self):
        self.assertEqual(module.schema_acceptance(self.accepted, self.accepted['migrations'], self.baseline),
                         {'schemaBefore': 28, 'schemaAfter': '28.1', 'migrationChanges': True})

    def test_unknown_extra_missing_renamed_or_changed_migration_rejects(self):
        cases = [self.old, self.old + [{**self.added, 'sha256': 'drift'}],
                 [{**self.old[0], 'sha256': 'drift'}, self.old[1], self.added],
                 self.old + [self.added, {'path': 'V29__customer_order_amendments.sql', 'sha256': 'extra'}],
                 self.old + [{**self.added, 'path': 'V28.1__recommendation_issue_date.sql'}],
                 self.old + [{**self.added, 'path': 'V28_2__recommendation_issue_date.sql'}],
                 self.old + [self.added, {**self.added, 'path': 'V28_01__another.sql'}]]
        for actual in cases:
            with self.subTest(actual=actual), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': actual}, actual, self.baseline)

    def test_baseline_and_schema_identity_cannot_be_relaxed(self):
        for changes in [{'schemaBefore': 27}, {'schemaAfter': 28}, {'schemaAfter': 28.1}, {'schemaAfter': '28_1'},
                        {'migrationChanges': False}, {'migrationChanges': 1}]:
            with self.subTest(changes=changes), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, **changes}, self.accepted['migrations'], self.baseline)
        for baseline in [None, {**self.baseline, 'migrations': []}, {**self.baseline, 'schemaAfter': 27}]:
            with self.subTest(baseline=baseline), self.assertRaises(RuntimeError):
                module.schema_acceptance(self.accepted, self.accepted['migrations'], baseline)

    def test_fixed_c2_baseline_path_and_hash_are_required(self):
        value = {**self.accepted, 'migrationBaseline': {'path': module.ARTICLE_BASELINE_PATH, 'sha256': module.ARTICLE_BASELINE_SHA256}}
        with patch.object(module, 'digest', return_value=module.ARTICLE_BASELINE_SHA256), patch.object(Path, 'read_text', return_value=json.dumps(self.baseline)):
            self.assertEqual(module.migration_baseline(value), self.baseline)
        for path, digest in [('docs/reports/c1-profile-20261109/accepted-inputs.json', module.ARTICLE_BASELINE_SHA256),
                             (module.ARTICLE_BASELINE_PATH, 'wrong')]:
            with patch.object(module, 'digest', return_value=digest), self.assertRaises(RuntimeError):
                module.migration_baseline({**value, 'migrationBaseline': {'path': path, 'sha256': digest}})

    def test_real_sql_is_byte_pinned_not_only_named(self):
        sql = (Path(__file__).resolve().parents[1] / 'backend/src/main/resources/db/migration' / module.ISSUE_DATE_MIGRATION).read_bytes()
        module.issue_date_migration_acceptance(sql)
        with self.assertRaises(RuntimeError):
            module.issue_date_migration_acceptance(sql + b'\nUPDATE bb_recommendation_post SET issue_date=CURRENT_DATE;')

    def test_tuple_normalization_matches_flyway_without_float_collapsing(self):
        self.assertEqual(module.version_tuple('028_01_0'), (28, 1))
        self.assertEqual(module.migration_version('V28.1__example.sql'), (28, 1))
        self.assertGreater(module.version_tuple('28.10'), module.version_tuple('28.2'))
        for value in [28.1, True, '28..1', '-28', '28_1_sql']:
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                module.version_tuple(value)

    def test_legacy_branches_do_not_accept_new_decimal_inventory(self):
        for value, baseline in [({'schemaBefore': 27, 'schemaAfter': 27, 'migrationChanges': False}, None),
                                ({'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True}, {'schemaAfter': 27, 'migrationChanges': False, 'migrations': self.old[:-1]}),
                                ({'schemaBefore': 28, 'schemaAfter': 30, 'migrationChanges': True}, self.baseline)]:
            with self.subTest(value=value), self.assertRaises(RuntimeError):
                module.schema_acceptance({**value, 'migrations': self.accepted['migrations']}, self.accepted['migrations'], baseline)
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


class UnchangedV28WebCaptureTest(unittest.TestCase):
    def setUp(self):
        self.migrations = [{'path': 'V27__explicit_product_markers.sql', 'bytes': 3, 'sha256': 'old'}, {'path': 'V28__checkout_delivery_snapshot.sql', 'bytes': 4, 'sha256': 'new'}]
        self.base = {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True, 'migrations': self.migrations}
        self.accepted = {'schemaBefore': 28, 'schemaAfter': 28, 'migrationChanges': False, 'migrations': self.migrations}

    def test_exact_unchanged_v28_inventory_is_accepted_without_migration(self):
        self.assertEqual(module.schema_acceptance(self.accepted, self.migrations, self.base), {'schemaBefore': 28, 'schemaAfter': 28, 'migrationChanges': False})

    def test_changed_missing_extra_or_unbound_v28_inventory_is_rejected(self):
        for actual in [self.migrations[:-1], [{**self.migrations[0], 'sha256': 'changed'}, self.migrations[1]], self.migrations + [{'path': 'V29__unexpected.sql', 'bytes': 2, 'sha256': 'new'}]]:
            with self.subTest(actual=actual), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, 'migrations': actual}, actual, self.base)
        with self.assertRaises(RuntimeError):
            module.schema_acceptance(self.accepted, self.migrations)
        for fields in [{'schemaBefore': 28.0}, {'schemaAfter': 28.0}, {'migrationChanges': 0}, {'migrationChanges': True}]:
            with self.subTest(fields=fields), self.assertRaises(RuntimeError):
                module.schema_acceptance({**self.accepted, **fields}, self.migrations, self.base)

    def test_actual_immutable_c2_binding_is_read_and_wrong_path_or_digest_rejects(self):
        binding = {'path': module.C2_V28_BASELINE, 'sha256': module.C2_V28_BASELINE_SHA256}
        value = module.migration_baseline({**self.accepted, 'migrationBaseline': binding})
        self.assertEqual((value['schemaBefore'], value['schemaAfter'], value['migrationChanges']), (27, 28, True))
        for wrong in [{}, {'path': 'unrelated.json', 'sha256': module.C2_V28_BASELINE_SHA256}, {**binding, 'sha256': 'changed'}]:
            with self.subTest(wrong=wrong), self.assertRaises(RuntimeError):
                module.migration_baseline({**self.accepted, 'migrationBaseline': wrong})
        with patch.object(module, 'digest', return_value='changed'), self.assertRaises(RuntimeError):
            module.migration_baseline({**self.accepted, 'migrationBaseline': binding})
