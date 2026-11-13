"""Read-only inventory and own-session denial evidence; does not delete files."""
from pathlib import Path
import json,hashlib,subprocess,collections
root=Path(__file__).resolve().parents[5];out=Path(__file__).resolve().parent
assert root.name=='daily-product-offer-tags-20261112' and (root/'.git').is_file()
session=Path('C:/Users/X02851/.codex/sessions/2026/11/12/rollout-2026-11-12T18-26-39-01a1cf14-a3b6-7071-a101-f5f28498198e.jsonl')
denials=[];contexts=collections.Counter();plan_mentions=[]
for line in session.open(encoding='utf-8'):
 try:d=json.loads(line)
 except json.JSONDecodeError:continue
 p=d.get('payload',{});t=d.get('timestamp')
 if d.get('type')=='turn_context':contexts[str(p.get('approval_policy'))]+=1
 if p.get('type') in ('function_call_output','custom_tool_call_output'):
  text=str(p.get('output',''))
  if 'blocked by policy' in text and 'Remove-Item' in text:
   denials.append({'at':t,'callId':p.get('call_id'),'phase':'CreateProcess rejected before PowerShell launch','reason':'blocked by policy','command':'Remove-Item','errorExcerpt':text[:1200]})
 if p.get('type') in ('function_call','custom_tool_call') and '.task-tmp/plan63' in str(p):plan_mentions.append({'at':t,'tool':p.get('name'),'excerpt':str(p.get('arguments',p.get('input','')))[:400]})
roots=['.task-tmp','backend/target','bobbuy-common/target','bobbuy-core/target','bobbuy-ai/target','bobbuy-im/target','bobbuy-auth/target','bobbuy-gateway/target','frontend/dist','scripts/__pycache__','docs/reports/evidence/daily-product-offer-tags-20261112/__pycache__','docs/reports/evidence/daily-product-offer-tags-20261112/erp-price-documents/__pycache__']
extra=['docs/reports/evidence/daily-product-offer-tags-20261112/'+n for n in ['inspect-server.py','probe-models.py','public-http-probe.txt']]
tracked=set(subprocess.check_output(['git','ls-files','-z'],cwd=root).decode('utf-8').strip('\0').split('\0'))
files=[];dirs=[]
for rel in roots+extra:
 p=root/rel
 if not p.exists():continue
 if p.is_symlink():raise RuntimeError('Refusing linked cleanup root: '+rel)
 entries=sorted(p.rglob('*')) if p.is_dir() else [p]
 if p.is_dir():dirs.append(str(p))
 for f in entries:
  if f.is_symlink():raise RuntimeError('Refusing linked entry: '+str(f))
  if f.is_dir():dirs.append(str(f));continue
  local=f.relative_to(root).as_posix();assert local not in tracked,'Tracked cleanup target: '+local
  resolved=f.resolve();assert resolved.is_relative_to(root.resolve())
  files.append({'path':str(resolved),'relative':local,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
preserve=[]
prefix='docs/reports/evidence/daily-product-offer-tags-20261112/'
for rel in sorted(tracked):
 if rel.startswith(prefix) or rel in ['docs/reports/DAILY-PRODUCT-OFFER-TAGS-20261112.md','docs/PRODUCT-PRICE-ADJUSTMENTS.md','scripts/sync-product-offer-markers.py','scripts/sync-product-offer-markers.sql','backend/src/main/resources/db/migration/V35__price_adjustment_documents.sql','frontend/src/components/ProductMarkerBadges.tsx','frontend/src/pages/PublicProductCatalog.tsx','frontend/src/product-markers.css']:
  p=root/rel
  if p.is_file():preserve.append({'path':str(p.resolve()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
plan={'root':str(root.resolve()),'authorization':'2026-11-13 user explicitly requested investigation and removal of this task temporary files, preserving formal deliverables and evidence','roots':[str((root/r).resolve()) for r in roots+extra if (root/r).exists()],'files':files,'directories':sorted(set(dirs),key=lambda x:len(Path(x).parts),reverse=True),'preserve':preserve,'doNotTouch':['frontend/node_modules junction','other worktrees','tracked project files','all production files and backups']}
(out/'cleanup-plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
findings={'denials':denials,'turnApprovalPolicies':dict(contexts),'localRuleCheck':'codex execpolicy check with the user default.rules returned matchedRules=[]; no user rule matched the deletion command','confirmed':'Tool returned CreateProcess Rejected before command execution, so no Windows ACL/OneDrive deletion error was produced','notEstablished':'Generic rejection contains no per-command matching rule or model-review rationale; the exact internal heuristic cannot be proved from this output alone','plan63Mentions':plan_mentions[:5]}
(out/'policy-findings.json').write_text(json.dumps(findings,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'files':len(files),'directories':len(plan['directories']),'bytes':sum(f['bytes'] for f in files),'protectedFiles':len(preserve),'denials':len(denials),'turnApprovalPolicies':dict(contexts),'plan63Mentions':plan_mentions[:2]},ensure_ascii=False))
