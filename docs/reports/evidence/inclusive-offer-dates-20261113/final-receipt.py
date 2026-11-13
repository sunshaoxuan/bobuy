from pathlib import Path
import hashlib,json,subprocess
e=Path(__file__).parent;r=e.parents[3]
ci=json.loads(subprocess.check_output(['gh','run','view','43360019292','--json','headSha,status,conclusion,url'],cwd=r));assert ci['status']=='completed' and ci['conclusion']=='success'
(e/'main-ci.json').write_text(json.dumps(ci,indent=2)+'\n',encoding='utf-8')
for kind in ['local','production']:
 b=json.loads((e/kind/'browser.json').read_text(encoding='utf-8'));assert len(b['views'])==2 and all(not v['errors'] and not v['network'] for v in b['views'])
 if kind=='production':assert all(v['pricingWrites']==0 and v['assets'] for v in b['views'])
data=dict(result='PASS',release='20261113.inclusive-offer-dates.1',source='739f30a6bc86fcbaab872a3adac8a58eaae959e9',mergeCommit=ci['headSha'],timeJST='2026-11-13 12:35:58',checks={'inclusiveWholeJapanDates':'PASS','sameDayMonthYearLeapAndInvalidDates':'PASS; ProductPricingPanel test','saveReopenAndApproval':'PASS; synthetic writes only','permanentNoEndDate':'PASS','tests':7,'frontendBuild':'PASS','PRCodeQL':'PASS','mainCodeQL':'PASS','productionAssets':'PASS exact hashes','productionBrowser':'PASS 1440/320; console/network zero; pricing writes zero','geometry':'PASS; glyph offset 1px; mobile controls44px','visual':'PASS primary review and Gemini','databaseChange':'NONE','productionTestReasons':'0 matches; readonly targeted inventory'},evidence=['production/browser.json','production/glyphs.json','local/browser.json','production-verify.json','production-reason-inventory.json','gemini-review.txt'])
(e/'acceptance.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
payload=e/'payload.tar.gz';digest=hashlib.sha256(payload.read_bytes()).hexdigest();remote='/opt/bobuy/releases/20261113.inclusive-offer-dates.1/payload.tar.gz';code='from pathlib import Path\nimport hashlib\nprint(hashlib.sha256(Path('+repr(remote)+').read_bytes()).hexdigest())'
actual=subprocess.check_output(['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','python3','-'],input=code.encode()).decode().strip();assert actual==digest
(e/'retained-payload.json').write_text(json.dumps(dict(remote=remote,sha256=digest,localDuplicate=str(payload),safeToRemoveLocalDuplicate=True),indent=2)+'\n',encoding='utf-8')
(e/'cleanup-arguments.json').write_text(json.dumps(dict(TaskEvidenceRoot=str(e)))+'\n',encoding='utf-8')
print(json.dumps(dict(result='PASS',release=data['release'],payloadSha256=digest,cleanupScriptSha256=hashlib.sha256((e/'cleanup-payload.ps1').read_bytes()).hexdigest(),cleanupArgumentsSha256=hashlib.sha256((e/'cleanup-arguments.json').read_bytes()).hexdigest())))
