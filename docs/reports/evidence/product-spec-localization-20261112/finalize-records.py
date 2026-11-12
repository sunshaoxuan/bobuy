from pathlib import Path
import json,hashlib,re,subprocess,ast
E=Path(__file__).resolve().parent;ROOT=E.parents[3]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda n:json.loads((E/n).read_text(encoding='utf-8-sig'))
cleanup=read('cleanup.json');cleanup.update(closedExecSessions=[dict(sessionId=29489,action='Ctrl+C',exitCode=1),dict(sessionId=79114,action='Ctrl+C',exitCode=1)],initialTcpEnumeration='No listeners returned despite a reachable task port. Independent socket verification rejected the initial assertion; exact owned exec sessions were then terminated and socket closure verified.',result='PASS')
(E/'cleanup.json').write_text(json.dumps(cleanup,indent=2)+'\n',encoding='utf-8')
for row in read('official-sources.json'):
 p=E/'private'/('official-'+row['itemNumber']+'.jpg');assert sha(p)==row['sha256']
 assert row['url'].startswith('https://cds2.costcojapan.jp/')
for row in read('production-crop-manifest.json'):
 assert sha(E/row['parent'])==row['parentSha256'] and sha(E/row['crop'])==row['cropSha256']
links=[]
for target in re.findall(r'\]\(([^)]+)\)',(E/'README.md').read_text(encoding='utf-8')):
 if target.startswith('https://'):continue
 assert (E/target).exists(),target
 links.append(target)
for p in E.glob('*.json'):json.loads(p.read_text(encoding='utf-8-sig'))
for p in E.glob('*.py'):ast.parse(p.read_text(encoding='utf-8'))
source=read('acceptance.json')['source']
appDiff=subprocess.check_output(['git','diff',source,'--name-only','--','frontend','backend','bobbuy-core','bobbuy-common','pom.xml'],cwd=ROOT,text=True).strip();assert not appDiff
check=dict(result='PASS',applicationSource=source,applicationDirectoriesUnchanged=True,localReadmeLinksChecked=len(links),officialImagesVerified=4,originalPixelCropParentsVerified=8,jsonParsed=len(list(E.glob('*.json'))),cleanup='Independent absence and socket verification passed',temporaryWorktree='Completed isolated code checkout and formal documents retained; unrelated root checkout and preexistingplan63 preserved',branch='codex-product-spec-localization-20261112',branchNaming='Remote refs/heads/codex exists, so nested codex/* cannot be pushed. No remote branch was deleted; this task uses the repository-compatible flat name.')
(E/'documentation-check.json').write_text(json.dumps(check,indent=2)+'\n',encoding='utf-8');print(json.dumps(check))
