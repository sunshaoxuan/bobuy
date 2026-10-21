"""Create an independent root-only production environment once on the target."""
import os
import secrets
from pathlib import Path


if __name__ == '__main__':
    if os.geteuid() != 0:
        raise SystemExit('Run as root on the Bobuy node')
    values = {
        'BOBUY_RELEASE': '20261021.1',
        'POSTGRES_DB': 'bobuy',
        'POSTGRES_USER': 'bobuy',
        'POSTGRES_PASSWORD': secrets.token_hex(32),
        'MINIO_ROOT_USER': 'bobuyadmin',
        'MINIO_ROOT_PASSWORD': secrets.token_hex(32),
        'RABBITMQ_DEFAULT_USER': 'bobuy',
        'RABBITMQ_DEFAULT_PASS': secrets.token_hex(32),
        'BOBBUY_SECURITY_JWT_SECRET': secrets.token_hex(64),
        'BOBBUY_SECURITY_SERVICE_TOKEN': secrets.token_hex(32),
        'BOBBUY_SECURITY_REFRESH_COOKIE_SECURE': 'true',
        'BOBBUY_SECURITY_HEADER_AUTH_ENABLED': 'false',
        'BOBBUY_SECURITY_CORS_ALLOWED_ORIGIN_PATTERNS': 'https://bobuy.cc',
        'BOBBUY_SEED_ENABLED': 'false',
        'BOBBUY_SEED_PICKING_FIXTURE_ENABLED': 'false',
    }
    path = Path('/etc/bobuy.env')
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        stream.write(''.join(f'{key}={value}\n' for key, value in values.items()))
    print('Created root-only independent production configuration')
