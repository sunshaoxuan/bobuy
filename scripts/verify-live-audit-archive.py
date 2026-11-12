"""Verify a documentation-only archive without running production probes."""
import hashlib
import json
from pathlib import Path
import shutil
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = '724f9c098cb869aac07d180e8e5d1776faa1beb3'
BRANCH = 'codex-engagement-live-audit-main-20261112'
ARCHIVE_BRANCH = 'codex-engagement-live-audit-20261112'
PREFIX = 'docs/reports/evidence/product-engagement-production/live-audit'
REPORT = 'docs/reports/PRODUCT-ENGAGEMENT-LIVE-AUDIT-20261112.md'
OUT = ROOT / (PREFIX + '-archive')
INPUTS = ['backend', 'frontend', 'bobbuy-core', 'bobbuy-common', 'pom.xml', '.github',
          'docker-compose.yml', 'compose.production.yml', 'compose.local.yml']

def git(*args, cwd=ROOT, data=None):
    return subprocess.check_output(['git', *args], cwd=cwd, input=data).decode('utf-8').strip()

def heads(remote=False):
    lines = git('ls-remote', '--heads', 'origin').splitlines() if remote else git('for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads').splitlines()
    return {ref: sha for sha, ref in (line.split() for line in lines)}

def shared():
    root = ROOT.parent.parent
    raw = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z', '-uall'], cwd=root)
    files = {}
    for entry in raw.split(b'\0'):
        if not entry:
            continue
        assert entry[2:3] == b' ', 'Rename requires explicit review'
        name = entry[3:].decode('utf-8')
        path = root / name
        files[name] = hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    return {'statusSha256': hashlib.sha256(raw).hexdigest(), 'files': files}

def tree(ref, cwd=ROOT):
    return {path: meta.split()[2] for meta, path in (line.split('\t', 1) for line in git('ls-tree', '-r', ref, '--', PREFIX, REPORT, cwd=cwd).splitlines())}

def cleanup(path):
    assert path.resolve() == (ROOT / '.task-tmp/live-audit-independent.git').resolve()
    def retry(function, name, error):
        if not isinstance(error, PermissionError):
            raise error
        Path(name).chmod(stat.S_IREAD | stat.S_IWRITE)
        function(name)
    if path.exists():
        shutil.rmtree(path, onexc=retry)
    if path.parent.exists() and not any(path.parent.iterdir()):
        path.parent.rmdir()

OUT.mkdir(parents=True, exist_ok=True)
baseline_path = OUT / 'before.json'
mode = sys.argv[1]
if mode == 'snapshot':
    assert not baseline_path.exists()
    value = {'source': SOURCE, 'localHeads': heads(), 'remoteHeads': heads(True), 'shared': shared(), 'sourceFiles': tree(SOURCE)}
    baseline_path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('ARCHIVE_PROTECTION_SNAPSHOT_SAVED')
elif mode == 'verify':
    before = json.loads(baseline_path.read_text(encoding='utf-8'))
    remote, local, current_shared = heads(True), heads(), shared()
    base = before['remoteHeads']['refs/heads/main']
    subprocess.run(['git', 'merge-base', '--is-ancestor', SOURCE, 'HEAD'], cwd=ROOT, check=True)
    subprocess.run(['git', 'merge-base', '--is-ancestor', base, 'HEAD'], cwd=ROOT, check=True)
    subprocess.run(['git', 'diff', '--exit-code', base, 'HEAD', '--', *INPUTS], cwd=ROOT, check=True)
    subprocess.run(['git', 'diff', '--check', base, 'HEAD'], cwd=ROOT, check=True)
    original = before['sourceFiles']
    assert tree('HEAD') == original, 'Original audit report or evidence Git objects changed'
    evidence_paths = [name for name in original if name.startswith(PREFIX + '/')]
    raw_hashes = git('hash-object', '--no-filters', '--stdin-paths', data=('\n'.join(evidence_paths) + '\n').encode('utf-8')).splitlines()
    assert all(original[name] == value for name, value in zip(evidence_paths, raw_hashes)) and len(raw_hashes) == len(evidence_paths)
    assert git('hash-object', REPORT) == original[REPORT]
    changed = git('diff', '--name-only', base, 'HEAD').splitlines()
    allowed = {REPORT, 'docs/plans/PRODUCT-SORT-POPULARITY-20261111.md',
               'docs/reports/PRODUCT-ENGAGEMENT-LIVE-AUDIT-MERGE-20261112.md', 'scripts/verify-live-audit-archive.py'}
    assert all(name in allowed or name.startswith(PREFIX + '/') or name.startswith(PREFIX + '-archive/') for name in changed), changed
    local_changes = {ref: {'before': sha, 'after': local.get(ref), 'reflog': git('reflog', 'show', '-1', '--format=%H %gs', ref)} for ref, sha in before['localHeads'].items() if ref != 'refs/heads/' + BRANCH and local.get(ref) != sha}
    remote_changes = {ref: {'before': sha, 'after': remote.get(ref)} for ref, sha in before['remoteHeads'].items() if ref != 'refs/heads/main' and remote.get(ref) != sha}
    shared_changes = {name: {'before': value, 'after': current_shared['files'].get(name)} for name, value in before['shared']['files'].items() if current_shared['files'].get(name) != value}
    added = {name: value for name, value in current_shared['files'].items() if name not in before['shared']['files']}
    result = {'result': 'PASS', 'source': SOURCE, 'baseMain': base, 'candidate': git('rev-parse', 'HEAD'),
              'tree': git('rev-parse', 'HEAD^{tree}'), 'sourceFilesUnchanged': len(original),
              'rawEvidenceBytesUnchanged': len(evidence_paths), 'runtimeInputsEqualToMain': True,
              'localRefObservations': local_changes, 'remoteRefObservations': remote_changes,
              'sharedExistingFileChanges': shared_changes, 'sharedNewFiles': added,
              'sharedStatusUnchanged': current_shared['statusSha256'] == before['shared']['statusSha256'],
              'protectionReview': 'REQUIRED' if local_changes or remote_changes or shared_changes or added or current_shared['statusSha256'] != before['shared']['statusSha256'] else 'PASS',
              'productionOperations': 0}
    if '--independent' in sys.argv:
        assert remote['refs/heads/' + ARCHIVE_BRANCH] == SOURCE
        assert remote['refs/heads/' + BRANCH] == result['candidate']
        temp = ROOT / '.task-tmp/live-audit-independent.git'
        assert not temp.exists()
        temp.parent.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(['git', 'clone', '--bare', '--single-branch', '--branch', BRANCH, git('remote', 'get-url', 'origin'), str(temp)], check=True)
            assert git('rev-parse', 'HEAD', cwd=temp) == result['candidate']
            assert git('rev-parse', 'HEAD^{tree}', cwd=temp) == result['tree']
            assert tree(SOURCE, cwd=temp) == original
            subprocess.run(['git', 'fsck', '--full', '--no-dangling'], cwd=temp, check=True)
            result['independentCloneFsck'] = 'PASS'
        finally:
            cleanup(temp)
    if '--write' in sys.argv:
        (OUT / 'preflight.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))
else:
    raise SystemExit('Use snapshot or verify [--write] [--independent]')
