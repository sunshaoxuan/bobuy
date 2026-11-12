from pathlib import Path
import json,hashlib,subprocess,ast
ROOT=Path(__file__).resolve().parents[4];E=Path(__file__).resolve().parent
def run(*args):return subprocess.check_output(args,cwd=ROOT,text=True,encoding='utf-8').strip()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
source=run('git','rev-parse','HEAD');assert not run('git','diff','HEAD','--name-only','--','frontend')
assert not run('git','diff','5a9bb64ab8cda965018bddacfe9471c1081ca34b','--name-only','--','backend','bobbuy-core','bobbuy-common','pom.xml')
full=json.loads((E/'frontend-tests.json').read_text(encoding='utf-8'));focused=json.loads((E/'frontend-final-focused.json').read_text(encoding='utf-8'))
assert full['success'] and full['numPassedTests']==818 and full['numFailedTests']==0
assert focused['success'] and focused['numPassedTests']==48 and focused['numFailedTests']==0
assert 'Generated home-only crawlable HTML' in (E/'frontend-final-build.log').read_text(encoding='utf-8')
coverage=json.loads((E/'coverage.json').read_text());assert coverage['result']=='PASS' and coverage['resourceSha256']==sha(ROOT/'frontend/src/locales/product-facts.json')
assets={p.relative_to(ROOT/'frontend/dist').as_posix():sha(p) for p in sorted((ROOT/'frontend/dist').rglob('*')) if p.is_file()}
(E/'frontend-files.json').write_text(json.dumps(assets,indent=2)+'\n',encoding='utf-8')
gates=[dict(name='frontend-tests',exitCode=0,fullPassed=818,finalAffectedPassed=48,reason='Preserved first stable full run; final copy/translated-spec-warning correction retested with the affected union',fullReportSha256=sha(E/'frontend-tests.json'),focusedReportSha256=sha(E/'frontend-final-focused.json')),dict(name='frontend-build',exitCode=0,source=source,logSha256=sha(E/'frontend-final-build.log'),assetManifestSha256=sha(E/'frontend-files.json'))]
(E/'frontend-gates.json').write_text(json.dumps(gates,indent=2)+'\n',encoding='utf-8')
manifest={p:sha(ROOT/p) for p in run('git','ls-files','frontend').splitlines() if (ROOT/p).is_file()}
(E/'source-binding.json').write_text(json.dumps(dict(source=source,frontend=manifest,frontendManifestSha256=sha(E/'frontend-files.json'),backendUnchangedFrom='5a9bb64ab8cda965018bddacfe9471c1081ca34b',schemaUnchanged=33,coverage=coverage),indent=2)+'\n',encoding='utf-8')
for p in E.glob('*.py'):ast.parse(p.read_text(encoding='utf-8'))
print(json.dumps(dict(source=source,assets=len(assets),fullPassed=818,finalAffectedPassed=48,result='PASS')))
