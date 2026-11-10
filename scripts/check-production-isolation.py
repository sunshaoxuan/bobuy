"""Check the rendered production Compose model without exposing environment values."""
import json
import os
import subprocess
from pathlib import Path


def validate(model):
    assert model['name'] == 'bobuy', 'unexpected project'
    assert model['networks']['bobbuy-net']['name'] == 'bobuy-net'
    for name, service in model['services'].items():
        assert service['container_name'].startswith('bobuy-'), name
        assert not service.get('privileged'), name
        assert service.get('network_mode') != 'host', name
        if name != 'gateway':
            assert not service.get('ports'), f'{name}: published management port'
        for mount in service.get('volumes', []):
            source = mount.get('source', '')
            assert 'rhospital' not in source.lower(), f'{name}: protected mount'
        if name.endswith('-service') and name != 'ocr-service':
            assert service['image'].startswith('bobuy/'), name
    ports = {int(p['published']) for p in model['services']['gateway']['ports']}
    assert ports == {80, 443}, ports
    assert model['services']['core-service']['environment']['SPRING_FLYWAY_ENABLED'] == 'true'
    for name in ['ai-service', 'im-service', 'auth-service']:
        assert model['services'][name]['environment']['SPRING_FLYWAY_ENABLED'] == 'false'
    for name in ['core-service', 'ai-service', 'im-service', 'auth-service']:
        env = model['services'][name]['environment']
        assert env['BOBBUY_SECURITY_HEADER_AUTH_ENABLED'] == 'false'
        assert env['BOBBUY_SECURITY_REFRESH_COOKIE_SECURE'] == 'true'
        assert env['BOBBUY_SEED_ENABLED'] == 'false'
    budget = sum(int(s.get('deploy', {}).get('resources', {}).get('limits', {}).get('memory', 0))
                 for name, s in model['services'].items() if name != 'rustfs')
    assert budget <= 5 * 1024**3, budget
    if 'rustfs' in model['services']:
        service = model['services']['rustfs']
        assert service['image'] == 'rustfs/rustfs:1.0.4@sha256:e287e99762a4a3e7b706526e01f2ff755f67db165e9be9f6b907adc6fb6d6ee1'
        assert service['user'] == '10001:10001'
        limits = service['deploy']['resources']['limits']
        assert int(limits['memory']) <= 1024**3 and float(limits['cpus']) <= 1
        assert service['environment']['RUSTFS_CONSOLE_ENABLE'] == 'false'
        assert all(m.get('read_only') for m in service['volumes'] if m['target'].startswith('/run/'))
    for name in ['core-service', 'ai-service']:
        mounts = model['services'][name]['volumes']
        assert all(m.get('read_only') for m in mounts if m['target'].startswith('/run/secrets/media-'))
        assert not any('root-secret' in m.get('source', '') or 'ca-key' in m.get('source', '') for m in mounts)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    env = dict(os.environ, BOBUY_RELEASE='validation',
               BOBBUY_SECURITY_REFRESH_COOKIE_SECURE='true', BOBBUY_SEED_ENABLED='false',
               BOBBUY_SECURITY_HEADER_AUTH_ENABLED='false')
    result = subprocess.run(['docker', 'compose', '--env-file', os.devnull,
                             '-f', 'docker-compose.yml', '-f', 'compose.production.yml',
                             'config', '--format', 'json'], cwd=root, env=env,
                            check=True, capture_output=True, text=True, encoding='utf-8')
    model = json.loads(result.stdout)
    validate(model)
    # The explicitly approved extra RustFS resource cap is separate; the original
    # <=5GiB cap remains unchanged for every pre-existing service.
    scoped = subprocess.run(['docker', 'compose', '--env-file', os.devnull,
                             '-f', 'docker-compose.yml', '-f', 'compose.production.yml',
                             '--profile', 'object-storage', 'config', '--format', 'json'],
                            cwd=root, env=env, check=True, capture_output=True, text=True, encoding='utf-8')
    scoped_model = json.loads(scoped.stdout)
    validate(scoped_model)
    import copy
    for mutation in ['public-port', 'excess-resource', 'writable-secret']:
        bad = copy.deepcopy(scoped_model)
        service = bad['services']['rustfs']
        if mutation == 'public-port': service['ports'] = [{'published': '9000', 'target': 9000}]
        if mutation == 'excess-resource': service['deploy']['resources']['limits']['memory'] = 2 * 1024**3
        if mutation == 'writable-secret': next(m for m in service['volumes'] if m['target'].startswith('/run/'))['read_only'] = False
        try:
            validate(bad)
        except AssertionError:
            pass
        else:
            raise AssertionError('RustFS negative case accepted: ' + mutation)
    # A negative case proves the gate rejects an accidentally exposed database.
    model['services']['postgres']['ports'] = [{'published': '5432', 'target': 5432}]
    try:
        validate(model)
    except AssertionError:
        print('PASS: production isolation and published-database negative case')
    else:
        raise AssertionError('negative case accepted')
