from pathlib import Path
import subprocess,json,shutil
root=Path('/opt/bobuy/releases').resolve();removed=[]
active={v for v in subprocess.check_output(['docker','ps','-a','--format','{{.Image}}'],text=True).splitlines()}
for name in ['20261112.reference-display','20261112.reference-display.2','20261112.reference-display.3']:
 p=root/name;assert p.resolve().parent==root and not p.is_symlink()
 if not p.exists():continue
 assert not (p/'status.json').exists() and not (p/'database-before.dump').exists()
 for part in ['core','frontend']:
  tag='bobuy/'+part+':'+name;assert tag not in active
  result=subprocess.run(['docker','image','inspect',tag],capture_output=True)
  if result.returncode==0:
   value=json.loads(result.stdout)[0];assert value['Config']['Labels']['org.opencontainers.image.revision'] in {'31982e6113575a6dbbec8058303844d088b1c7f1','69ce0eae8b692e8d9952aebe875e44600227af51','73b6e6fb78b7fab96476c556cc71ed2d7880ab9f'}
   subprocess.run(['docker','image','rm','--no-prune',tag],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 shutil.rmtree(p);removed.append(str(p))
value=dict(result='PASS',removed=removed,preserved=['20261112.reference-display.4','20261112.reference-sort','all actual rollback images and backups','all other releases and protected services']);Path('/opt/bobuy/releases/20261112.reference-sort/cleanup.json').write_text(json.dumps(value,indent=2));print(json.dumps(value))
