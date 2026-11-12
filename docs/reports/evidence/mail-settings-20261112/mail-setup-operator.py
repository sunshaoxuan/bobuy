"""Enable the authorized protected mail key mount on the current core image only."""
from pathlib import Path
import os,json,subprocess,time,hashlib,shutil,yaml,fcntl
ROOT=Path('/opt/bobuy'); STAGE=ROOT/'releases/20261112.mail-setup'
def run(args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=120)
 if p.returncode:raise RuntimeError('Command failed; sensitive output suppressed')
 return p.stdout.strip()
def containers():
 ids=run(['docker','ps','-aq']).splitlines()
 return {c['Name']:{'id':c['Id'],'image':c['Image'],'running':c['State']['Running']} for c in json.loads(run(['docker','inspect',*ids]))}
def health():
 c=json.loads(run(['docker','inspect','bobuy-core-service']))[0]
 return c['State'].get('Health',{}).get('Status',c['State']['Status'])
assert os.geteuid()==0;os.umask(0o077)
if STAGE.exists():
 assert STAGE.is_dir() and not STAGE.is_symlink() and not any(STAGE.iterdir()),'Existing release has state; inspect before retry'
else:STAGE.mkdir(mode=0o700)
lock=(ROOT/'releases/engagement-global.lock').open('a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
compose=['docker','compose','--env-file','/etc/bobuy.env','-f',str(ROOT/'docker-compose.yml'),'-f',str(ROOT/'compose.production.yml'),'-p','bobuy']
file=ROOT/'compose.production.yml';original=file.read_text();before=containers()
assert before['/bobuy-core-service']['image']=='sha256:98a2a9ec3a4511029b1b65bc602d4654e6155340d4fa3dff8199da63e9565bce'
assert health()=='healthy'
key=Path('/etc/bobuy-secrets/mail-keyring.properties');assert key.is_file() and key.stat().st_mode&0o777==0o600
baseline=json.loads(run(compose+['config','--format','json']))
class Reset(list):pass
yaml.SafeLoader.add_constructor('!reset',lambda loader,node:Reset(loader.construct_sequence(node)))
yaml.SafeDumper.add_representer(Reset,lambda dumper,data:dumper.represent_sequence('!reset',data))
class Override(list):pass
yaml.SafeLoader.add_constructor('!override',lambda loader,node:Override(loader.construct_sequence(node)))
yaml.SafeDumper.add_representer(Override,lambda dumper,data:dumper.represent_sequence('!override',data))
settings=yaml.safe_load(original);core=settings['services']['core-service'];env=dict(core.get('environment',{}));opts=baseline['services']['core-service']['environment'].get('JAVA_TOOL_OPTIONS','')
assert 'bobuy.mail.keyring-file' not in opts
env['JAVA_TOOL_OPTIONS']=opts+' -Dbobuy.mail.keyring-file=/run/bobuy-mail/keyring.properties -Dbobuy.mail.active-key-id=mail_20261112 -Dbobuy.mail.test-recipients=postmaster@bobuy.cc'
core['environment']=env;core['volumes']=list(core.get('volumes',[]))+[{'type':'bind','source':str(key),'target':'/run/bobuy-mail/keyring.properties','read_only':True}]
after=yaml.safe_dump(settings,sort_keys=False,allow_unicode=True)
(STAGE/'compose.before.yml').write_text(original);(STAGE/'compose.after.yml').write_text(after)
(STAGE/'containers.before.json').write_text(json.dumps(before))
# Validate a resolved candidate without replacing production configuration.
candidate=STAGE/'compose.after.yml'
check=compose.copy();check[check.index(str(file))]=str(candidate)
resolved=json.loads(run(check+['config','--format','json']))
for name,value in baseline['services'].items():
 if name!='core-service':assert value==resolved['services'][name],name
expected=__import__('copy').deepcopy(baseline['services']['core-service']);expected['environment']['JAVA_TOOL_OPTIONS']=env['JAVA_TOOL_OPTIONS'];expected['volumes']=resolved['services']['core-service']['volumes']
assert expected==resolved['services']['core-service']
added=[v for v in resolved['services']['core-service']['volumes'] if v.get('target')=='/run/bobuy-mail/keyring.properties'];assert len(added)==1 and added[0]['read_only']
assert file.read_text()==original and containers()==before
try:
 file.write_text(after);run(compose+['config','--quiet']);run(compose+['up','-d','--no-deps','--no-build','--pull','never','core-service'])
 for _ in range(90):
  if health()=='healthy':break
  time.sleep(2)
 assert health()=='healthy'
 now=containers()
 for name,value in before.items():
  if name!='/bobuy-core-service':assert now.get(name)==value,name
 assert now['/bobuy-core-service']['image']==before['/bobuy-core-service']['image']
 run(['docker','exec','bobuy-core-service','test','-r','/run/bobuy-mail/keyring.properties'])
 result={'result':'PASS','coreImageUnchanged':True,'otherContainersUnchanged':True,'keyMode':'0600','mountReadOnly':True,'approvedRecipient':'postmaster@bobuy.cc','mailDeliveryEnabled':False,'databaseMigration':False,'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 (STAGE/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
except Exception:
 file.write_text(original);run(compose+['up','-d','--no-deps','--no-build','--pull','never','core-service'])
 (STAGE/'result.json').write_text(json.dumps({'result':'ROLLED_BACK','reason':'verification failed; sensitive output suppressed'}));raise RuntimeError('Mail setup rolled back')
