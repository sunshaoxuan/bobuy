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
                 for s in model['services'].values())
    assert budget <= 5 * 1024**3, budget


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
    # A negative case proves the gate rejects an accidentally exposed database.
    model['services']['postgres']['ports'] = [{'published': '5432', 'target': 5432}]
    try:
        validate(model)
    except AssertionError:
        print('PASS: production isolation and published-database negative case')
    else:
        raise AssertionError('negative case accepted')
