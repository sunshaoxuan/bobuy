"""Capture immutable CI-built core/web images; never activate services or read secrets."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def files(root):
    return [{'path': p.relative_to(root).as_posix(), 'bytes': p.stat().st_size,
             'sha256': digest(p)} for p in sorted(root.rglob('*')) if p.is_file()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = os.environ.get('GITHUB_SHA', '')
    if not re.fullmatch(r'[0-9a-f]{40}', source) or run('git', 'rev-parse', 'HEAD') != source:
        raise RuntimeError('Exact GitHub checkout SHA required')
    if run('git', 'status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('Tracked checkout changed during CI')
    accepted = json.loads(Path('docs/reports/consumer-ui-20261108/accepted-inputs.json').read_text())
    for entry in accepted['sourceFiles']:
        if digest(Path(entry['path'])) != entry['gitLfSha256']:
            raise RuntimeError('Accepted application source differs: ' + entry['path'])
    migration_root = Path('backend/src/main/resources/db/migration')
    if files(migration_root) != accepted['migrations']:
        raise RuntimeError('V27 migration bytes/list changed')
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    core_jar = output / 'core.jar'
    web = output / 'web'
    images = []
    for service, name in [('core-service', 'core'), ('frontend', 'frontend')]:
        tag = f'bobuy/{name}:ci-{source}'
        inspected = json.loads(run('docker', 'image', 'inspect', tag))[0]
        labels = inspected.get('Config', {}).get('Labels', {})
        if labels.get('org.opencontainers.image.revision') != source:
            raise RuntimeError('Image source label differs: ' + tag)
        created = run('docker', 'create', tag)
        try:
            if name == 'core':
                run('docker', 'cp', created + ':/app/app.jar', str(core_jar))
            else:
                web.mkdir()
                run('docker', 'cp', created + ':/usr/share/nginx/html/.', str(web))
                run('docker', 'cp', created + ':/etc/nginx/conf.d/default.conf', str(output / 'frontend-nginx.conf'))
        finally:
            run('docker', 'rm', created)
        images.append({'name': service, 'tag': tag, 'imageId': inspected['Id'],
                       'revision': source, 'os': inspected['Os'], 'architecture': inspected['Architecture'],
                       'rootfsDiffIds': inspected['RootFS']['Layers']})
    # The production core wrapper must contain the newly compiled shared implementation.
    # The monolith used by local UI QA is supporting evidence, not a substitute core JAR.
    with zipfile.ZipFile(core_jar) as archive:
        common_names = [n for n in archive.namelist() if re.fullmatch(r'BOOT-INF/lib/bobbuy-common-[^/]+\.jar', n)]
        if len(common_names) != 1:
            raise RuntimeError('Expected production core wrapper/common dependency')
        with zipfile.ZipFile(io.BytesIO(archive.read(common_names[0]))) as common:
            classes = {e['path']: hashlib.sha256(common.read(e['path'])).hexdigest()
                       for e in accepted['acceptedBackendClasses']}
            browse_record = common.read('com/bobbuy/service/PublicProductBrowseService$Browse.class')
            if b'markedScopeTotal' not in browse_record:
                raise RuntimeError('Core lacks the accepted full-scope marked count')
    if digest(core_jar) == accepted['previousProductionCoreJarSha256']:
        raise RuntimeError('Old production core was supplied for the new batch')
    expected_classes = {e['path']: e['sha256'] for e in accepted['acceptedBackendClasses']}
    web_files = files(web)
    archive = output / 'images.tar'
    subprocess.run(['docker', 'save', '--output', str(archive), *[e['tag'] for e in images]], check=True)
    manifest = {'source': source, 'version': 'ci-' + source, 'acceptedApplicationSourceDigest': accepted['sourceDigest'],
                'repository': os.environ.get('GITHUB_REPOSITORY'), 'runId': os.environ.get('GITHUB_RUN_ID'),
                'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'images': images,
                'archiveSha256': digest(archive), 'archiveBytes': archive.stat().st_size,
                'coreJarSha256': digest(core_jar), 'coreJarBytes': core_jar.stat().st_size,
                'coreClassHashes': classes, 'coreClassesMatchLocalAcceptedCompile': classes == expected_classes,
                'frontendIndexSha256': digest(web / 'index.html'), 'frontendFiles': web_files,
                'frontendMatchesAcceptedBytes': web_files == accepted['frontendFiles'],
                'nginxSha256': digest(output / 'frontend-nginx.conf'),
                'schemaBefore': 27, 'schemaAfter': 27, 'migrationChanges': False,
                'migrations': accepted['migrations'], 'independentApplicationQa': accepted['qa'],
                'independentArtifactQa': 'PENDING', 'productionStaged': False, 'productionActivated': False,
                'rollback': 'Application-only after fresh production preflight; retain V27 and all newer customer writes. Never restore an old database.',
                'byteDifferencePolicy': 'Source is exact. Any compile/web byte differences require explicit artifact QA binding; no equality is inferred.'}
    (output / 'artifact.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({k: manifest[k] for k in ['source', 'archiveBytes', 'archiveSha256', 'coreJarSha256',
                                            'frontendIndexSha256', 'coreClassesMatchLocalAcceptedCompile', 'frontendMatchesAcceptedBytes']}))


if __name__ == '__main__':
    main()
