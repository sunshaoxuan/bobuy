"""Protect shared changes and verify the engagement archive from an independent fetch."""
import hashlib
import json
from pathlib import Path
import shutil
import stat
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/reports/evidence/product-engagement-production/git-archive'
BRANCH = 'codex-product-engagement-production-20261112-archive'

def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd).decode('utf-8').strip()

def refs():
    return {ref: sha for sha, ref in (line.split() for line in git('ls-remote', '--heads', 'origin').splitlines())}

def protected():
    main = ROOT.parent.parent
    status = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z', '-uall'], cwd=main)
    entries = status.split(b'\0')
    files = {}
    for entry in entries:
        if not entry:
            continue
        # Renames are recorded separately; this checkout has none at baseline.
        assert entry[2:3] == b' ', 'Unexpected rename/status entry'
        path = entry[3:].decode('utf-8')
        target = main / path
        files[path] = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else None
    return {'statusSha256': hashlib.sha256(status).hexdigest(), 'files': files}

OUT.mkdir(parents=True, exist_ok=True)
baseline = OUT / 'before.json'
def cleanup(temp):
    assert temp.resolve() == (ROOT / '.task-tmp/git-archive-independent.git').resolve()
    def writable_retry(function, path, error):
        if not isinstance(error, PermissionError):
            raise error
        Path(path).chmod(stat.S_IWRITE | stat.S_IREAD)
        function(path)
    if temp.exists():
        shutil.rmtree(temp, onexc=writable_retry)
    if temp.parent.exists() and not any(temp.parent.iterdir()):
        temp.parent.rmdir()

if sys.argv[1] == 'snapshot':
    assert not baseline.exists()
    baseline.write_text(json.dumps({'refs': refs(), 'protected': protected()}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('BASELINE_SAVED')
elif sys.argv[1] == 'verify':
    before = json.loads(baseline.read_text(encoding='utf-8'))
    current = refs()
    assert protected() == before['protected'], 'Shared checkout changed'
    changed = {ref: {'before': sha, 'after': current.get(ref)} for ref, sha in before['refs'].items() if current.get(ref) != sha}
    assert not changed, changed
    tip = git('rev-parse', 'HEAD')
    assert current['refs/heads/' + BRANCH] == tip
    temp = ROOT / '.task-tmp' / 'git-archive-independent.git'
    assert not temp.exists()
    temp.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(['git', 'clone', '--bare', '--single-branch', '--branch', BRANCH, git('remote', 'get-url', 'origin'), str(temp)], check=True)
        assert git('rev-parse', 'HEAD', cwd=temp) == tip
        subprocess.run(['git', 'fsck', '--full', '--no-dangling'], cwd=temp, check=True)
        assert git('rev-list', '--count', 'HEAD', cwd=temp) == git('rev-list', '--count', tip)
        assert git('rev-parse', 'HEAD^{tree}', cwd=temp) == git('rev-parse', 'HEAD^{tree}')
        prefix = 'docs/reports/evidence/product-engagement-production'
        local_tree = git('ls-tree', '-r', 'HEAD', '--', prefix)
        assert git('ls-tree', '-r', 'HEAD', '--', prefix, cwd=temp) == local_tree
        evidence = [line.split('\t', 1) for line in local_tree.splitlines()]
        paths = [path for _, path in evidence]
        hashes = subprocess.check_output(
            ['git', 'hash-object', '--no-filters', '--stdin-paths'], cwd=ROOT,
            input=('\n'.join(paths) + '\n').encode('utf-8')).decode().splitlines()
        assert len(hashes) == len(evidence)
        for (metadata, path), blob in zip(evidence, hashes):
            assert metadata.split()[2] == blob, path
        count = len(evidence)
        result = {'result': 'PASS', 'branch': BRANCH, 'verifiedCommit': tip,
                  'tree': git('rev-parse', 'HEAD^{tree}'), 'commitCount': int(git('rev-list', '--count', 'HEAD')),
                  'rawEvidenceFiles': count, 'allExistingRemoteHeadsUnchanged': True,
                  'sharedCheckoutStatusAndFileHashesUnchanged': True,
                  'independentBareCloneFsck': 'PASS', 'productionMutation': False}
    finally:
        cleanup(temp)
    if '--no-write' not in sys.argv:
        (OUT / 'verified.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))
elif sys.argv[1] == 'cleanup':
    cleanup(ROOT / '.task-tmp/git-archive-independent.git')
    print('OWNED_CLONE_CLEANUP_PASS')
else:
    raise SystemExit('Use snapshot or verify')
