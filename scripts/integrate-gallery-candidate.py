"""Resolve only the pinned gallery candidate's known integration conflicts."""
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[1]
owner = root.parent.parent / '.task-tmp/gallery-upload-feedback-20261109'
out = root / 'docs/reports/evidence/completed-development-release-20261112'
manifest = json.loads((out / 'gallery-original-source.json').read_text(encoding='utf-8'))
for name, digest in manifest['files'].items():
    assert hashlib.sha256((owner / name).read_bytes()).hexdigest() == digest, name

updates = {}
for locale in ['en-US', 'ja-JP', 'zh-CN', 'zh-TW']:
    name = 'frontend/src/locales/' + locale + '.ts'
    current = subprocess.check_output(['git', 'show', ':2:' + name], cwd=root).decode('utf-8')
    patch = (out / 'gallery-original.patch').read_text(encoding='utf-8')
    section = next(part for part in patch.split('diff --git ') if part.startswith('a/' + name + ' '))
    entries = [line[1:] for line in section.splitlines() if line.startswith('+') and not line.startswith('+++')
               and re.match(r'\s*"(?:master\.upload_|gallery\.hash_unavailable)', line[1:])]
    assert entries
    keys = [re.search(r'"([^"]+)"', line).group(1) for line in entries]
    assert len(set(keys)) == len(keys)
    assert all(not re.search(r'"' + re.escape(key) + r'"\s*:', current) for key in keys)
    marker = 'const messages: Dictionary = {'
    assert current.count(marker) == 1
    updates[name] = current.replace(marker, marker + '\n' + '\n'.join(entries), 1)

name = 'frontend/src/components/ProductCatalogPanel.tsx'
current = (root / name).read_text(encoding='utf-8')
current, count = re.subn(r'<<<<<<< ours\n.*?=======\n(.*?)>>>>>>> theirs\n',
                        lambda match: match.group(1).replace('if(busy||!draft', 'if(busy||ratingBusy||!draft'),
                        current, flags=re.S)
assert count == 1
assert 'busy||ratingBusy||!draft' in current
updates[name] = current
for name, value in updates.items():
    assert not any(marker in value for marker in ['<<<<<<<', '=======', '>>>>>>>'])
for name, value in updates.items():
    (root / name).write_text(value, encoding='utf-8')
for name in ['frontend/src/components/ProductCatalogPanel.uploadFeedback.test.tsx', 'frontend/src/imageUploadFeedback.test.ts']:
    (root / name).write_bytes((owner / name).read_bytes())
print('PINNED_GALLERY_INTEGRATED_PRESERVING_RATING_GUARD_AND_ALL_EXISTING_TRANSLATIONS')
