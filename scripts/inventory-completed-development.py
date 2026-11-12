"""Read-only worktree inventory against main and the observed live application."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/reports/evidence/completed-development-release-20261112'
LIVE = json.loads((OUT / 'runtime-initial.json').read_text(encoding='utf-8'))
CORE = LIVE['containers']['bobuy-core-service']['revision']
FRONT = LIVE['containers']['bobuy-frontend']['revision']
PATHS = ['backend', 'frontend', 'bobbuy-core', 'bobbuy-common', 'bobbuy-gateway',
         'bobbuy-auth', 'bobbuy-ai', 'bobbuy-im', 'pom.xml', 'infra',
         'docker-compose.yml', 'compose.production.yml', 'compose.local.yml', '.github']

def git(*args, cwd=ROOT):
    return subprocess.check_output(['git', *args], cwd=cwd).decode('utf-8').strip()

def ancestor(older, newer):
    return subprocess.run(['git', 'merge-base', '--is-ancestor', older, newer], cwd=ROOT, capture_output=True).returncode == 0

entries = []
for block in git('worktree', 'list', '--porcelain').split('\n\n'):
    fields = dict(line.split(' ', 1) for line in block.splitlines() if ' ' in line)
    if 'worktree' in fields:
        entries.append(fields)

def inspect(entry):
    directory = Path(entry['worktree'])
    head = git('rev-parse', 'HEAD', cwd=directory)
    base = git('merge-base', 'origin/main', head)
    delta = git('diff', '--name-only', base, head, '--', *PATHS).splitlines()
    main_different = set(git('diff', '--name-only', 'origin/main', head, '--', *PATHS).splitlines())
    live_different = set(git('diff', '--name-only', CORE, head, '--', *[p for p in PATHS if p != 'frontend']).splitlines())
    live_different.update(git('diff', '--name-only', FRONT, head, '--', 'frontend').splitlines())
    raw = subprocess.check_output(['git', 'status', '--porcelain=v1', '-z', '-uall'], cwd=directory)
    status_entries = [value for value in raw.split(b'\0') if value]
    dirty = {}
    for value in status_entries:
        if value[2:3] != b' ':
            continue
        name = value[3:].decode('utf-8')
        path = directory / name
        dirty[name] = {'status': value[:2].decode(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None}
    logs = git('log', '--no-merges', '-10', '--format=%h %s', 'origin/main..' + head).splitlines()
    result = {'worktree': str(directory), 'branch': entry.get('branch'), 'head': head,
              'headStable': git('rev-parse', 'HEAD', cwd=directory) == head,
              'ancestorOfMain': ancestor(head, 'origin/main'), 'ancestorOfLive': ancestor(head, CORE) and ancestor(head, FRONT),
              'mainMergeBase': base, 'uniqueCommits': logs, 'branchApplicationDelta': delta,
              'branchDeltaStillDifferentFromMain': [p for p in delta if p in main_different],
              'branchDeltaStillDifferentFromLive': [p for p in delta if p in live_different],
              'statusSha256': hashlib.sha256(raw).hexdigest(), 'dirtyFiles': dirty}
    return result

with ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(inspect, entries))
doc = {'observedAt': datetime.now(timezone.utc).isoformat(), 'main': git('rev-parse', 'origin/main'),
       'liveCore': CORE, 'liveFrontend': FRONT, 'worktrees': results}
(OUT / 'worktrees-initial.json').write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
for item in results:
    print(json.dumps({'branch': item['branch'], 'head': item['head'][:8], 'inMain': item['ancestorOfMain'],
                      'inLive': item['ancestorOfLive'], 'dirty': len(item['dirtyFiles']),
                      'ownAppDelta': len(item['branchApplicationDelta']), 'ownAppDeltaDifferentFromLive': item['branchDeltaStillDifferentFromLive'],
                      'uniqueCommits': item['uniqueCommits'][:3]}, ensure_ascii=False))
