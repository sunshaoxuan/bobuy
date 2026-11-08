"""Candidate-only V27 application update adapter. No production action by default.

Reuse reviewed r1 config/schema helpers and r2 bounded readiness/recovery/backup.
Never call their historical prepare/activate/resume or database restore paths.
This new input/lifecycle adapter requires its own independent operator review.
"""
from pathlib import Path, PurePosixPath
from types import SimpleNamespace
from datetime import datetime
import argparse, hashlib, importlib.util, json, os, re, subprocess, time

ROOT = Path('/opt/bobuy')
SOURCE = 'UNBOUND_PENDING_ACCEPTED_COMMIT_AND_CI'
CORE_SOURCE = '7828194be02d1e1396f304dfd24124a06b35fc32'
BASE = 'fc57d58e773f730158cc827a1c4d221ebce1a594'
RELEASE = '20261108.2'
STAGE_TEXT = '/opt/bobuy/releases/' + RELEASE
STAGE = Path(STAGE_TEXT)
REVISION = 'v27-application-update-mobile-r1'
ARTIFACT_SHA = 'UNBOUND_PENDING_NEW_ARTIFACT'
MAINTENANCE_HTML_SHA = '047f2bab3129118ab72085c64979c6e5d0380cfbec53db73fd4eeede79efdfe9'
R2_PATH = ROOT / 'releases/20261107.1/production_v27_resume.py'  # Reviewed library, not target.
R2_SHA = '78f0ac580ed0d2647954b7fc56a262afa6795d0786d86d4559383fc815f39e13'
UPDATES = ('core-service', 'frontend')

def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def read(path):
    return json.loads(Path(path).read_text())

def friendly_maintenance_config(config, freeze_api, html):
    """Presentation only; same API write freeze and guarded recovery lifecycle."""
    if hashlib.sha256(html).hexdigest() != MAINTENANCE_HTML_SHA:
        raise RuntimeError('Bound maintenance page differs')
    page = html.decode('utf-8')
    if '$' in page:
        raise RuntimeError('Nginx variables are forbidden in the static page')
    frozen = freeze_api(config)
    root = 'location / {'
    old_message = '{"message":"Release maintenance in progress"}'
    if frozen.count(root) != 1 or frozen.count(old_message) != 1:
        raise RuntimeError('Known root route and API maintenance body required')
    # Escape once and consume these same verified bytes in the return directive.
    escaped = page.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r')
    frozen = frozen.replace(old_message, '{"errorCode":"RELEASE_MAINTENANCE","message":"好物正在更新，请稍后重试"}', 1)
    return frozen.replace(root, root + "\n        default_type text/html;\n        add_header Cache-Control no-store always;\n        return 503 '" + escaped + "';", 1)

def bound(directory, name, expected):
    if not isinstance(expected, str) or not re.fullmatch('[0-9a-f]{64}', expected):
        raise RuntimeError('Missing independent/fresh binding: ' + name)
    path = directory / name
    if path.is_symlink() or not path.is_file() or sha(path) != expected:
        raise RuntimeError('Bound input differs: ' + name)
    return read(path)

def validate_artifact(a):
    if (a.get('source'), a.get('base'), a.get('release'), a.get('stage'), a.get('schemaBefore'), a.get('schemaAfter')) != (SOURCE, BASE, RELEASE, STAGE_TEXT, 27, 27):
        raise RuntimeError('Exact new source/release and same V27 required')
    if any(a.get(key) is not False for key in ('migrationChanges','migrationExecutionAllowed','databaseRestoreAllowed')):
        raise RuntimeError('Migration/database restore is forbidden')
    if 'releaseAccepted' in a or a.get('updates') != list(UPDATES) or [i.get('name') for i in a.get('images', [])] != list(UPDATES):
        raise RuntimeError('Old acceptance field or wrong service scope')
    if a.get('coreSource') != CORE_SOURCE:
        raise RuntimeError('Explicit accepted core reuse source required')
    for image, name, source in zip(a['images'], ('core', 'frontend'), (CORE_SOURCE, SOURCE)):
        if image.get('tag') != 'bobuy/' + name + ':ci-' + source or image.get('revision') != source or not image.get('rootfsDiffIds'):
            raise RuntimeError('Immutable CI image binding required')
        for key in ('imageId', 'platformManifestDigest', 'configDigest'):
            if not re.fullmatch('sha256:[0-9a-f]{64}', image.get(key, '')):
                raise RuntimeError('Missing archive-verified OCI identity')
    return a

