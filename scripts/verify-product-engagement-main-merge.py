"""Verify the scope and protected state of the already-deployed engagement merge."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/reports/evidence/product-engagement-production/main-merge'
ARCHIVE = 'c680934f3a83104707eaa61bc0d82ea50efa3afa'
BRANCH = 'codex-product-engagement-main-20261112'
RUNTIME = ['backend', 'frontend', 'bobbuy-core', 'bobbuy-common', 'pom.xml', '.github',
           'docker-compose.yml', 'compose.production.yml', 'compose.local.yml']

def git(*args, cwd=ROOT, data=None):
    return subprocess.check_output(['git', *args], cwd=cwd, input=data).decode('utf-8').strip()

def remote():
    return {ref: sha for sha, ref in (line.split() for line in git('ls-remote', '--heads', 'origin').splitlines())}

def local():
    return {ref: sha for ref, sha in (line.split() for line in git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads').splitlines())}

def shared():
    main = ROOT.parent.parent
    status = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z', '-uall'], cwd=main)
    files = {}
    for entry in status.split(b'\0'):
        if not entry:
            continue
        assert entry[2:3] == b' ', 'Unexpected rename/status entry'
        path = entry[3:].decode('utf-8')
        target = main / path
        files[path] = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
    return {'statusSha256': hashlib.sha256(status).hexdigest(), 'files': files}

OUT.mkdir(parents=True, exist_ok=True)
baseline_path = OUT / 'before.json'
mode = sys.argv[1]
if mode == 'snapshot':
    assert not baseline_path.exists()
    baseline_path.write_text(json.dumps({'remote': remote(), 'local': local(), 'shared': shared()}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('MAIN_MERGE_PROTECTION_BASELINE_SAVED')
elif mode == 'verify':
    before = json.loads(baseline_path.read_text(encoding='utf-8'))
    current_remote, current_local = remote(), local()
    assert shared() == before['shared'], 'Shared worktree state or bytes changed'
    assert all(current_remote.get(ref) == sha for ref, sha in before['remote'].items() if ref != 'refs/heads/main'), 'Existing remote branch moved'
    assert all(current_local.get(ref) == sha for ref, sha in before['local'].items() if ref != 'refs/heads/' + BRANCH), 'Other local branch moved'
    subprocess.run(['git', 'merge-base', '--is-ancestor', ARCHIVE, 'HEAD'], cwd=ROOT, check=True)
    base = before['remote']['refs/heads/main']
    subprocess.run(['git', 'diff', '--exit-code', base, 'HEAD', '--', *RUNTIME], cwd=ROOT, check=True)
    subprocess.run(['git', 'diff', '--check', base, 'HEAD'], cwd=ROOT, check=True)
    prefix = 'docs/reports/evidence/product-engagement-production'
    source_tree = git('ls-tree', '-r', ARCHIVE, '--', prefix)
    candidate_tree = {path: meta.split()[2] for meta, path in
                      (line.split('\t', 1) for line in git('ls-tree', '-r', 'HEAD', '--', prefix).splitlines())}
    evidence = [line.split('\t', 1) for line in source_tree.splitlines()]
    raw_hashes = git('hash-object', '--no-filters', '--stdin-paths',
                     data=('\n'.join(path for _, path in evidence) + '\n').encode('utf-8')).splitlines()
    assert len(evidence) == len(raw_hashes)
    for (meta, path), raw_hash in zip(evidence, raw_hashes):
        assert candidate_tree[path] == meta.split()[2] == raw_hash, path
    subprocess.run([sys.executable, '-B', 'scripts/check-product-engagement-evidence.py'], cwd=ROOT, check=True)
    result = {'result': 'PASS', 'archive': ARCHIVE, 'baseMain': base,
              'candidate': git('rev-parse', 'HEAD'), 'candidateTree': git('rev-parse', 'HEAD^{tree}'),
              'runtimeDependenciesMigrationsWorkflowsEqualToMain': True,
              'archiveEvidenceFilesUnchanged': len(source_tree.splitlines()),
              'otherRemoteAndLocalBranchesUnchanged': True, 'sharedWorktreeBytesUnchanged': True,
              'productionOperations': 0}
    if '--write' in sys.argv:
        (OUT / 'candidate-verification.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))
else:
    raise SystemExit('Use snapshot or verify [--write]')
