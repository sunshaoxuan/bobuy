"""Read-only production inventory. Never emit environment or process arguments."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

def run(*args):
    return subprocess.check_output(args, text=True).strip()

result = {'observedAt': datetime.now(timezone.utc).isoformat(), 'containers': {}, 'releases': [], 'releaseProcesses': []}
names = run('docker', 'ps', '-a', '--filter', 'label=com.docker.compose.project=bobuy', '--format', '{{.Names}}').splitlines()
for name in names:
    data = json.loads(run('docker', 'inspect', name))[0]
    image = json.loads(run('docker', 'image', 'inspect', data['Image']))[0]
    labels = image.get('Config', {}).get('Labels') or {}
    result['containers'][name] = {'id': data['Id'], 'image': data['Image'], 'tag': data['Config']['Image'],
        'revision': labels.get('org.opencontainers.image.revision'), 'imageCreated': image.get('Created'),
        'startedAt': data['State']['StartedAt'], 'status': data['State']['Status'], 'health': data['State'].get('Health', {}).get('Status')}
root = Path('/opt/bobuy/releases')
for folder in sorted((p for p in root.iterdir() if p.is_dir()), key=lambda p: p.stat().st_mtime, reverse=True)[:16]:
    entry = {'release': folder.name, 'files': sorted(p.name for p in folder.iterdir() if p.is_file()), 'receipts': {}}
    for path in folder.glob('*.json'):
        if not any(word in path.name for word in ['artifact', 'status', 'activat', 'verify', 'gate', 'staging', 'result', 'apply', 'binding', 'ci.json']):
            continue
        try:
            doc = json.loads(path.read_text())
        except (ValueError, UnicodeError):
            continue
        record = {}
        def walk(value, prefix='', depth=0):
            if depth > 3 or not isinstance(value, dict):
                return
            for key, item in value.items():
                label = prefix + key
                if isinstance(item, dict):
                    walk(item, label + '.', depth + 1)
                elif isinstance(item, (str, bool, int, float)):
                    if key in ['phase', 'status', 'result', 'openedAt', 'reopenedAt', 'completedAt', 'finishedAt', 'activatedAt', 'createdAt', 'version', 'release']:
                        record[label] = item
                    elif isinstance(item, str) and ((re.fullmatch(r'[0-9a-f]{40}', item) and any(word in key.lower() for word in ['source', 'revision', 'commit', 'headsha'])) or item.startswith('bobuy/')):
                        record[label] = item
        walk(doc)
        entry['receipts'][path.name] = {'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'fields': record}
    result['releases'].append(entry)
for proc in Path('/proc').iterdir():
    if not proc.name.isdigit():
        continue
    try:
        parts = [p.decode(errors='replace') for p in (proc / 'cmdline').read_bytes().split(b'\0') if p]
        scripts = [p for p in parts if re.fullmatch(r'/opt/bobuy/(?:releases/[^/]+/|scripts/)[A-Za-z0-9_.-]+\.py', p)]
        if scripts:
            result['releaseProcesses'].append({'pid': int(proc.name), 'scripts': scripts})
    except (FileNotFoundError, PermissionError, ProcessLookupError):
        pass
query = "BEGIN READ ONLY; SELECT coalesce(json_agg(t),'[]'::json) FROM (SELECT version,description,success,installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3)t; SELECT to_regclass('public.bb_product_click') IS NOT NULL; COMMIT;"
result['schema'] = subprocess.check_output(
    ['docker', 'exec', '-i', 'bobuy-postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -v ON_ERROR_STOP=1'], input=query, text=True).strip()
config = Path('/opt/bobuy/infra/nginx/bobuy.conf').read_text()
result['maintenanceConfigured'] = 'Release maintenance in progress' in config
locks = json.loads(run('lslocks', '--json', '--output', 'PID,COMMAND,PATH'))
result['releaseLocks'] = [item for item in locks.get('locks', []) if (item.get('path') or '').startswith('/opt/bobuy/')]
result['frontendFiles'] = run('docker', 'exec', 'bobuy-frontend', 'sh', '-c', "find /usr/share/nginx/html -type f \\( -name '*.js' -o -name '*.css' -o -name 'index.html' \\) -exec sha256sum {} \\;")
print(json.dumps(result, ensure_ascii=False, indent=2))
