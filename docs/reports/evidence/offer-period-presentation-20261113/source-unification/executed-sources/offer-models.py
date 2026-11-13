import json,urllib.request
from pathlib import Path
c=json.loads((Path.home()/'.codex/sub2api-agent/runtime/config.json').read_text(encoding='utf-8-sig'));r=urllib.request.Request('http://127.0.0.1:39452/v1/models',headers={'Authorization':'Bearer '+c['api-keys'][0]});print('\n'.join(x['id'] for x in json.load(urllib.request.urlopen(r,timeout=30))['data'] if x['id'].startswith('gemini')))