def verify_gates(directory, a, m, now=None):
    validate_artifact(a)
    if (m.get('source'),m.get('release'),m.get('revision'),m.get('schemaBefore'),m.get('schemaAfter')) != (SOURCE,RELEASE,REVISION,27,27):
        raise RuntimeError('Wrong update input identity')
    if m.get('operatorSha256') != sha(Path(__file__)) or m.get('artifactSha256') != ARTIFACT_SHA:
        raise RuntimeError('New operator/artifact binding differs')
    if bound(directory, 'artifact.json', ARTIFACT_SHA) != a:
        raise RuntimeError('Artifact argument differs from pinned bytes')
    bound(directory, 'ci-artifact.json', a['originalCiArtifact']['sha256'])
    for name, binding in a['checkBindings'].items():
        value = bound(directory, name + '.json', binding['sha256'])
        if (value.get('headSha'),value.get('status'),value.get('conclusion'),value.get('runId')) != (SOURCE,'completed','success',binding['runId']):
            raise RuntimeError('Exact hosted check incomplete: ' + name)
    qa = a['qaBindings']
    app = bound(directory, 'qa-application.json', qa['application']['sha256'])
    static = bound(directory, 'qa-artifact-static.json', qa['staticArtifact']['sha256'])
    if app.get('localCandidateAccepted') is not True or app.get('sourceDigest') != a['acceptedApplicationSourceDigest']:
        raise RuntimeError('Accepted application input digest differs')
    if static.get('source') != SOURCE or static.get('staticArtifactBindingAccepted') is not True or static.get('frontendArtifactAccepted') is not True:
        raise RuntimeError('Exact static artifact acceptance missing')
    runtime = bound(directory, 'qa-core-runtime.json', m.get('runtimeQaReceiptSha256'))
    if runtime.get('source') != SOURCE or runtime.get('coreSource') != CORE_SOURCE or runtime.get('completeCoreRuntimeArtifactAccepted') is not True or runtime.get('checks',{}).get('exactCoreRuntime') != 'PASS':
        raise RuntimeError('Exact-core actual runtime QA has not passed')
    if runtime.get('coreJar',{}).get('sha256') != a['coreJarSha256'] or runtime.get('archive',{}).get('sha256') != a['archiveSha256']:
        raise RuntimeError('Actual core runtime QA targets different bytes')
    operator = bound(directory, 'qa-update-operator.json', m.get('qaReceiptSha256'))
    if (operator.get('source'),operator.get('release'),operator.get('operatorSha256'),operator.get('artifactSha256'),operator.get('updateOperatorAccepted')) != (SOURCE,RELEASE,m['operatorSha256'],ARTIFACT_SHA,True):
        raise RuntimeError('Independent new adapter review missing')
    if m.get('activationWindowApproved') is not True:
        raise RuntimeError('This input is not approved for a production write window')
    baseline = bound(directory, 'update-baseline.json', m.get('baselineSha256'))
    age = (time.time() if now is None else now) - datetime.fromisoformat(baseline['at']).timestamp()
    if not 0 <= age <= 1800 or baseline.get('baseSource') != BASE or baseline.get('targetSource') != SOURCE or baseline.get('targetRelease') != RELEASE:
        raise RuntimeError('Fresh exact live metadata baseline required')
    if baseline.get('releaseProcesses') or baseline.get('futureStageExists'):
        raise RuntimeError('Baseline had concurrent or existing release state')
    return baseline

