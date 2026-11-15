import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / ".github/workflows/bootstrap-production-age-key.yml"
RUNBOOK = ROOT / "docs/secrets-management.md"


class BootstrapProductionAgeKeyWorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.workflow = WORKFLOW.read_text(encoding="utf-8")
        cls.runbook = RUNBOOK.read_text(encoding="utf-8")

    def test_is_manual_only_and_has_exact_name(self):
        self.assertRegex(self.workflow, r"(?m)^name: bootstrap production age key$")
        trigger = re.search(r"(?ms)^on:\n(?P<body>.*?)^concurrency:", self.workflow)
        self.assertIsNotNone(trigger)
        self.assertEqual(trigger.group("body"), "  workflow_dispatch:\n\n")

    def test_private_key_never_leaves_or_enters_logging_commands(self):
        self.assertIn('age-keygen -y "$key_file"', self.workflow)
        self.assertNotRegex(self.workflow, r"(?m)^\s*(?:cat|tee)\b.*keys\.txt")
        self.assertNotIn("upload-artifact", self.workflow)
        self.assertNotRegex(self.workflow, r"\b(?:scp|rsync)\b.*keys\.txt")
        self.assertIn('age-keygen > "$key_tmp" 2>/dev/null', self.workflow)

    def test_age_download_uses_pinned_checksum_before_extraction(self):
        self.assertIn('age_version=1.2.1', self.workflow)
        self.assertIn('https://github.com/FiloSottile/age/releases/download/v${age_version}/age-v${age_version}-linux-amd64.tar.gz', self.workflow)
        check = "printf '%s  age.tar.gz\\n' '7df45a6cc87d4da11cc03a539a7470c15b1041ab2b396af088fe9990f7c79d50' | sha256sum --check --strict -"
        self.assertIn(check, self.workflow)
        self.assertNotRegex(self.workflow, r'age[^\s"]*checksums\.txt')
        self.assertLess(self.workflow.index(check), self.workflow.index('tar -xzf'))
        self.assertIn('set -euo pipefail', self.workflow)

    def test_new_key_is_validated_then_atomically_installed_without_overwrite(self):
        steps = (
            'key_dir=/etc/bobuy/age',
            'if [[ -e "$key_file" || -L "$key_file" ]]; then',
            'key_tmp=$(mktemp "$key_dir/.keys.txt.XXXXXXXXXX")',
            "trap 'rm -f -- \"$key_tmp\"' EXIT",
            'chmod 0400 "$key_tmp"',
            'chown root:root "$key_tmp"',
            'age-keygen > "$key_tmp" 2>/dev/null',
            'age-keygen -y "$key_tmp" >/dev/null 2>&1',
            'mv -nT -- "$key_tmp" "$key_file"',
            '[[ ! -e "$key_tmp" ]]',
            'trap - EXIT',
        )
        positions = [self.workflow.index(step) for step in steps]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn('age-keygen -o "$key_file"', self.workflow)

    def test_sops_checksum_matches_downloaded_filename(self):
        self.assertIn('sops_version=3.9.4', self.workflow)
        self.assertIn("printf '%s  sops\\n' '5488e32bc471de7982ad895dd054bbab3ab91c417a118426134551e9626e4e85' | sha256sum --check --strict -", self.workflow)

    def test_key_path_guards_and_permissions_are_fail_closed(self):
        self.assertIn('[[ -f "$key_file" && ! -L "$key_file" ]]', self.workflow)
        self.assertIn("== 400", self.workflow)
        self.assertIn("install -o root -g root -m 0700 -d", self.workflow)
        self.assertIn("StrictHostKeyChecking=yes", self.workflow)

    def test_runbook_documents_public_key_and_offline_backup(self):
        for phrase in ("Run workflow", "age1...", "Parker", "离线媒介", "0400", "带外访问"):
            self.assertIn(phrase, self.runbook)

    def test_changed_artifacts_contain_no_private_key_or_ciphertext_sample(self):
        forbidden = "AGE" + "-SECRET-KEY-"
        armored_ciphertext = "-----BEGIN " + "AGE ENCRYPTED FILE-----"
        for content in (self.workflow, self.runbook):
            self.assertNotIn(forbidden, content)
            self.assertNotIn(armored_ciphertext, content)


if __name__ == "__main__":
    unittest.main()
