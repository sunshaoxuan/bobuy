from pathlib import Path
import ast
ROOT=Path(__file__).resolve().parents[4];OUT=Path(__file__).resolve().parent
s=(ROOT/'docs/reports/evidence/completed-development-release-20261112/frontend-release.py').read_text(encoding='utf-8')
s=s.replace('20261112.gallery-upload-feedback','20261112.product-fact-localization')
s=s.replace("BASE_FRONT='3a8b11ac97eab33f676b523af04af1f9922fd3f1'","BASE_FRONT='c3bb160c7a8f0541b06089e2a3eacca05008198d'")
s=s.replace("temp=ROOT/'.task-tmp/completed-release/payload';temp.mkdir(exist_ok=True)","temp=ROOT/'.task-tmp/spec-release/payload';temp.mkdir(parents=True,exist_ok=True)")
s=s.replace('verified gallery upload feedback','reviewed product fact localization')
start=s.index("  ci=[v for v in json.loads(run(['gh','pr','checks','69'")
end=s.index("  frontend=json.loads((OUT/'frontend-gates.json')",start)
s=s[:start]+'''  runs=json.loads(run(['gh','run','list','--branch','codex-product-spec-localization-20261112','--workflow','codeql.yml','--limit','10','--json','headSha,status,conclusion,url,databaseId']))
  ci=next(v for v in runs if v['headSha']==source and v['status']=='completed' and v['conclusion']=='success')
  write('ci.json',dict(source=source,run=ci))
'''+s[end:]
start=s.index("  browser=json.loads((OUT/'gallery-compiled-final.json')")
end=s.index("  gates=dict(source=source",start)
s=s[:start]+'''  browser=json.loads((OUT/'candidate-acceptance.json').read_text());assert browser['result']=='PASS'
  assert browser['frontendManifestSha256']==sha(OUT/'frontend-files.json')
  visual=json.loads((OUT/'visual-acceptance.json').read_text());assert visual['result']=='PASS'
'''+s[end:]
s=s.replace('.read_text()',".read_text(encoding='utf-8')")
ast.parse(s);(OUT/'frontend-release.py').write_text(s,encoding='utf-8')
print('Scoped frontend publisher prepared; no production action executed')