def load_reviewed():
    if sha(R2_PATH) != R2_SHA:
        raise RuntimeError('Reviewed r2 library changed')
    spec = importlib.util.spec_from_file_location('reviewed_r2_update_library', R2_PATH)
    r2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(r2)
    r1 = r2.base_operator()  # Independently hash-checks the unchanged r1 helper.
    # Explicit capability selection: historical validate/gate/prepare/activate are not imported.
    def maintenance_config(config):
        path = STAGE / 'release-maintenance.html'
        if path.is_symlink() or not path.is_file():
            raise RuntimeError('Staged bound maintenance page required')
        return friendly_maintenance_config(config, r1.maintenance_config, path.read_bytes())
    op = SimpleNamespace(ROOT=ROOT,STAGE=STAGE,BASE=BASE,UPDATES=UPDATES,PROTECTED=r1.PROTECTED,
        sha=sha,run=r1.run,state=r1.state,schema=r1.schema,tools=r1.tools,
        config_identity=r1.config_identity,owned_nginx=r1.owned_nginx,
        guarded_nginx_write=r1.guarded_nginx_write,maintenance_config=maintenance_config)
    budget = CallBudget(r2.OPEN_SECONDS)
    op.budget = budget
    # These are private, freshly imported module instances. Source bytes stay
    # pinned; only executor capabilities are replaced, never the legacy gates.
    r1.run = budget.run
    op.run = budget.run
    r2.subprocess = SimpleNamespace(run=budget.process,PIPE=subprocess.PIPE,DEVNULL=subprocess.DEVNULL)
    original_tools = op.tools
    def tools():
        module = original_tools()
        module.run = budget.run
        module.sql = budget.sql
        return module
    op.tools = tools
    original_write = op.guarded_nginx_write
    def guarded_write(path,allowed,desired,identity):
        if budget.guard is not None:
            budget.guard.check()
            if path==budget.guard.nginx and desired==budget.guard.original:
                # Both forward and recovery reopen use this shared writer.
                # Verify the same approved full DB contract before unfreezing.
                budget.guard.verify_open_schema()
                budget.guard.check()
        budget.remaining()
        original_write(path,allowed,desired,identity)
        if budget.guard is not None:
            budget.guard.written(path,desired)
    op.guarded_nginx_write = guarded_write
    return r2, op

class CallBudget:
    """One shared deadline for subprocesses and server-side read-only SQL."""
    def __init__(self,seconds):
        self.guard=None;self.bindings={};self.uncertain_mutation=False
        self.reset(seconds)
    def reset(self,seconds):
        self.deadline=time.monotonic()+seconds
    def remaining(self):
        value=self.deadline-time.monotonic()
        if value <= 0:
            raise RuntimeError('Operation deadline expired before next action')
        return value
    def process(self,args,**kwargs):
        remaining=self.remaining()
        kwargs['timeout']=min(kwargs.get('timeout',remaining),remaining)
        args=list(args)
        # Exec reaches a bound container ID, never a subsequently reassigned name.
        if args[:2]==['docker','exec']:
            index=3 if args[2]=='-i' else 2
            name=args[index].removeprefix('bobuy-')
            if name in self.bindings:
                args[index]=self.bindings[name]['id']
        try:
            value=subprocess.run(args,**kwargs)
        except subprocess.TimeoutExpired:
            if self.guard is not None and self.guard.mutating:
                self.uncertain_mutation=True
            raise RuntimeError('Scoped command deadline expired; outcome may be uncertain') from None
        self.remaining()
        return value
    def run(self,*args,input=None,pass_fds=()):
        if self.guard is not None and args[:2]==('docker','compose') and 'up' in args:
            return self.guard.compose_up(args[-1])
        mutation=self.guard is not None and args[:3]==('docker','exec','bobuy-gateway') and args[-2:]==('-s','reload')
        if mutation:
            self.guard.check();self.guard.mutating=True
        try:
            result=self.process(args,input=input,text=True,capture_output=True,pass_fds=pass_fds)
        finally:
            if mutation:self.guard.mutating=False
        if result.returncode:
            raise RuntimeError('Scoped command failed; sensitive output suppressed')
        return result.stdout.strip()
    def sql(self,query,database=None):
        if database is not None:
            raise RuntimeError('Only the existing application database may be read')
        text=query.strip()
        if text.startswith('BEGIN READ ONLY;') and text.endswith('ROLLBACK;'):
            text=text[len('BEGIN READ ONLY;'):-len('ROLLBACK;')].strip()
        if not text.lower().startswith(('select ','show ')):
            raise RuntimeError('Only read-only release queries are allowed')
        milliseconds=max(1,int(self.remaining()*1000))
        payload='BEGIN READ ONLY; SET LOCAL statement_timeout = '+str(milliseconds)+'; '+text.rstrip(';')+'; ROLLBACK;'
        return self.run('docker','exec','-i','bobuy-postgres','sh','-c',
            'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -qAt -v ON_ERROR_STOP=1',input=payload)

