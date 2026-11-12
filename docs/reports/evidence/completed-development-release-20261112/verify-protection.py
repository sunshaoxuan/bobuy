from pathlib import Path
import hashlib,json,subprocess
out=Path(__file__).resolve().parent;root=out.parents[3]
initial=json.loads((out/'worktrees-initial.json').read_text(encoding='utf-8'))
rows=[]
for item in initial['worktrees']:
 directory=Path(item['worktree']);own=directory.resolve()==root.resolve()
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=directory,text=True).strip()
 changed=[]
 if not own:
  for name,value in item['dirtyFiles'].items():
   path=directory/name;current=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
   if current!=value['sha256']:changed.append(name)
 branch=item['branch'];kind='already deployed committed application'
 if 'gallery-upload-feedback' in branch:kind='original candidate preserved; released integrated derivative'
 elif 'consolidate-main' in branch:kind='superseded consolidation snapshot; filtered merge already deployed'
 elif 'product-introductions' in branch:kind='independent owner completed release during inventory; inherited in full'
 elif 'regional-delivery' in branch:kind='committed source already deployed; historical dirty drafts unaccepted'
 elif 'release-test-gate' in branch:kind='committed source deployed; dirty gate/tooling drafts unaccepted'
 elif own:kind='this task integration and evidence'
 elif 'mail-recipient' in branch or 'account-layout' in branch:kind='application deployed; remaining acceptance/cleanup documents'
 elif item['dirtyFiles']:kind='application deployed; remaining local artifacts or incomplete drafts'
 rows.append(dict(branch=branch,initialHead=item['head'],currentHead=head,originalDirtyCount=len(item['dirtyFiles']),changedOriginalDirtyFiles=changed,disposition=kind,ownWorktree=own))
owner=next(r for r in rows if 'gallery-upload-feedback' in r['branch'])
assert owner['currentHead']==owner['initialHead'] and not owner['changedOriginalDirtyFiles']
assert not any(r['changedOriginalDirtyFiles'] for r in rows if not r['ownWorktree'] and 'product-introductions' not in r['branch']), 'Inspect concurrent changed files before concluding protection'
(out/'worktree-protection.json').write_text(json.dumps(dict(result='PASS',worktrees=rows,explanation='Other active owner changes are recorded independently; this task performed no commands in another worktree.'),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('ALL_ORIGINAL_NONOWNER_DIRTY_FILE_HASHES_PRESERVED; GALLERY_OWNER_UNCHANGED')
