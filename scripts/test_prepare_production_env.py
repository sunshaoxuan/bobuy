import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "prepare-production-env.sh"


class ProductionEnvPreparationTest(unittest.TestCase):
    def run_script(self, root: Path, enabled: str, ciphertext: Path, key: Path, output: Path):
        fake_bin = root / "bin"
        fake_bin.mkdir(exist_ok=True)
        fake_sops = fake_bin / "sops"
        fake_sops.write_text(
            "#!/usr/bin/env bash\n"
            "set -eu\n"
            "test -n \"${SOPS_AGE_KEY_FILE:-}\"\n"
            "grep -q synthetic-test-key \"$SOPS_AGE_KEY_FILE\" || exit 1\n"
            "while (($#)); do if [[ $1 == --output ]]; then cp \"$3\" \"$2\"; exit; fi; shift; done\n"
        )
        fake_sops.chmod(0o755)
        env = os.environ | {"PATH": f"{fake_bin}:{os.environ['PATH']}"}
        return subprocess.run(
            [SCRIPT, enabled, ciphertext, key, output],
            text=True, capture_output=True, env=env, check=False,
        )

    def test_disabled_is_a_noop_and_does_not_need_inputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "runtime.env"
            result = subprocess.run(
                [SCRIPT, "false", root / "missing.enc", root / "missing.key", output],
                text=True, capture_output=True, check=False,
            )
            self.assertEqual(0, result.returncode)
            self.assertFalse(output.exists())

    def test_enabled_decrypts_to_private_overlay_without_printing_content(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ciphertext, key, output = root / "env.enc", root / "key", root / "runtime.env"
            sentinel = "SYNTHETIC_SMTP_PASSWORD=not-a-real-secret"
            ciphertext.write_text(sentinel + "\nBOBBUY_ACCOUNT_MAIL_SMTP_PORT=465\n")
            key.write_text("synthetic-test-key")
            result = self.run_script(root, "true", ciphertext, key, output)
            self.assertEqual(0, result.returncode)
            self.assertEqual(sentinel + "\nBOBBUY_ACCOUNT_MAIL_SMTP_PORT=465\n", output.read_text())
            self.assertEqual(0o600, stat.S_IMODE(output.stat().st_mode))
            self.assertNotIn("not-a-real-secret", result.stdout + result.stderr)

    def test_missing_invalid_or_activation_input_fails_closed_without_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key, output = root / "key", root / "runtime.env"
            key.write_text("synthetic-test-key")
            for name, content in (
                ("invalid", "not dotenv\n"),
                ("activation", "BOBBUY_ACCOUNT_MAIL_DELIVERY_ENABLED=true\n"),
            ):
                ciphertext = root / f"{name}.enc"
                ciphertext.write_text(content)
                result = self.run_script(root, "true", ciphertext, key, output)
                self.assertNotEqual(0, result.returncode)
                self.assertFalse(output.exists())
                self.assertNotIn(content.strip(), result.stdout + result.stderr)
            result = self.run_script(root, "true", root / "missing.enc", key, output)
            self.assertNotEqual(0, result.returncode)
            self.assertNotIn("synthetic-test-key", result.stdout + result.stderr)
            ciphertext = root / "valid.enc"
            ciphertext.write_text("SAFE_CONFIGURATION=synthetic\n")
            key.write_text("invalid-test-key")
            result = self.run_script(root, "true", ciphertext, key, output)
            self.assertNotEqual(0, result.returncode)
            self.assertFalse(output.exists())
            self.assertNotIn("invalid-test-key", result.stdout + result.stderr)

    def test_cd_defaults_to_the_existing_env_and_smtp_endpoint_is_configurable(self):
        workflow = (ROOT / ".github/workflows/cd-production.yml").read_text()
        example = (ROOT / ".env.example").read_text()
        properties = (ROOT / "backend/src/main/resources/application.properties").read_text()
        self.assertIn("PROD_ENCRYPTED_ENV_ENABLED: ${{ vars.PROD_ENCRYPTED_ENV_ENABLED || 'false' }}", workflow)
        self.assertIn("env_files=(--env-file /etc/bobuy.env)", workflow)
        self.assertIn('if [[ "$PROD_ENCRYPTED_ENV_ENABLED" == true ]]', workflow)
        self.assertIn("BOBBUY_ACCOUNT_MAIL_SMTP_HOST=", example)
        self.assertIn("BOBBUY_ACCOUNT_MAIL_SMTP_PORT=", example)
        self.assertIn("BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD=", example)
        self.assertIn("${BOBBUY_ACCOUNT_MAIL_SMTP_HOST:mail.briconbric.com}", properties)
        self.assertIn("${BOBBUY_ACCOUNT_MAIL_SMTP_PORT:587}", properties)

    def test_examples_and_runbook_do_not_contain_secret_material(self):
        example = (ROOT / ".env.example").read_text()
        runbook = (ROOT / "docs/secrets-management.md").read_text()
        self.assertIn("BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD=\n", example)
        self.assertNotRegex(example, r"BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD=.+")
        self.assertNotRegex(runbook, r"AGE-SECRET-KEY-[A-Z0-9]+")
        self.assertIn("age1REPLACE_ME", runbook)


if __name__ == "__main__":
    unittest.main()