class OperationGuard:
    """Track owned identities and consume sealed copies of the checked Compose."""
    def __init__(self,r2,op,before,a,compose,old,candidate,compose_identity,nginx,original,frozen,nginx_identity,base,base_bytes,base_identity,baseline,tools):
        self.r2=r2;self.op=op;self.before=before;self.a=a;self.budget=op.budget
        self.baseline=baseline;self.tools=tools
        self.compose=compose;self.nginx=nginx;self.base=base
        self.base_bytes=base_bytes;self.base_identity=base_identity
        self.compose_identity=compose_identity;self.nginx_identity=nginx_identity
        self.old=old;self.candidate=candidate;self.original=original;self.frozen=frozen
        self.compose_bytes=old;self.nginx_bytes=original
        self.known={name:self.binding(before[name]) for name in UPDATES}
        self.pending=None;self.observed={};self.mutating=False
        self.budget.bindings=dict(before)
    @staticmethod
    def binding(value):
        return {key:value[key] for key in ('id','image','revision','project')}
    def observe(self):
        for name in UPDATES:
            value=self.r2.snapshot(self.op,name);self.observed[name]=value
            binding=self.binding(value)
            if binding==self.known[name]:continue
            if self.pending and self.pending['name']==name:
                expected=self.pending
                if value['id'] and value['project']=='bobuy' and value['image'] in expected['images'] and value['revision']==expected['revision']:
                    self.known[name]=binding;self.budget.bindings[name]=binding;continue
            raise RuntimeError('Unknown application runtime; preserve scene: '+name)
        self.pending=None
        for name in self.op.PROTECTED:
            if self.op.state(name)!=self.before[name]:
                raise RuntimeError('Protected runtime drift; preserve scene: '+name)
    def configs(self):
        for label,path,data,identity in [('base Compose',self.base,self.base_bytes,self.base_identity),
                ('production Compose',self.compose,self.compose_bytes,self.compose_identity),
                ('nginx',self.nginx,self.nginx_bytes,self.nginx_identity)]:
            try:self.op.owned_nginx(path,(data,),identity)
            except Exception as failure:
                raise RuntimeError('Unknown '+label+' identity/bytes; preserve scene') from failure
    def check(self):
        self.budget.remaining()
        if self.budget.uncertain_mutation:
            raise RuntimeError('Timed-out mutation remains uncertain; no automatic overwrite/reopen')
        self.configs();self.observe();self.configs();self.budget.remaining()
    def written(self,path,desired):
        if path==self.compose:self.compose_bytes=desired
        elif path==self.nginx:self.nginx_bytes=desired
    def verify_open_schema(self):
        verify_schema(self.r2,self.op,self.tools,self.baseline)
    def compose_up(self,name):
        if name not in UPDATES:raise RuntimeError('Unscoped service mutation')
        self.check()
        if self.compose_bytes==self.old and self.known[name]==self.binding(self.before[name]):
            return ''  # Original target was never changed; recovery need not restart it.
        # Linux sealed memfd snapshots close the check/use gap: Compose cannot
        # reread a changed shared path, nor can another writer alter these bytes.
        import fcntl
        descriptors=[]
        try:
            for label,data in [('base',self.base_bytes),('override',self.compose_bytes)]:
                fd=os.memfd_create('bobuy-'+label,os.MFD_CLOEXEC|os.MFD_ALLOW_SEALING);descriptors.append(fd)
                with os.fdopen(os.dup(fd),'wb') as stream:stream.write(data)
                os.lseek(fd,0,os.SEEK_SET)
                fcntl.fcntl(fd,fcntl.F_ADD_SEALS,fcntl.F_SEAL_WRITE|fcntl.F_SEAL_GROW|fcntl.F_SEAL_SHRINK|fcntl.F_SEAL_SEAL)
            self.check()
            image=next(i for i in self.a['images'] if i['name']==name)
            expected=image_binding(image) if self.compose_bytes==self.candidate else {'images':{self.before[name]['image']},'revision':self.before[name]['revision']}
            self.pending={'name':name,'images':sorted(expected['images']),'revision':expected['revision']}
            self.mutating=True
            # A plugin child can open the parent's sealed descriptors without
            # relying on the Docker CLI forwarding inherited descriptor numbers.
            descriptor_root='/proc/'+str(os.getpid())+'/fd/'
            result=self.budget.process(['docker','compose','--env-file','/etc/bobuy.env','-p','bobuy',
                '--project-directory',str(ROOT),'-f',descriptor_root+str(descriptors[0]),'-f',descriptor_root+str(descriptors[1]),
                'up','-d','--no-deps','--no-build','--pull','never',name],text=True,capture_output=True,pass_fds=tuple(descriptors))
            self.observe()
            if result.returncode:raise RuntimeError('Scoped Compose failed; observed identity retained')
            return result.stdout.strip()
        finally:
            self.mutating=False
            for fd in descriptors:os.close(fd)

