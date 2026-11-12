"""Protect shared changes and verify the engagement archive from an independent fetch."""
import hashlib
import json
from pathlib import Path
import shutil
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
        count = 0
        for line in git('ls-tree', '-r', 'HEAD', '--', prefix).splitlines():
            metadata, path = line.split('\t', 1)
            blob = metadata.split()[2]
            assert git('hash-object', '--no-filters', path) == blob, path
            assert git('rev-parse', 'HEAD:' + path, cwd=temp) == blob, path
            count += 1
        result = {'result': 'PASS', 'branch': BRANCH, 'verifiedCommit': tip,
                  'tree': git('rev-parse', 'HEAD^{tree}'), 'commitCount': int(git('rev-list', '--count', 'HEAD')),
                  'rawEvidenceFiles': count, 'allExistingRemoteHeadsUnchanged': True,
                  'sharedCheckoutStatusAndFileHashesUnchanged': True,
                  'independentBareCloneFsck': 'PASS', 'productionMutation': False}
    finally:
        assert temp.resolve() == (ROOT / '.task-tmp/git-archive-independent.git').resolve()
        shutil.rmtree(temp)
        if not any(temp.parent.iterdir()):
            temp.parent.rmdir()
    (OUT / 'verified.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))
else:
    raise SystemExit('Use snapshot or verify')
