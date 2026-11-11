from pathlib import Path
import subprocess,json,hashlib,datetime
root=Path(__file__).resolve().parents[1];out=root/'docs/reports/evidence/product-engagement'
def command(args):return subprocess.check_output(args,cwd=root).decode().strip()
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
backend=json.loads(command(['docker','inspect','bobuy-local-backend-1']))[0]
assert backend['Config']['Labels']['com.docker.compose.project']=='bobuy-local'
assert any('currentSchema=engagement_' in arg for arg in backend['Args'])
actual=command(['docker','exec','bobuy-local-backend-1','sha256sum','/app/app.jar']).split()[0]
assert actual==sha(root/'backend/target/bobbuy-backend-0.1.0.jar')
paths=set(command(['git','diff','HEAD','--name-only']).splitlines())|set(command(['git','ls-files','--others','--exclude-standard']).splitlines())
sources={path:sha(root/path) for path in sorted(paths) if (path.startswith(('backend/src/','frontend/src/','scripts/verify-product-engagement','scripts/bind-product-engagement')) or path in ['frontend/index.html','frontend/public/favicon.svg']) and (root/path).is_file()}
browser=json.loads((out/'browser.json').read_text(encoding='utf-8'));assert browser['checks']['loadedAssetHashes']=='PASS'
images={name:json.loads(command(['docker','image','inspect',name]))[0]['Id'] for name in ['bobuy/local-backend:current','bobuy/local-web:current']}
record={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseCommit':command(['git','rev-parse','HEAD']),'sourceFiles':sources,'sourceFingerprint':hashlib.sha256(json.dumps(sources,sort_keys=True).encode()).hexdigest(),'actualRunningJarSha256':actual,'actualJavaVersion':command(['docker','exec','bobuy-local-backend-1','java','--version']),'runtimeBaseImage':backend['Config']['Image'],'candidateImages':images,'loadedBrowserAssets':browser['assets'],'frontendUnitTests':{key:value for key,value in json.loads((out/'frontend-tests.json').read_text(encoding='utf-8')).items() if key in ['numTotalTests','numPassedTests','numFailedTests','success']}}
(out/'candidate-binding.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
print('CANDIDATE_BINDING_PASS',record['sourceFingerprint'],actual)
