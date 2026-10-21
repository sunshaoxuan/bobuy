"""Emit stable, non-secret evidence for the protected DR resources."""
import hashlib
import json
import subprocess
from pathlib import Path


def run(*args):
    return subprocess.check_output(args, text=True)


names = ['rhospital-ha-bbs-replica', 'rhospital-ha-game-replica',
         'rhospital-etcd', 'rhospital-postgres-dr']
containers = json.loads(run('docker', 'inspect', *names))
result = {'containers': {}, 'images': [], 'config_hashes': {}, 'units': {}}
for c in containers:
    stable = {k: c[k] for k in ['Id', 'Image', 'HostConfig', 'Mounts', 'Config']}
    stable['Mounts'] = sorted(stable['Mounts'], key=lambda mount: mount['Destination'])
    result['containers'][c['Name']] = {
        'configuration_sha256': hashlib.sha256(json.dumps(stable, sort_keys=True).encode()).hexdigest(),
        'status': c['State']['Status'], 'started_at': c['State']['StartedAt'],
        'restart_count': c['RestartCount'],
    }
result['images'] = sorted(run('docker', 'images', 'hospital-backend', '--format',
                             '{{.Repository}}:{{.Tag}} {{.ID}}').splitlines())
for directory in ['/opt/rhospital-dr', '/opt/rhospital-ha-bbs-replica',
                  '/opt/rhospital-ha-replica']:
    for pattern in ['*compose*.y*ml', '*.env']:
        for path in Path(directory).glob(pattern):
            result['config_hashes'][str(path)] = hashlib.sha256(path.read_bytes()).hexdigest()
for unit in ['rhospital-etcd', 'rhospital-ha-firewall', 'rhospital-ha-pg-tunnel',
             'bbs-source-tunnel']:
    result['units'][unit] = run('systemctl', 'show', unit, '-p', 'ActiveState',
                               '-p', 'MainPID', '-p', 'ActiveEnterTimestamp').strip()
print(json.dumps(result, indent=2, sort_keys=True))
