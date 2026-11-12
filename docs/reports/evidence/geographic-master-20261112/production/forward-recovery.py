"""Bounded, forward-only recovery of the already-applied V34 release.

No database restore, data rewrite, container-memory change or image build occurs.
The verified legacy publisher supplies existing state, health and ingress guards.
"""
from pathlib import Path
import argparse,fcntl,hashlib,importlib.util,json,os,subprocess,time

ROOT=Path('/opt/bobuy');STAGE=ROOT/'releases/20261112.geographic_master.1'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def mark(phase,**values):
    result=dict(phase=phase,at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),databaseRestoreForbidden=True,**values)
    tmp=STAGE/'recovery-status.tmp';tmp.write_text(json.dumps(result,indent=2));tmp.replace(STAGE/'recovery-status.json')
def main():
    p=argparse.ArgumentParser();p.add_argument('--apply-forward-recovery',action='store_true');args=p.parse_args()
    assert args.apply_forward_recovery and os.geteuid()==0 and not ROOT.is_symlink() and not STAGE.is_symlink()
    os.umask(0o077);binding=read(STAGE/'recovery-binding.json')
    assert sha(Path(__file__))==binding['recoverySha256'] and sha(STAGE/'bounded-fingerprint.py')==binding['boundedSha256']
    assert sha(STAGE/'artifact.json')==binding['artifactSha256']
    a=read(STAGE/'artifact.json');assert sha(STAGE/'release_operator.py')==a['operatorSha256']
    m=load('accepted_operator',STAGE/'release_operator.py');bounded=load('bounded',STAGE/'bounded-fingerprint.py');h=m.helpers(a)
    with (ROOT/'releases/engagement-global.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        initial=read(STAGE/'status.json');assert initial['phase']=='FORWARD_RECOVERY_REQUIRED' and initial['databaseRestoreForbidden'] is True
        assert not (STAGE/'recovery-status.json').exists(),'Inspect an existing recovery before retrying'
        assert m.sql('select version from flyway_schema_history where success order by installed_rank desc limit 1')=='34'
        before=read(STAGE/'runtime.before.json');baseline=read(STAGE/'content.before.json')
        for n in m.WRITERS:assert m.state(n)['health'] not in ('running','healthy'),'Writers must remain frozen before audit'
        assert (ROOT/'compose.production.yml').read_text()==(STAGE/'compose.after.yml').read_text()
        original=(STAGE/'nginx.before.conf').read_text();nginx=ROOT/'infra/nginx/bobuy.conf'
        assert nginx.read_text()==h.maintenance_config(original)
        pg=json.loads(m.run('docker','inspect','bobuy-postgres'))[0]
        events=Path('/sys/fs/cgroup/system.slice/docker-'+pg['Id']+'.scope/memory.events')
        def oom_count():
            return int(dict(line.split() for line in events.read_text().splitlines())['oom_kill'])
        oom_before=oom_count()
        command=['docker','exec','-i','-e','PGOPTIONS=-c work_mem=1024','bobuy-postgres','sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1']
        def audit():
            result={}
            for table,item in baseline.items():
                columns=','.join(m.identifier(c) for c in item['columns'])
                query='select row_to_json(t)::text v from (select '+columns+' from '+m.identifier(table)+') t order by v'
                result[table]={'columns':item['columns'],'fingerprint':bounded.scan(command,query)}
            assert result==baseline,'Existing business rows differ; preserve and investigate'
            return result
        start=time.monotonic();mark('FORWARD_AUDIT_RUNNING',source=a['source'])
        try:
            first=audit();(STAGE/'recovery-content.before.json').write_text(json.dumps(first,indent=2))
            checks=read(STAGE/'migration-binding.json')['checks']
            expected={row['version']:row['candidateChecksum'] for row in checks}
            actual={version:int(crc) for version,crc in (line.split('|') for line in m.sql('select version,checksum from flyway_schema_history where success and version is not null order by installed_rank').splitlines())}
            assert actual==expected,'Migration history differs from staged inputs'
            m.run('docker','start',*['bobuy-'+n for n in m.WRITERS])
            for n in m.WRITERS:m.wait_health(n,expected=before[n]['health'])
            m.wait_health('frontend');m.media_flags()
            for image in a['images']:
                current=m.state(image['name']);assert current['image']==image['imageId'] and current['revision']==a['source']
            for n in m.WRITERS[1:]:
                current=m.state(n);assert all(current[k]==before[n][k] for k in ('id','image','tag','revision','project'))
            for n in m.PROTECTED:assert m.state(n)==before[n],'Protected container identity/config changed'
            assert json.loads(m.run('python3',str(ROOT/'scripts/protected-node-state.py')))==read(STAGE/'protected-before.json')
            m.verify_geographic_reference(a)
            final=audit();(STAGE/'recovery-content.after.json').write_text(json.dumps(final,indent=2))
            assert oom_count()==oom_before,'New PostgreSQL OOM during bounded verification'
            assert time.monotonic()-start<600,'Forward recovery window exceeded'
            mark('OPENING_WRITES_AFTER_FORWARD_RECOVERY',source=a['source'],existingTablesUnchanged=len(baseline),noAdditionalOom=True)
            nginx.write_text(original);m.run('docker','exec','bobuy-gateway','nginx','-t');m.run('docker','exec','bobuy-gateway','nginx','-s','reload')
            mark('WRITES_OPEN_AFTER_FORWARD_RECOVERY',source=a['source'],release=a['release'],existingTablesUnchanged=len(baseline),noAdditionalOom=True,priorOomRecorded=True,databaseVersion=34,backupSha256=sha(STAGE/'database-before.dump'),seconds=round(time.monotonic()-start,2))
        except Exception as error:
            contained=False
            try:
                nginx.write_text(h.maintenance_config(original));m.run('docker','exec','bobuy-gateway','nginx','-t');m.run('docker','exec','bobuy-gateway','nginx','-s','reload');m.run('docker','stop',*['bobuy-'+n for n in m.WRITERS]);contained=True
            except Exception:pass
            mark('FORWARD_RECOVERY_FAILED',source=a['source'],reason=str(error),writeFreezeReestablished=contained)
            raise
if __name__=='__main__':main()
