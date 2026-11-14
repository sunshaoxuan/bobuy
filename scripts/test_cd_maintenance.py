"""Local-only execution of the CD remote script with fake Docker/network commands."""
import os
from pathlib import Path
import shutil
import subprocess
from tempfile import TemporaryDirectory
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
BASH = 'C:/Program Files/Git/bin/bash.exe' if os.name == 'nt' else shutil.which('bash')


class EdgeActivationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        workflow = yaml.safe_load((ROOT / '.github/workflows/cd-production.yml').read_text())
        step = next(s for s in workflow['jobs']['deploy']['steps'] if s.get('id') == 'deploy')
        cls.script = step['run'].split("<<'REMOTE'\n", 1)[1].split('\nREMOTE', 1)[0]

    def run_scenario(self, failure='', mounted=True):
        with TemporaryDirectory(dir=ROOT) as directory:
            root = Path(directory)
            (root / 'infra/nginx').mkdir(parents=True)
            (root / '.cd/edge-test').mkdir(parents=True)
            for name, content in [('infra/nginx/bobuy.conf', 'old nginx'),
                                  ('compose.production.yml', 'old compose'),
                                  ('infra/nginx/maintenance.html', 'old page'),
                                  ('env', ''), ('.cd/edge-test/bobuy.conf', 'new nginx'),
                                  ('.cd/edge-test/compose.production.yml', 'new compose'),
                                  ('.cd/edge-test/maintenance.html', 'new page')]:
                (root / name).write_text(content)
            original = {str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*') if p.is_file()}
            mocks = r'''
docker() {
  printf '%s\n' "$*" >> calls
  case "$*" in
    'info --format {{.DockerRootDir}}') echo . ;;
    inspect*Mounts*) if [[ "$MOUNTED" == yes ]]; then echo /etc/nginx/maintenance.html; fi ;;
    inspect*State.Health*) echo healthy ;;
    inspect*) echo sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ;;
    cp*) [[ "$FAILURE" != copy ]] ;;
    'exec bobuy-gateway nginx -t') [[ "$FAILURE" != test || "$(cat infra/nginx/bobuy.conf)" == 'old nginx' ]] ;;
    'exec bobuy-gateway nginx -s reload') [[ "$FAILURE" != reload || "$(cat infra/nginx/bobuy.conf)" == 'old nginx' ]] ;;
    compose*'pull core-service'*) [[ "$FAILURE" != pull ]] ;;
    compose*'up -d'*--force-recreate*)
      [[ "$(cat infra/nginx/bobuy.conf)" == 'old nginx' && "$(cat compose.production.yml)" == 'old compose' ]] || return 90
      echo restored > rollback-observed ;;
    compose*'up -d'*) [[ "$FAILURE" != up ]] ;;
  esac
}
df() { if [[ "$FAILURE" == disk ]]; then printf 'Avail\n1\n'; else printf 'Avail\n99999999\n'; fi; }
curl() { printf 200; }
sleep() { :; }
'''
            script = self.script.replace('/opt/bobuy', root.as_posix()).replace('/etc/bobuy.env', (root / 'env').as_posix())
            # Cleanup is outside this regression's scope; keep the real activation/recovery code.
            start = script.index('cleanup_after_deploy() (')
            end = script.index('# Keep every fallible activation step', start)
            script = script[:start] + 'cleanup_after_deploy() { :; }\n' + script[end:]
            env = {**os.environ, 'REVISION': 'test', 'REGISTRY': 'example.invalid/test',
                   'GHCR_USER': 'fixture', 'FAILURE': failure, 'MOUNTED': 'yes' if mounted else 'no'}
            result = subprocess.run([BASH, '-c', mocks + script], cwd=root, env=env, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1 if failure else 0, result.stderr)
            calls = (root / 'calls').read_text()
            if failure == 'disk':
                current = {str(p.relative_to(root)): p.read_bytes() for p in root.rglob('*') if p.is_file() and p.name != 'calls'}
                self.assertEqual(current, original)
                self.assertNotIn('exec ', calls)
                self.assertNotIn('cp ', calls)
            elif failure:
                self.assertEqual((root / 'infra/nginx/bobuy.conf').read_text(), 'old nginx')
                self.assertEqual((root / 'compose.production.yml').read_text(), 'old compose')
                self.assertTrue((root / 'rollback-observed').exists(), result.stderr)
                self.assertTrue((root / '.cd/last-rollback').exists(), result.stderr)
            else:
                self.assertEqual((root / 'infra/nginx/maintenance.html').read_text(), 'new page')
                self.assertEqual('cp infra/nginx/maintenance.html' in calls, not mounted)
                self.assertTrue((root / '.cd/deploy-revision').exists())

    def test_disk_preflight_changes_nothing(self):
        self.run_scenario('disk')

    def test_mounted_page_never_uses_docker_cp(self):
        self.run_scenario()

    def test_first_deploy_copies_to_writable_container(self):
        self.run_scenario(mounted=False)

    def test_activation_and_image_failures_restore_both_configs(self):
        for failure in ('copy', 'test', 'reload', 'pull', 'up'):
            with self.subTest(failure=failure):
                self.run_scenario(failure, mounted=failure != 'copy')

    def test_remote_bash_syntax_and_local_mount(self):
        result = subprocess.run([BASH, '-n'], input=self.script, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        compose = yaml.safe_load((ROOT / 'docker-compose.yml').read_text())
        self.assertIn('./infra/nginx/maintenance.html:/etc/nginx/maintenance.html:ro', compose['services']['gateway']['volumes'])


if __name__ == '__main__':
    unittest.main()
