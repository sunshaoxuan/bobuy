"""Task-owned transport. Credentials remain in the existing SSH key file."""
import base64,hashlib,importlib.util,json,shutil,subprocess,sys,tarfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'docs/reports/evidence/geographic-master-20261112/production'
E.mkdir(parents=True,exist_ok=True)
SSH=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
SCP=['scp','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem']
RELEASE='20261112.geographic_master.1'
REMOTE='/opt/bobuy/releases/'+RELEASE
def remote(code):
    p=subprocess.run(SSH+['python3','-'],input=code.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=600)
    if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1800:])
    return p.stdout.decode()
def main():
    action=sys.argv[1]
    if action=='inspect':
        code='''import json,subprocess,hashlib
from pathlib import Path
def run(*args):return subprocess.check_output(args,text=True).strip()
names=['bobuy-core-service','bobuy-frontend','bobuy-auth-service','bobuy-ai-service','bobuy-im-service','bobuy-gateway-service','bobuy-gateway','bobuy-postgres']
states={}
for name in names:
 d=json.loads(run('docker','inspect',name))[0];states[name]={'id':d['Id'],'image':d['Image'],'tag':d['Config']['Image'],'revision':d['Config']['Labels'].get('org.opencontainers.image.revision'),'health':d['State'].get('Health',{}).get('Status',d['State']['Status'])}
history=run('docker','exec','bobuy-postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -c "select version,script,checksum,success from flyway_schema_history order by installed_rank"')
files={}
for name in ['release_operator.py','publisher_helpers.py']:
 p=Path('/opt/bobuy/releases/20261111.1')/name;files[name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'content':p.read_text()}
print(json.dumps({'states':states,'history':history,'libraries':files}))
'''
        value=json.loads(remote(code))
        for name,item in value.pop('libraries').items():
            (E/('accepted-'+name)).write_text(item['content'],encoding='utf-8')
            value.setdefault('librarySha256',{})[name]=item['sha256']
        (E/'runtime-before.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(value))
    elif action=='libraries':
        value=json.loads(remote("import json,base64,hashlib\nfrom pathlib import Path\np=Path('/opt/bobuy/releases/20261111.1')\nprint(json.dumps({n:{'sha256':hashlib.sha256((p/n).read_bytes()).hexdigest(),'base64':base64.b64encode((p/n).read_bytes()).decode()} for n in ['release_operator.py','publisher_helpers.py']}))"))
        for name,item in value.items():
            data=base64.b64decode(item['base64']);assert hashlib.sha256(data).hexdigest()==item['sha256']
            (E/('accepted-'+name)).write_bytes(data)
        print(json.dumps({name:item['sha256'] for name,item in value.items()}))
    elif action=='stage':
        source=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        assert source=='b3caeec8c0b04a3144339f8e84ab334b53f81aa1'
        ci=json.loads(subprocess.check_output(['gh','pr','view','71','--json','headRefOid,statusCheckRollup,url'],cwd=ROOT,text=True))
        assert ci['headRefOid']==source and all(c.get('conclusion')=='SUCCESS' for c in ci['statusCheckRollup'])
        (E/'ci.json').write_text(json.dumps(ci,indent=2)+'\n',encoding='utf-8')
        runtime=json.loads((E/'runtime-before.json').read_text(encoding='utf-8'))
        payload=ROOT/'.release-runtime/payload';payload.mkdir(parents=True,exist_ok=True)
        shutil.copy2(ROOT/'bobbuy-core/target/bobbuy-core-0.1.0.jar',payload/'app.jar')
        shutil.copytree(ROOT/'frontend/dist',payload/'dist',dirs_exist_ok=True)
        shutil.copy2(ROOT/'frontend/nginx.conf',payload/'nginx.conf')
        shutil.copy2(E/'geographic-operator.py',payload/'release_operator.py')
        shutil.copy2(E/'accepted-publisher_helpers.py',payload/'publisher_helpers.py')
        spec=importlib.util.spec_from_file_location('generator',ROOT/'scripts/generate-geographic-master.py');generator=importlib.util.module_from_spec(spec);spec.loader.exec_module(generator)
        (payload/'geographic-reference.json').write_text(json.dumps(generator.rows(),ensure_ascii=False),encoding='utf-8',newline='\n')
        (payload/'Dockerfile.core').write_text('FROM '+runtime['states']['bobuy-core-service']['tag']+'\nCOPY app.jar /app/app.jar\n',encoding='utf-8',newline='\n')
        (payload/'Dockerfile.frontend').write_text('FROM nginx@'+runtime['states']['bobuy-gateway']['image']+'\nCOPY dist /usr/share/nginx/html\nCOPY nginx.conf /etc/nginx/conf.d/default.conf\n',encoding='utf-8',newline='\n')
        verifier=(ROOT/'docs/reports/evidence/product-introductions-20261112/verify-runtime-inputs.py').read_text(encoding='utf-8').replace('20261112.product-introductions.2',RELEASE)
        old="ok=not added and all(v['candidateChecksum']==v['databaseChecksum'] for v in checks)"
        assert old in verifier
        verifier=verifier.replace(old,"ok=added==['V34__geographic_master.sql'] and all(v['candidateChecksum']==v['databaseChecksum'] for v in checks if v['version']!='34')")
        (payload/'verify-runtime-inputs.py').write_text(verifier,encoding='utf-8',newline='\n')
        gates=dict(source=source,frontendTests=814,frontendAffectedTests=6,frontendIntegrationTests=43,backendTests=674,backendExecuted=650,backendSkipped=24,failures=0,configuredJacoco='PASS',codeql='success',codeqlUrl=ci['url'],candidateBrowser='PASS: geographic12 states,94 actual glyph controls; live acceptance pending',operatorTests=5,releaseGuardTests=9)
        (payload/'accepted-gates.json').write_text(json.dumps(gates,indent=2),encoding='utf-8',newline='\n')
        sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
        manifest={'source':source,'release':RELEASE,'files':{p.relative_to(payload).as_posix():sha(p) for p in payload.rglob('*') if p.is_file()}}
        (payload/'payload.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8',newline='\n')
        archive=ROOT/'.release-runtime/payload.tar.gz'
        with tarfile.open(archive,'w:gz',compresslevel=1) as tar:
            for name in [*manifest['files'],'payload.json']:tar.add(payload/name,arcname=name)
        remote("from pathlib import Path\np=Path('"+REMOTE+"');assert not p.exists(),'Existing release must be reconciled';p.mkdir(mode=0o700)")
        subprocess.run(SCP+[str(archive),'root@185.184.223.41:'+REMOTE+'/payload.tar.gz'],check=True,timeout=300,stdout=subprocess.DEVNULL)
        code='''from pathlib import Path
import hashlib,json,subprocess,tarfile
stage=Path(STAGE_VALUE);sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(stage/'payload.tar.gz')==ARCHIVE_VALUE
with tarfile.open(stage/'payload.tar.gz') as tar:
 for v in tar.getmembers():assert not v.issym() and not v.islnk() and (stage/v.name).resolve().is_relative_to(stage)
 tar.extractall(stage,filter='data')
a=json.loads((stage/'payload.json').read_text());assert a['source']==SOURCE_VALUE
for name,value in a['files'].items():assert sha(stage/name)==value
images=[]
for service,part in [('core-service','core'),('frontend','frontend')]:
 tag='bobuy/'+part+':'+a['release']
 with (stage/(part+'-build.log')).open('w') as log:subprocess.run(['docker','build','--network=none','--label','org.opencontainers.image.revision='+a['source'],'-t',tag,'-f',str(stage/('Dockerfile.'+part)),str(stage)],stdout=log,stderr=subprocess.STDOUT,check=True,timeout=180)
 d=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
 images.append(dict(name=service,tag=tag,imageId=d['Id'],rootfsDiffIds=d['RootFS']['Layers']))
subprocess.run(['docker','save','-o',str(stage/'images.tar'),*[v['tag'] for v in images]],check=True,timeout=180)
subprocess.run(['python3',str(stage/'verify-runtime-inputs.py')],check=True,stdout=subprocess.DEVNULL)
binding=json.loads((stage/'migration-binding.json').read_text());assert binding['result']=='PASS'
artifact=dict(source=a['source'],release=a['release'],images=images,archiveSha256=sha(stage/'images.tar'),archiveBytes=(stage/'images.tar').stat().st_size,operatorSha256=sha(stage/'release_operator.py'),helperSha256=sha(stage/'publisher_helpers.py'),gatesSha256=sha(stage/'accepted-gates.json'),referenceSha256=sha(stage/'geographic-reference.json'),coreJarSha256=sha(stage/'app.jar'),migrationSha256={'34':MIGRATION_VALUE},frontend={n.removeprefix('dist/'):v for n,v in a['files'].items() if n.startswith('dist/')})
(stage/'artifact.json').write_text(json.dumps(artifact,indent=2));print(json.dumps(artifact))
'''
        code=code.replace('STAGE_VALUE',repr(REMOTE)).replace('ARCHIVE_VALUE',repr(sha(archive))).replace('SOURCE_VALUE',repr(source)).replace('MIGRATION_VALUE',repr(sha(ROOT/'backend/src/main/resources/db/migration/V34__geographic_master.sql')))
        value=json.loads(remote(code));(E/'artifact.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(dict(source=source,images=value['images'],archiveBytes=value['archiveBytes'])))
    elif action in ('prepare','activate'):
        p=subprocess.run(SSH+['python3 '+REMOTE+'/release_operator.py '+action+' --apply-production-window'],capture_output=True,timeout=600)
        value=json.loads(remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())"))
        (E/('production-'+action+'.json')).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(value))
        if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-2000:])
    elif action=='recover':
        current=json.loads(remote("from pathlib import Path\nimport json,hashlib\np=Path('"+REMOTE+"');print(json.dumps({'artifact':json.loads((p/'artifact.json').read_text()),'sha256':hashlib.sha256((p/'artifact.json').read_bytes()).hexdigest(),'priorRecovery':(p/'recovery-status.json').exists()}))"))
        assert current['artifact']==json.loads((E/'artifact.json').read_text(encoding='utf-8')),'Staged artifact semantics changed'
        assert not current['priorRecovery'],'Reconcile an existing forward recovery instead of repeating'
        for name in ['forward-recovery.py','bounded-fingerprint.py']:
            subprocess.run(SCP+[str(E/name),'root@185.184.223.41:'+REMOTE+'/'+name],check=True,timeout=30,stdout=subprocess.DEVNULL)
        value={'recoverySha256':hashlib.sha256((E/'forward-recovery.py').read_bytes()).hexdigest(),'boundedSha256':hashlib.sha256((E/'bounded-fingerprint.py').read_bytes()).hexdigest(),'artifactSha256':current['sha256']}
        (E/'recovery-binding.json').write_text(json.dumps(value,indent=2),encoding='utf-8')
        subprocess.run(SCP+[str(E/'recovery-binding.json'),'root@185.184.223.41:'+REMOTE+'/recovery-binding.json'],check=True,timeout=30,stdout=subprocess.DEVNULL)
        p=subprocess.run(SSH+['python3 '+REMOTE+'/forward-recovery.py --apply-forward-recovery'],capture_output=True,timeout=600)
        value=json.loads(remote("from pathlib import Path\nimport json\np=Path('"+REMOTE+"/recovery-status.json');print(p.read_text() if p.exists() else json.dumps({'phase':'PRECONDITION_REJECTED'}))"))
        (E/'recovery-status.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8');print(json.dumps(value))
        if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1800:])
    elif action=='diagnose':
        code='''import json,subprocess
from pathlib import Path
def run(*args):
 p=subprocess.run(args,capture_output=True,text=True);return p.returncode,p.stdout,p.stderr
states={}
for n in ['core-service','ai-service','im-service','auth-service','gateway-service','frontend','postgres']:
 rc,out,err=run('docker','inspect','bobuy-'+n)
 d=json.loads(out)[0];states[n]={'running':d['State']['Running'],'oom':d['State']['OOMKilled'],'restarts':d['RestartCount'],'health':d['State'].get('Health',{}).get('Status',d['State']['Status']),'image':d['Image']}
rc,mem,_=run('free','-m')
rc,events,_=run('sh','-c','dmesg -T | tail -160 | grep -i -E "out of memory|oom|killed process"')
rc,log,_=run('docker','logs','--tail','100','bobuy-postgres')
selected=[line for line in log.splitlines() if any(word in line.lower() for word in ['terminat','signal','out of memory','fatal','ready to accept','recovery'])]
print(json.dumps({'states':states,'memory':mem,'oomEvents':events,'postgresLog':selected[-18:]}))
'''
        value=json.loads(remote(code));(E/'diagnosis.json').write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8');print(json.dumps(value))
    elif action=='status':
        print(remote("from pathlib import Path\nprint(Path('"+REMOTE+"/status.json').read_text())").strip())
    elif action=='receipts':
        names=['migration-binding.json','runtime.before.json','protected-before.json','content.before.json','content.after.json','database.before.json','geographic-acceptance.json','status.json','status.initial-failure.json','recovery-status.json','recovery-content.before.json','recovery-content.after.json']
        values=json.loads(remote("from pathlib import Path\nimport json\np=Path('"+REMOTE+"');names="+repr(names)+"\nprint(json.dumps({n:json.loads((p/n).read_text()) if (p/n).exists() else None for n in names}))"))
        for name,value in values.items():
            if value is not None:(E/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
        (E/'missing-original-receipts.json').write_text(json.dumps([n for n,v in values.items() if v is None],indent=2)+'\n',encoding='utf-8')
        print('Retrieved scoped production receipts')
    else:raise ValueError(action)
if __name__=='__main__':main()
