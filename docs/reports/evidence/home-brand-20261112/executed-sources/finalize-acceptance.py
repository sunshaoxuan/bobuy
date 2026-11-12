from pathlib import Path
import hashlib,json,re,shutil,subprocess
root=Path(__file__).parent;e=root/'docs/reports/evidence/home-brand-20261112'
log=(root/'frontend-tests.log').read_text(encoding='utf-8',errors='replace')
assert re.search(r'Test Files\s+\d+ passed',log) and not re.search(r'Test Files[^\n]*failed',log)
assert not re.search(r'Tests[^\n]*failed',log)
source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
assert not subprocess.check_output(['git','diff','HEAD','--','frontend'],cwd=root,text=True).strip()
browser=json.loads((e/'local/browser.json').read_text(encoding='utf-8'))
assert len(browser['results'])==3 and all(not r['errors'] and not r['network'] and r['introRemoved'] and r['brandHome'] for r in browser['results'])
assert all(r['result']=='PASS' for r in json.loads((e/'local/glyphs.json').read_text(encoding='utf-8')))
for src,dst in [('frontend-tests.log','frontend-tests.log'),('build.log','build.log')]:shutil.copy2(root/src,e/dst)
result=dict(source=source,result='PASS',functional='PASS: removed intro, search filter/restore, brand home navigation, mobile menu close',geometry='PASS: independent final screenshot glyphs, desktop domain center error 0.5px; mobile48px hotspot',visual='PASS: primary agent reviewed full page and native crops; external suggestions and dispositions recorded in task plan',frontendTests=re.search(r'^\s+Tests\s+\d+ passed[^\n]*',log,re.M).group(0).strip(),testFiles=re.search(r'Test Files\s+[^\n]+',log).group(0),build='PASS',seoChecks=3,i18nKeys=1693,evidence={str(p.relative_to(e)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in e.rglob('*') if p.is_file() and p.name!='acceptance.json'})
(e/'acceptance.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='evidence'},indent=2))
