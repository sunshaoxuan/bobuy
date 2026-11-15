"""Focused offline contracts for the production mail probe; no credentials needed."""
from pathlib import Path
import os
import shutil
import subprocess
import textwrap
import unittest


class ProductionMailProbeTest(unittest.TestCase):
    def test_shell_syntax_and_missing_token_fail_closed(self):
        bash = shutil.which("bash") if os.name != "nt" else "C:/Program Files/Git/bin/bash.exe"
        if not bash or not Path(bash).is_file():
            self.skipTest("Bash unavailable")
        workflow = (Path(__file__).resolve().parents[1] / ".github/workflows/send-production-test-email.yml").read_text(encoding="utf-8")
        step = workflow.split("      - name: Send one loopback-only test message\n        run: |\n", 1)[1].split("      - name:", 1)[0]
        syntax = subprocess.run([bash, "-n"], input=textwrap.dedent(step), text=True, capture_output=True)
        if os.name == "nt" and syntax.returncode == 0xC0000142:
            self.skipTest("Windows could not initialize Bash (0xC0000142)")
        self.assertEqual(syntax.returncode, 0)
        probe = textwrap.dedent(step.split("<<'PROBE'\n", 1)[1].split("          PROBE\n", 1)[0])
        environment = {key: value for key, value in os.environ.items() if key not in ("BOBBUY_SECURITY_SERVICE_TOKEN", "BASH_ENV", "SHELLOPTS")}
        result = subprocess.run([bash], input=probe, text=True, capture_output=True, env=environment)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_container_owns_environment_expansion_and_fails_closed(self):
        workflow = (Path(__file__).resolve().parents[1] / ".github/workflows/send-production-test-email.yml").read_text(encoding="utf-8")
        self.assertIn("'docker exec -i bobuy-auth-service sh' 2>/dev/null <<'PROBE'", workflow)
        probe = workflow.split("<<'PROBE'\n", 1)[1].split("          PROBE\n", 1)[0]
        self.assertIn('set +x', probe)
        self.assertIn('test -n "${BOBBUY_SECURITY_SERVICE_TOKEN:-}" || exit 1', probe)
        self.assertIn('--header "X-BOBBUY-SERVICE-TOKEN: ${BOBBUY_SECURITY_SERVICE_TOKEN}"', probe)
        self.assertIn('http://127.0.0.1:${SERVER_PORT}/internal/account-mail/test', probe)
        self.assertLess(probe.index('test -n'), probe.index('curl --silent'))
        self.assertNotIn('8080', probe)
        self.assertNotIn('set -x', workflow)
        self.assertNotIn('echo "$result"', workflow)
        self.assertIn('connection|tls|authentication|rejected|timeout|unknown', workflow)


if __name__ == "__main__":
    unittest.main()