def image_ids(image):
    return {image[key] for key in ('imageId','platformManifestDigest','configDigest')}

def image_binding(image):
    """One component's already validated immutable manifest identity."""
    return {'images':image_ids(image),'revision':image['revision']}

def verify_schema(r2,op,t,baseline):
    r2.exact_schema27(op,t)
    queries = {
        'allColumns': "SELECT table_name,column_name,column_default,is_nullable,data_type,udt_name,character_maximum_length,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name",
        'allIndexes': "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
        'allConstraints': "SELECT c.relname,x.conname,x.contype,x.convalidated,x.condeferrable,x.condeferred,pg_get_constraintdef(x.oid) AS definition FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,x.conname",
    }
    for name, query in queries.items():
        metadata=t.sql("BEGIN READ ONLY; SELECT coalesce(json_agg(x),'[]')::text FROM ("+query+") x; ROLLBACK;")
        if hashlib.sha256(metadata.encode()).hexdigest() != baseline.get('schema',{}).get(name+'Sha256'):
            raise RuntimeError('Full schema metadata differs: '+name)

def verify_images(op, a):
    for image in a['images']:
        expected=image_binding(image)
        value = json.loads(op.run('docker','image','inspect',image['tag'],'--format',
            '{"id":{{json .Id}},"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}},"layers":{{json .RootFS.Layers}}}'))
        if value['id'] not in expected['images'] or value['revision'] != expected['revision'] or value['layers'] != image['rootfsDiffIds']:
            raise RuntimeError('Loaded immutable image identity differs')

def backup_binding(r2, op, m):
    r2.backup27(op, m)  # Same fresh private V27, size/hash and pg_restore --list guard. Never restore.
    directory = Path(m['backupDirectory'])
    bound(directory,'manifest.json',m.get('backupManifestSha256'))
    content = bound(directory,'content.after-backup.json',m.get('backupContentSha256'))
    if not isinstance(content,dict) or not content:
        raise RuntimeError('Private current whole-business fingerprint binding missing')
    return content

def record(phase, **extra):
    temporary = STAGE / 'update-status.tmp'
    with temporary.open('x') as stream:
        json.dump({'phase':phase,'at':datetime.now().astimezone().isoformat(),'source':SOURCE,
                   'release':RELEASE,'schema':27,'databaseRestoreForbidden':True,**extra},stream,indent=2)
        stream.flush();os.fsync(stream.fileno())
    temporary.replace(STAGE / 'update-status.json')

def inputs(r2,op):
    a = read(STAGE/'artifact.json');m = read(STAGE/'update-input.json')
    baseline = verify_gates(STAGE,a,m)
    op.budget.bindings=dict(baseline['runtime'])
    t = op.tools();verify_schema(r2,op,t,baseline)
    before = r2.validate_baseline(op,baseline)
    if any(before[name]['image'] != a['rollbackImages'][name] for name in UPDATES):
        raise RuntimeError('Current rollback image binding changed')
    for name in UPDATES:
        if op.run('docker','image','inspect',before[name]['image'],'--format','{{.Id}}') != before[name]['image']:
            raise RuntimeError('Current application rollback unavailable')
    if (STAGE/'images.tar').stat().st_size != a['archiveBytes'] or sha(STAGE/'images.tar') != a['archiveSha256']:
        raise RuntimeError('New complete core/web archive changed')
    verify_images(op,a)
    content = backup_binding(r2,op,m)
    return a,m,baseline,t,before,content

