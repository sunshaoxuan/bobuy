"""Create the first operator only in an empty Bobuy database on the node."""
import crypt
import json
import os
import secrets
import subprocess


if __name__ == '__main__':
    if os.geteuid() != 0:
        raise SystemExit('Run as root on the Bobuy node')
    if os.path.exists('/etc/bobuy-admin.json'):
        raise SystemExit('Bootstrap credentials already exist; no changes made')
    password = secrets.token_urlsafe(27)
    hashed = crypt.crypt(password, crypt.mksalt(crypt.METHOD_BLOWFISH, rounds=2**12))
    assert hashed.startswith('$2'), 'BCrypt unavailable'
    sql = """BEGIN;
LOCK TABLE bb_user IN EXCLUSIVE MODE;
DO $$ BEGIN
IF EXISTS (SELECT 1 FROM bb_user) THEN
RAISE EXCEPTION 'Bootstrap requires an empty user table';
END IF;
END $$;
INSERT INTO bb_user (id,name,username,password_hash,enabled,role,rating)
VALUES (1001,'Bobuy Operator','bobuy-admin',:'hash',true,'AGENT',0);
COMMIT;
"""
    subprocess.run(['docker', 'exec', '-i', 'bobuy-postgres', 'psql', '-U', 'bobuy',
                    '-d', 'bobuy', '-v', 'ON_ERROR_STOP=1', '-v', f'hash={hashed}'],
                   input=sql, text=True, check=True, capture_output=True)
    fd = os.open('/etc/bobuy-admin.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump({'username': 'bobuy-admin', 'password': password}, stream)
    print('Created initial operator; credentials stored root-only on target')
