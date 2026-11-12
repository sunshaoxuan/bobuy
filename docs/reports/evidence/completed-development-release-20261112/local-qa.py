"""Task-owned local HTTP QA using the live Core JAR and a disposable database."""
import bcrypt
import hashlib
import json
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import time
import urllib.request

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[3]
TMP = ROOT / '.task-tmp/completed-release/qa'
NAME = 'bobuy-gallery-qa-20261112'
DATABASE = 'qa_gallery_feedback_20261112'
POSTGRES = 'bobuy-local-postgres-1'
LABEL = 'completed-gallery-feedback-20261112'
SSH = ['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', 'C:/workspace/Secure/sunsxaws.pem', 'root@185.184.223.41']

def run(args, data=None):
    result = subprocess.run(args, input=data, capture_output=True)
    if result.returncode:
        raise RuntimeError('QA_COMMAND_FAILED:' + str(result.returncode) + ':' + args[0])
    return result.stdout

def sql(query):
    return run(['docker', 'exec', '-i', POSTGRES, 'sh', '-c',
                'psql -U "$POSTGRES_USER" -d ' + DATABASE + ' -qAt -v ON_ERROR_STOP=1'], query.encode()).decode().strip()

def dump(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

mode = sys.argv[1]
if mode == 'setup':
    assert not TMP.exists(), 'Inspect existing task QA state before repeating setup'
    assert subprocess.run(['docker', 'inspect', NAME], capture_output=True).returncode != 0
    with socket.socket() as sock:
        assert sock.connect_ex(('127.0.0.1', 18089)) != 0, 'QA port already owned'
    runtime = json.loads((OUT / 'runtime-initial.json').read_text(encoding='utf-8'))
    expected_image = runtime['containers']['bobuy-core-service']['image']
    remote_script = """import json,subprocess
d=json.loads(subprocess.check_output(['docker','inspect','bobuy-core-service']))[0]
assert d['Image']==EXPECTED
a=d['Args'];p=a[a.index('-jar')+1]
h=subprocess.check_output(['docker','exec','bobuy-core-service','sha256sum',p]).decode().split()[0]
print(json.dumps({'jar':p,'sha256':h,'image':d['Image'],'revision':d['Config']['Labels'].get('org.opencontainers.image.revision')}))
""".replace('EXPECTED', repr(expected_image))
    metadata = json.loads(run(SSH + ['python3 -'], remote_script.encode()))
    assert re.fullmatch(r'/[A-Za-z0-9_./-]+\.jar', metadata['jar'])
    TMP.mkdir(parents=True)
    state = {'database': DATABASE, 'container': NAME, 'label': LABEL, 'databaseCreated': False}
    dump(TMP / 'state.json', state)
    jar = TMP / 'live-core.jar'
    with jar.open('wb') as target:
        result = subprocess.run(SSH + ['docker exec bobuy-core-service cat ' + metadata['jar']], stdout=target, stderr=subprocess.PIPE)
    assert result.returncode == 0 and hashlib.sha256(jar.read_bytes()).hexdigest() == metadata['sha256']
    pg = json.loads(run(['docker', 'inspect', POSTGRES]))[0]
    assert pg['Config']['Labels']['com.docker.compose.project'] == 'bobuy-local'
    env = dict(value.split('=', 1) for value in pg['Config']['Env'] if '=' in value)
    count = run(['docker', 'exec', POSTGRES, 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt -c "select count(*) from pg_database where datname=\'' + DATABASE + '\'"']).decode().strip()
    assert count == '0'
    protected = json.loads(run(['docker', 'ps', '-aq']).decode().strip() and run(['docker', 'inspect', *run(['docker', 'ps', '-aq']).decode().split()]))
    protected_ids = {item['Name']: item['Id'] for item in protected}
    run(['docker', 'exec', POSTGRES, 'sh', '-c', 'createdb -U "$POSTGRES_USER" ' + DATABASE])
    state['databaseCreated'] = True
    dump(TMP / 'state.json', state)
    jwt = secrets.token_hex(48)
    values = {'SPRING_DATASOURCE_URL': 'jdbc:postgresql://postgres:5432/' + DATABASE,
              'SPRING_DATASOURCE_USERNAME': env['POSTGRES_USER'], 'SPRING_DATASOURCE_PASSWORD': env['POSTGRES_PASSWORD'],
              'BOBBUY_JWT_SECRET': jwt}
    (TMP / 'qa.env').write_text('\n'.join(key + '=' + value for key, value in values.items()) + '\n', encoding='utf-8')
    base = json.loads(run(['docker', 'inspect', 'bobuy-cards-core-20261111']))[0]['Image']
    arguments = ['docker', 'run', '-d', '--name', NAME, '--label', 'com.bobuy.qa-owner=' + LABEL,
                 '--network', 'bobuy-local_default', '-p', '127.0.0.1:18089:8081', '--memory', '512m', '--cpus', '1',
                 '--env-file', str(TMP / 'qa.env'), '--mount', 'type=bind,src=' + str(jar) + ',dst=/qa/live-core.jar,readonly',
                 '--mount', 'type=bind,src=' + str(ROOT / 'backend/src/main/resources/application.properties') + ',dst=/qa/application.properties,readonly',
                 '--entrypoint', 'java', base, '-Xmx320m', '-jar', '/qa/live-core.jar',
                 '--spring.config.location=file:/qa/application.properties', '--server.port=8081',
                 '--bobbuy.seed.enabled=false', '--bobbuy.security.header-auth.enabled=false',
                 '--bobbuy.security.jwt.secret=${BOBBUY_JWT_SECRET}', '--bobbuy.websocket.broker-relay.enabled=false',
                 '--spring.cloud.nacos.discovery.enabled=false', '--spring.cloud.nacos.config.enabled=false',
                 '--spring.data.redis.host=127.0.0.1', '--spring.rabbitmq.host=127.0.0.1',
                 '--spring.rabbitmq.listener.simple.auto-startup=false', '--spring.rabbitmq.listener.direct.auto-startup=false',
                 '--management.health.redis.enabled=false', '--management.health.rabbit.enabled=false']
    state['containerId'] = run(arguments).decode().strip()
    dump(TMP / 'state.json', state)
    ready = False
    for _ in range(120):
        try:
            with urllib.request.urlopen('http://127.0.0.1:18089/api/health', timeout=2) as response:
                ready = response.status == 200
            if ready:
                break
        except Exception:
            pass
        time.sleep(1)
    logs = run(['docker', 'logs', NAME]).decode(errors='replace')
    for value in [env['POSTGRES_PASSWORD'], jwt]:
        logs = logs.replace(value, '[REDACTED]')
    (OUT / 'local-qa-startup.log').write_text(logs, encoding='utf-8')
    assert ready, 'QA Core did not become ready; owned state retained for diagnosis/cleanup'
    password = secrets.token_urlsafe(24)
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    q = lambda value: "'" + value.replace("'", "''") + "'"
    statements = ['BEGIN;']
    for index in [1, 2]:
        ident = 99312000 + index
        statements.append(f"insert into bb_user(id,name,username,password_hash,roles,enabled) values({ident},'Gallery QA {index}','qa-gallery-{index}',{q(hashed)},'[\"AGENT\"]',true);")
    for index, owner in [(1, 99312001), (2, 99312001), (3, 99312002)]:
        name = json.dumps({'ja-JP': '画像アップロード検証 ' + str(index), 'en-US': 'Gallery upload QA ' + str(index), 'zh-CN': '图片上传验收 ' + str(index), 'zh-TW': '圖片上傳驗收 ' + str(index)}, ensure_ascii=False)
        statements.append(f"insert into bb_product(id,merchant_id,name,description,brand,base_price,visibility_status,media_gallery,item_number) values('qa-gallery-{index}',{owner},{q(name)},'{{}}','QA',100,'DRAFTER_ONLY','[]','QA-GALLERY-{index}');")
    statements.append('COMMIT;')
    sql('\n'.join(statements))
    dump(TMP / 'credentials.json', {'password': password, 'users': ['qa-gallery-1', 'qa-gallery-2']})
    dump(OUT / 'local-qa-binding.json', {'result': 'PASS', 'core': metadata, 'qaContainer': state['containerId'],
          'database': DATABASE, 'origin': 'http://127.0.0.1:18089', 'schema': sql('select version from flyway_schema_history where success order by installed_rank desc limit 1'),
          'users': [99312001, 99312002], 'products': ['qa-gallery-1', 'qa-gallery-2', 'qa-gallery-3'], 'protectedContainers': protected_ids})
    print('LOCAL_QA_READY_WITH_LIVE_CORE_JAR_AND_DISPOSABLE_DATABASE')
elif mode == 'cleanup':
    state = json.loads((TMP / 'state.json').read_text())
    assert state['database'] == DATABASE and state['container'] == NAME and state['label'] == LABEL
    check = subprocess.run(['docker', 'inspect', NAME], capture_output=True)
    if check.returncode == 0:
        data = json.loads(check.stdout)[0]
        assert data['Config']['Labels'].get('com.bobuy.qa-owner') == LABEL
        assert data['Id'] == state.get('containerId', data['Id'])
        run(['docker', 'rm', '-f', NAME])
    if state['databaseCreated']:
        run(['docker', 'exec', POSTGRES, 'sh', '-c', 'dropdb -U "$POSTGRES_USER" ' + DATABASE])
    assert TMP.resolve() == (ROOT / '.task-tmp/completed-release/qa').resolve()
    shutil.rmtree(TMP)
    dump(OUT / 'local-qa-cleanup.json', {'result': 'PASS', 'containerRemoved': NAME, 'databaseRemoved': DATABASE, 'privateCredentialsAndJarRemoved': True})
    print('ONLY_TASK_QA_CONTAINER_DATABASE_AND_PRIVATE_FILES_REMOVED')
else:
    raise SystemExit('Use setup or cleanup')