def prepare(r2,op):
    op.budget.reset(r2.OPEN_SECONDS)
    if any((STAGE/name).exists() for name in ('update-status.json','update-context.json','compose.before.yml','compose.after.yml','nginx.before.conf')):
        raise RuntimeError('Existing preparation must be reconciled; no overwrite/repeat')
    a,m,b,t,before,content = inputs(r2,op)
    old = (ROOT/'compose.production.yml').read_bytes()
    candidate = t.rewrite_images(old.decode(),a['images'],before).encode()
    if candidate == old:
        raise RuntimeError('No-op update is invalid')
    (STAGE/'compose.before.yml').write_bytes(old)
    (STAGE/'compose.after.yml').write_bytes(candidate)
    (STAGE/'nginx.before.conf').write_bytes((ROOT/'infra/nginx/bobuy.conf').read_bytes())
    record('APPLICATION_UPDATE_PREPARED',artifactSha256=ARTIFACT_SHA,baselineSha256=m['baselineSha256'],operatorSha256=m['operatorSha256'])

def verify_running_files(op,a):
    if op.run('docker','exec','bobuy-core-service','sha256sum','/app/app.jar').split()[0] != a['coreJarSha256']:
        raise RuntimeError('Running complete core JAR differs')
    paths = []
    for entry in a['frontendFiles']:
        path = PurePosixPath(entry['path'])
        if path.is_absolute() or '..' in path.parts:
            raise RuntimeError('Invalid frontend file path')
        paths.append('/usr/share/nginx/html/' + entry['path'])
    lines = op.run('docker','exec','bobuy-frontend','sha256sum',*paths).splitlines()
    expected = [entry['sha256'] + '  ' + path for entry,path in zip(a['frontendFiles'],paths)]
    if lines != expected or op.run('docker','exec','bobuy-frontend','sha256sum','/etc/nginx/conf.d/default.conf').split()[0] != a['nginxSha256']:
        raise RuntimeError('Running web/config bytes differ')

