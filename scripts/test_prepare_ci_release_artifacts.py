"""Keep source-only CI capture distinct from accepted compiled-byte evidence."""
import importlib.util
from pathlib import Path
import unittest

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
