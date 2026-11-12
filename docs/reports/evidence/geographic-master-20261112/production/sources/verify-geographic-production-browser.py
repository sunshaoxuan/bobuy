"""Use a fresh normal UI login; never print or persist authentication material."""
import importlib.util,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('client',Path(__file__).with_name('geographic-release-client.py'))
client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
script=(root/'scripts/verify-geographic-ui.mjs').read_text(encoding='utf-8')
script=script.replace("const out=path.join(root,'docs/reports/evidence/geographic-master-20261112');","const out=path.join(root,'docs/reports/evidence/geographic-master-20261112/production/browser');")
script=script.replace(" localStorage.setItem('bobbuy_test_role','AGENT');\n",'')
script=script.replace('http://127.0.0.1:14173','https://bobuy.cc')
script=script.replace('const consoleErrors=[],requests=[],failed=[];','const consoleErrors=[],requests=[],failed=[],telemetryAborted=[];')
script=script.replace("page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText}));","page.on('requestfailed',r=>{const item={url:r.url(),error:r.failure()?.errorText};const u=new URL(r.url());if(u.origin==='https://bobuy.cc'&&u.pathname==='/cdn-cgi/rum'&&item.error==='net::ERR_ABORTED')telemetryAborted.push(item);else failed.push(item);});")
script=script.replace('consoleErrors,failed,requests};','consoleErrors,failed,requests,telemetryAborted};')
script=script.replace('consoleErrors,failed,requests,geometry};','consoleErrors,failed,requests,geometry,telemetryAborted};')
script=script.replace("const browser=await chromium.launch", "let secretInput='';for await(const chunk of process.stdin)secretInput+=chunk;const credentials=JSON.parse(secretInput);secretInput='';const redact=text=>[credentials.username,credentials.password].filter(Boolean).reduce((s,value)=>s.split(value).join('[redacted]'),String(text));\nconst browser=await chromium.launch")
needle=" await page.goto('https://bobuy.cc/admin/basic-data/geographic-areas');"
assert script.count(needle)==1
login=""" await page.goto('https://bobuy.cc/admin');
 await page.locator('input[autocomplete="username"]').fill(credentials.username);
 await page.locator('input[autocomplete="current-password"]').fill(credentials.password);
 await page.locator('button[type="submit"]').click();
 await page.locator('.merchant-sidebar').waitFor();
 await page.waitForLoadState('networkidle');
 credentials.username='';credentials.password='';
 await page.getByRole('link',{name:'国家/地区档案',exact:true}).click();"""
script=script.replace(needle,login)
script=script.replace('Local built candidate, real API, isolated H2 reference dataset; local synthetic merchant role','Production HTTPS, normal existing merchant UI login; public geographic reference data, no business writes')
script=script.replace("path.join(out,'failure.png')","path.join(root,'.release-runtime/production-failure.png')")
script=script.replace('error:String(error)','error:redact(error)')
script=script.replace("finally{await writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));await browser.close();}","finally{if(await page.locator('.merchant-header-logout').count()){try{await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/logout'&&r.status()===200),page.locator('.merchant-header-logout').click()]);result.temporarySessionLoggedOut=true;}catch{result.temporarySessionLoggedOut=false;}}await writeFile(path.join(out,'browser.json'),JSON.stringify(result,null,2));await browser.close();}")
target=root/'.release-runtime/verify-production.mjs';target.write_text(script,encoding='utf-8',newline='\n')
secret=json.loads(client.remote("import json\nfrom pathlib import Path\nd=json.loads(Path('/etc/bobuy-admin.json').read_text());print(json.dumps({'username':d['username'],'password':d['password']}))"))
assert isinstance(secret.get('username'),str) and isinstance(secret.get('password'),str)
value=subprocess.run(['node',str(target)],cwd=root,input=json.dumps(secret).encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=300)
diagnostic=value.stderr.decode(errors='replace')
for item in secret.values():diagnostic=diagnostic.replace(item,'[redacted]')
secret.clear()
if value.returncode:raise RuntimeError('Production browser verification failed: '+diagnostic[-1800:])
print('Production browser states completed; authentication material not persisted.')
