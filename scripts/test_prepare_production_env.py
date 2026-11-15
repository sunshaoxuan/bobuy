import os
from pathlib import Path
import stat
import subprocess
import tempfile
import textwrap
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

    def test_malformed_literals_fail_without_disclosure_or_replacing_output(self):
        sentinel = "SYNTHETIC-NOT-A-SECRET"
        for value in (f'"{sentinel}', f"'{sentinel}", f'"{sentinel}\\',
                      f'"{sentinel}"trailing', f"'{sentinel}'trailing",
                      f'${{{sentinel}', f'"${{{sentinel}}}"',
                      f'{sentinel}\x00', f'"{sentinel}\\q"'):
            with self.subTest(value_kind=value[:1]), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                ciphertext, key, output = root / "fixture", root / "key", root / "runtime.env"
                ciphertext.write_text(f"SAFE_CONFIGURATION={value}\n")
                key.write_text("synthetic-test-key")
                output.write_text("PREVIOUS=SYNTHETIC-PREVIOUS\n")
                result = self.run_script(root, "true", ciphertext, key, output)
                self.assertNotEqual(0, result.returncode)
                self.assertEqual("Encrypted production environment preparation failed.\n",
                                 result.stdout + result.stderr)
                self.assertNotIn(sentinel, result.stdout + result.stderr)
                self.assertEqual("PREVIOUS=SYNTHETIC-PREVIOUS\n", output.read_text())
                self.assertEqual([], list(root.glob("runtime.env.tmp.*")))

    def test_valid_literal_quotes_comments_and_escapes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            ciphertext, key, output = root / "fixture", root / "key", root / "runtime.env"
            content = ('# synthetic fixture\nEMPTY=\n'
                       'SINGLE=\'SYNTHETIC-$LITERAL\' # comment\n'
                       'DOUBLE="SYNTHETIC-\\"QUOTED\\"-\\n"\n'
                       'PLAIN=SYNTHETIC-NOT-A-SECRET # comment\n')
            ciphertext.write_text(content)
            key.write_text("synthetic-test-key")
            result = self.run_script(root, "true", ciphertext, key, output)
            self.assertEqual(0, result.returncode)
            self.assertEqual(content, output.read_text())
            self.assertEqual("", result.stdout + result.stderr)

    def environment_helpers(self):
        remote = self.remote_script()
        return (
            'validate_compose() {' + remote.split('validate_compose() {', 1)[1]
            .split('# Pin actual running image IDs', 1)[0])

    def test_compose_validation_captures_and_never_prints_diagnostics(self):
        remote = self.remote_script()
        calls = [line.strip() for line in remote.splitlines() if 'compose config' in line]
        self.assertEqual(['if diagnostics=$(compose config --quiet 2>&1); then'], calls)
        self.assertNotRegex(remote, r'\$(?:diagnostics|\{diagnostics\})')
        self.assertIn('if activate_edge && validate_compose && pull_images', remote)
        for status in (0, 1):
            script = self.environment_helpers() + f'''
compose() {{
  echo SYNTHETIC-NOT-A-SECRET
  echo SYNTHETIC-NOT-A-SECRET >&2
  return {status}
}}
validate_compose
'''
            result = subprocess.run(['bash'], input=script, text=True, capture_output=True)
            self.assertEqual(status, result.returncode)
            self.assertEqual('' if status == 0 else 'Compose configuration validation failed.\n',
                             result.stdout + result.stderr)

    def test_examples_and_runbook_do_not_contain_secret_material(self):
        example = (ROOT / ".env.example").read_text()
        runbook = (ROOT / "docs/secrets-management.md").read_text()
        self.assertIn("BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD=\n", example)
        self.assertNotRegex(example, r"BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD=.+")
        self.assertNotRegex(runbook, r"AGE-SECRET-KEY-[A-Z0-9]+")
        self.assertIn("age1REPLACE_ME", runbook)

    def remote_script(self):
        workflow = (ROOT / ".github/workflows/cd-production.yml").read_text()
        return textwrap.dedent(workflow.split("<<'REMOTE'\n", 1)[1].split("\n          REMOTE", 1)[0])

    def test_rollback_env_selection_is_independent_and_missing_last_uses_base_only(self):
        remote = self.remote_script()
        setup = remote.split('runtime_env="', 1)[1].split('# Pin actual running image IDs', 1)[0]
        self.assertIn('last_env=".cd/runtime-env-last"', setup)
        self.assertIn('rollback_env=".cd/runtime-env-rollback-$REVISION"', setup)
        self.assertIn('rollback_env_files=(--env-file /etc/bobuy.env)', setup)
        self.assertIn('''if [[ -e "$last_env" || -L "$last_env" ]]; then
  [[ -f "$last_env" && ! -L "$last_env" ]] || { echo 'Invalid last-known-good environment file.' >&2; exit 1; }
  cp -- "$last_env" "$rollback_env"
  chmod 600 "$rollback_env"
  rollback_env_files+=(--env-file "$rollback_env")
fi''', setup)
        self.assertEqual(1, remote.count('rollback_env_files+='))
        self.assertIn('''env_files=(--env-file /etc/bobuy.env)
if [[ "$PROD_ENCRYPTED_ENV_ENABLED" == true ]]; then
  bash "$edge_dir/prepare-production-env.sh" true "$edge_dir/production.env.enc" /etc/bobuy/age/keys.txt "$runtime_env"
  env_files+=(--env-file "$runtime_env")
fi''', setup)
        self.assertIn('rollback_compose() { docker compose "${rollback_env_files[@]}" -p bobuy "${compose_files[@]}" "$@"; }', setup)
        recovery = remote.split("echo 'Deployment failed;", 1)[1]
        self.assertIn('if rollback_compose up ', recovery)
        self.assertNotIn('if compose up ', recovery)
        self.assertNotIn('$runtime_env', recovery)
        self.assertNotIn('persist_environment', recovery)

    def test_last_good_is_promoted_only_after_health_and_never_cleaned_on_failure(self):
        remote = self.remote_script()
        self.assertIn('''persist_environment() {
  if [[ "$PROD_ENCRYPTED_ENV_ENABLED" == true ]]; then
    [[ -f "$runtime_env" && ! -L "$runtime_env" ]] || return 1
    chmod 600 "$runtime_env" || return 1
    # Same-directory rename atomically promotes the validated candidate.
    mv -fT -- "$runtime_env" "$last_env" || return 1
  else
    rm -f -- "$last_env" || return 1
  fi
}''', remote)
        self.assertEqual(2, remote.count('persist_environment'))
        activation = remote.split('if activate_edge && validate_compose', 1)[1].split('exit 0', 1)[0]
        self.assertLess(activation.index('&& healthy'), activation.index('&& persist_environment'))
        self.assertLess(activation.index('&& persist_environment'), activation.index('> .cd/deploy-revision; then'))
        self.assertEqual(1, remote.count('mv -fT -- "$runtime_env" "$last_env"'))
        self.assertEqual(2, remote.count('rm -f -- "$last_env"'))
        self.assertIn('umask 077', remote)
        self.assertIn('trap \'rm -f -- "$runtime_env" "$rollback_env"\' EXIT', remote)
        cleanup = remote.split('cleanup_auth() {', 1)[1].split('}', 1)[0]
        self.assertIn('rm -f -- "$runtime_env" "$rollback_env"', cleanup)
        self.assertNotIn('last_env', cleanup)
        self.assertIn('trap cleanup_auth EXIT', remote)

    def test_receipt_failure_restores_environment_before_image_rollback(self):
        remote = self.remote_script()
        activation = remote.split('environment_persisted=false', 1)[1].split(
            "echo 'Deployment failed;", 1)[0]
        self.assertIn('&& persist_environment \\\n  && environment_persisted=true', activation)
        for previous, enabled, restore_failure in (
            (True, True, False), (False, True, False), (True, False, False),
            (False, False, False), (True, True, True),
        ):
            with self.subTest(previous=previous, enabled=enabled, restore_failure=restore_failure), \
                    tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / '.cd').mkdir()
                # A directory forces the actual receipt redirection to fail.
                (root / '.cd/deploy-revision').mkdir()
                last, rollback = root / '.cd/runtime-env-last', root / '.cd/rollback'
                if previous:
                    last.write_text('PREVIOUS=SYNTHETIC-PREVIOUS\n')
                    rollback.write_text(last.read_text())
                (root / '.cd/runtime').write_text('CANDIDATE=SYNTHETIC-CANDIDATE\n')
                script = '''set -euo pipefail
umask 077
runtime_env=.cd/runtime
last_env=.cd/runtime-env-last
rollback_env=.cd/rollback
REVISION=synthetic-revision
services=(synthetic-service)
activate_edge() { return 0; }
pull_images() { return 0; }
compose() { return 0; }
containers_healthy() { return 0; }
reload_nginx() { return 0; }
healthy() { return 0; }
cleanup_after_deploy() { exit 99; }
trap 'rm -f -- "$runtime_env" "$rollback_env"' EXIT
''' + self.environment_helpers()
                if restore_failure:
                    script += '\nmv() { if [[ "$2" == -- && "$3" == *.restore.* ]]; then return 1; fi; command mv "$@"; }\n'
                script += f'\nPROD_ENCRYPTED_ENV_ENABLED={str(enabled).lower()}\n'
                script += 'environment_persisted=false' + activation
                script += '\nprintf reached > .cd/image-rollback-attempted\n'
                result = subprocess.run(['bash'], input=script, cwd=root, text=True, capture_output=True)
                self.assertEqual(0, result.returncode, 'Receipt failure must reach rollback')
                self.assertTrue((root / '.cd/image-rollback-attempted').is_file())
                self.assertNotIn('SYNTHETIC-', result.stdout + result.stderr)
                if restore_failure:
                    self.assertIn('WARNING: last-known-good environment restoration failed.', result.stderr)
                elif previous:
                    self.assertEqual('PREVIOUS=SYNTHETIC-PREVIOUS\n', last.read_text())
                    self.assertTrue(last.is_file() and not last.is_symlink())
                    self.assertEqual(0o600, stat.S_IMODE(last.stat().st_mode))
                else:
                    self.assertFalse(last.exists())
                self.assertFalse(rollback.exists())
                self.assertFalse((root / '.cd/runtime').exists())
                self.assertEqual([], list((root / '.cd').glob('*.restore.*')))

    def test_remote_shell_syntax(self):
        result = subprocess.run(['bash', '-n'], input=self.remote_script(),
                                text=True, capture_output=True, check=False)
        self.assertEqual(0, result.returncode, result.stderr)

    def test_workflow_and_runbook_secret_safety_and_previous_env_contract(self):
        workflow = (ROOT / '.github/workflows/cd-production.yml').read_text()
        runbook = (ROOT / 'docs/secrets-management.md').read_text()
        for content in (workflow, runbook):
            self.assertNotRegex(content, r'AGE-SECRET-KEY-[A-Z0-9]+')
            self.assertNotRegex(content, r'ENC\[AES256_GCM,')
            self.assertNotRegex(content, r'-----BEGIN (?:AGE ENCRYPTED FILE|.*PRIVATE KEY)-----')
            self.assertNotRegex(content, r'(?m)^\s*BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD=\S+')
            self.assertNotRegex(content, r'compose config(?! --quiet)')
        for required in ('.cd/runtime-env-last', '.cd/runtime-env-rollback-$REVISION',
                         '0600', '不得复制离开生产主机或提交 Git',
                         '回滚仅使用 `/etc/bobuy.env`', '失败保留原'):
            self.assertIn(required, runbook)
        remote = self.remote_script()
        self.assertNotRegex(remote, r'(?:cat|echo|printf).*\$(?:runtime_env|rollback_env|last_env)')


if __name__ == "__main__":
    unittest.main()