def update(r2,op):
    op.budget.reset(r2.OPEN_SECONDS)
    if (STAGE/'update-context.json').exists():
        raise RuntimeError('Existing update outcome: reconcile, never repeat')
    previous = read(STAGE/'update-status.json')
    if (previous.get('phase'),previous.get('source'),previous.get('release'),previous.get('artifactSha256')) != ('APPLICATION_UPDATE_PREPARED',SOURCE,RELEASE,ARTIFACT_SHA):
        raise RuntimeError('Exact normal V27 preparation is required')
    a,m,b,t,before,backup_content = inputs(r2,op)
    if previous.get('baselineSha256') != m['baselineSha256'] or previous.get('operatorSha256') != m['operatorSha256']:
        raise RuntimeError('Prepared review inputs changed')
    compose=ROOT/'compose.production.yml';old=compose.read_bytes();candidate=(STAGE/'compose.after.yml').read_bytes()
    if old != (STAGE/'compose.before.yml').read_bytes() or candidate != t.rewrite_images(old.decode(),a['images'],before).encode() or old == candidate:
        raise RuntimeError('Prepared image-only compose bytes changed')
    compose_identity=op.config_identity(compose)
    nginx=ROOT/'infra/nginx/bobuy.conf';original=nginx.read_bytes();nginx_identity=op.config_identity(nginx)
    frozen=op.maintenance_config(original.decode()).encode()
    if original != (STAGE/'nginx.before.conf').read_bytes():
        raise RuntimeError('Prepared nginx bytes changed')
    base=ROOT/'docker-compose.yml';base_bytes=base.read_bytes();base_identity=op.config_identity(base)
    expected_base=b['files']['docker-compose.yml']
    if sha(base)!=expected_base['sha256'] or base_identity!=(expected_base['device'],expected_base['inode']):
        raise RuntimeError('Bound base Compose identity/bytes changed')
    with (STAGE/'update-context.json').open('x') as stream:
        json.dump({'baselineSha256':m['baselineSha256'],'runtime':before,'composeIdentity':compose_identity,'nginxIdentity':nginx_identity},stream,indent=2)
    trace=[];op.budget.reset(r2.OPEN_SECONDS);deadline=op.budget.deadline
    guard=OperationGuard(r2,op,before,a,compose,old,candidate,compose_identity,nginx,original,frozen,nginx_identity,base,base_bytes,base_identity,b,t)
    op.budget.guard=guard
    try:
        record('FREEZING_APPLICATION_ONLY')
        op.guarded_nginx_write(nginx,(original,),frozen,nginx_identity)
        op.run('docker','exec','bobuy-gateway','nginx','-t');op.run('docker','exec','bobuy-gateway','nginx','-s','reload')
        # Check all current business tables against the private fresh backup baseline.
        if t.frozen_content() != backup_content:
            raise RuntimeError('Current business data changed since private backup; preserve it and re-review')
        op.guarded_nginx_write(compose,(old,),candidate,compose_identity)
        for image in a['images']:
            name=image['name'];record('ACTIVATING_'+name.upper(),readiness=trace)
            op.run(*t.compose(),'up','-d','--no-deps','--no-build','--pull','never',name)
            r2.ready(op,name,image_binding(image),deadline,trace)
            verify_schema(r2,op,t,b)
        verify_running_files(op,a)
        if any(op.state(name) != before[name] for name in op.PROTECTED):
            raise RuntimeError('Protected service changed')
        if t.frozen_content() != backup_content:
            raise RuntimeError('Business fingerprints changed under write boundary; never restore database')
        if time.monotonic() > deadline:
            raise RuntimeError('Bounded pre-open deadline exceeded')
        record('OPENING_WRITES',readiness=trace)
        r2.reopen(op,nginx,original,frozen,nginx_identity)
        record('APPLICATION_ACTIVE_PUBLIC_ACCEPTANCE_PENDING',readiness=trace,writeBoundary='OPEN',publicAcceptance='NOT_RUN')
    except Exception as error:
        try:
            op.budget.reset(r2.RECOVERY_SECONDS)
            guard.check()  # Independent recovery budget; unknown identities never overwritten.
            r2.recover(op,t,before,compose,old,candidate,compose_identity,nginx,original,frozen,nginx_identity,trace)
            record('APPLICATION_ROLLED_BACK_KEEP_V27',reason=str(error),readiness=trace,writeBoundary='OPEN')
        except Exception as failure:
            record('RECOVERY_REQUIRED_NO_DATABASE_RESTORE',reason=str(error),recoveryError=str(failure),readiness=trace,automaticReopening=False,
                   knownRuntime=guard.known,observedRuntime=guard.observed,pendingOperation=guard.pending,
                   uncertainMutation=op.budget.uncertain_mutation)
        raise

def plan():
    return {'source':SOURCE,'base':BASE,'release':RELEASE,'stage':STAGE_TEXT,'revision':REVISION,
            'artifactSha256':ARTIFACT_SHA,'schema':'27 -> same 27','updates':list(UPDATES),
            'coreRuntimeQa':'REQUIRED_NOT_RUN','newOperatorQa':'REQUIRED_NOT_REVIEWED',
            'productionActions':False,'activationReady':False,'databaseRestoreAllowed':False,
            'imageImport':'Separate reviewed staging only; this adapter never loads or retags images'}

def main():
    if SOURCE.startswith('UNBOUND') or ARTIFACT_SHA.startswith('UNBOUND'):
        raise RuntimeError('Candidate only: accepted commit/CI/artifact/independent QA binding is required before any operation')
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['plan','prepare','update'])
    parser.add_argument('--apply-production',action='store_true');args=parser.parse_args()
    if args.action=='plan':
        print(json.dumps(plan(),indent=2));return
    if not args.apply_production or os.name!='posix' or os.geteuid()!=0:
        raise RuntimeError('Explicit original-host controlled production action required')
    if ROOT.is_symlink() or STAGE.is_symlink():
        raise RuntimeError('Unexpected target path')
    import fcntl
    os.umask(0o077)
    with (STAGE/'operator.lock').open('r+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        r2,op=load_reviewed()
        {'prepare':prepare,'update':update}[args.action](r2,op)

if __name__=='__main__':
    main()
