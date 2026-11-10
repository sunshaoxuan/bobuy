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

ARTICLE_BASELINE_PATH = 'docs/reports/c2-cart-20261109/accepted-inputs.json'
ARTICLE_BASELINE_SHA256 = '48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba'
ISSUE_DATE_MIGRATION = 'V28_1__recommendation_issue_date.sql'
ISSUE_DATE_SHA256 = 'd742bea25cb8ef3d205c9e2a4992d25024a372b5ab9dc38dc915f0ebbb91224e'


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


def class_acceptance(accepted):
    expected = accepted.get('acceptedBackendClasses')
    if expected is not None:
        if 'requiredBackendClassCount' in accepted and accepted['requiredBackendClassCount'] != len(expected):
            raise RuntimeError('Accepted exact class count differs')
        return [entry['path'] for entry in expected], {entry['path']: entry['sha256'] for entry in expected}
    required = accepted.get('requiredBackendClasses', [])
    if accepted.get('compiledByteAcceptance') != 'PENDING_INDEPENDENT_ARTIFACT_QA' or not required:
        raise RuntimeError('Source-only acceptance requires explicit pending artifact QA and required classes')
    if len(set(required)) != len(required) or any(not re.fullmatch(r'com/bobbuy/[A-Za-z0-9_/$]+\.class', path) for path in required):
        raise RuntimeError('Invalid required backend classes')
    if 'requiredBackendClassCount' in accepted and accepted['requiredBackendClassCount'] != len(required):
        raise RuntimeError('Required class count differs')
    return required, None


def source_digest_acceptance(accepted):
    if 'sourceFileCount' in accepted and accepted['sourceFileCount'] != len(accepted['sourceFiles']):
        raise RuntimeError('Accepted source count differs')
    algorithm = accepted.get('sourceDigestAlgorithm')
    if algorithm is not None:
        value = json.dumps(accepted['sourceFiles'], ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        if algorithm != 'sha256-json-utf8-sourceFiles-v1' or hashlib.sha256(value).hexdigest() != accepted['sourceDigest']:
            raise RuntimeError('Accepted source-list digest differs')


def version_tuple(value):
    if isinstance(value, bool) or not isinstance(value, (str, int)) or not re.fullmatch(r'\d+(?:[._]\d+)*', str(value)):
        raise RuntimeError('Invalid Flyway version; floating-point versions are not accepted')
    parts = tuple(int(part) for part in re.split(r'[._]', str(value)))
    while len(parts) > 1 and parts[-1] == 0:
        parts = parts[:-1]
    return parts


def migration_version(path):
    match = re.fullmatch(r'V(\d+(?:[._]\d+)*)__[^/]+\.sql', path)
    if match is None:
        raise RuntimeError('Invalid accepted migration filename')
    return version_tuple(match.group(1))


def schema_acceptance(accepted, actual, baseline=None):
    if actual != accepted['migrations']:
        raise RuntimeError('Accepted migration bytes/list changed')
    identity = (accepted.get('schemaBefore', 27), accepted.get('schemaAfter', 27), accepted.get('migrationChanges', False))
    version_tuple(identity[0])
    version_tuple(identity[1])
    versions = [migration_version(entry['path']) for entry in actual]
    if not versions or len(set(versions)) != len(versions) or not isinstance(identity[2], bool):
        raise RuntimeError('Missing/duplicate normalized migration version or invalid migration flag')
    legacy_names = all(re.fullmatch(r'V\d+__.+\.sql', entry['path']) for entry in actual)
    if identity == (28, 28, False):
        if (accepted.get('candidateKind') != 'ARTICLE_DIGEST_EDITOR_V1' or baseline is None
                or baseline.get('schemaBefore') != 27 or baseline.get('schemaAfter') != 28
                or baseline.get('migrationChanges') is not True or len(actual) != 27
                or not legacy_names or max(versions) != (28,) or actual != baseline['migrations']):
            raise RuntimeError('Article requires the exact C2 V1..V28 manifest with no SQL change')
        return {'schemaBefore': 28, 'schemaAfter': 28, 'migrationChanges': False}
    if identity == (27, 27, False) and legacy_names and max(versions) == (27,):
        return {'schemaBefore': 27, 'schemaAfter': 27, 'migrationChanges': False}
    if identity == (28, 31, True):
        if (baseline is None or (baseline.get('schemaBefore'), baseline.get('schemaAfter'), baseline.get('migrationChanges')) != (27, 28, True)):
            raise RuntimeError('V31 requires the exact prior C2/V28 migration manifest')
        previous = baseline['migrations']
        old_part = [entry for entry in actual if entry['path'] != 'V31__recommendation_item_publication.sql']
        added = [entry for entry in actual if entry['path'] == 'V31__recommendation_item_publication.sql']
        if (old_part != previous or len(added) != 1 or max(versions) != (31,)
                or any(version > (28,) for version in versions if version != (31,))):
            raise RuntimeError('V31 requires unchanged V28 migrations plus only its exact V31 migration')
        return {'schemaBefore': 28, 'schemaAfter': 31, 'migrationChanges': True}
    if identity == ('28.1', 31, True):
        if (baseline is None or (baseline.get('schemaBefore'), baseline.get('schemaAfter'), baseline.get('migrationChanges')) != (28, '28.1', True)):
            raise RuntimeError('Combined publication requires the accepted UI V28.1 migration baseline')
        old_part = [entry for entry in actual if entry['path'] != 'V31__recommendation_item_publication.sql']
        added = [entry for entry in actual if entry['path'] == 'V31__recommendation_item_publication.sql']
        if (old_part != baseline['migrations'] or len(added) != 1 or max(versions) != (31,)
                or any(version > (28, 1) for version in versions if version != (31,))
                or sum(entry['path'] == ISSUE_DATE_MIGRATION and entry.get('sha256') == ISSUE_DATE_SHA256 for entry in old_part) != 1):
            raise RuntimeError('Only exact accepted V28.1 prefix plus reviewed V31 is allowed')
        return {'schemaBefore': '28.1', 'schemaAfter': 31, 'migrationChanges': True}
    if identity == (28, '28.1', True):
        old_part = [entry for entry in actual if entry['path'] != ISSUE_DATE_MIGRATION]
        added = [entry for entry in actual if entry['path'] == ISSUE_DATE_MIGRATION]
        if (baseline is None or (baseline.get('schemaBefore'), baseline.get('schemaAfter'), baseline.get('migrationChanges')) != (27, 28, True)
                or old_part != baseline['migrations'] or len(added) != 1
                or added[0].get('sha256') != ISSUE_DATE_SHA256 or len(actual) != len(old_part) + 1
                or not old_part or max(migration_version(entry['path']) for entry in old_part) != (28,)
                or max(versions) != (28, 1) or not all(re.fullmatch(r'V\d+__.+\.sql', entry['path']) for entry in old_part)):
            raise RuntimeError('Issue dates require the exact immutable C2 V28 prefix plus only the pinned V28.1 migration')
        return {'schemaBefore': 28, 'schemaAfter': '28.1', 'migrationChanges': True}
    if identity == (28, 30, True):
        additions = {'V29__customer_order_amendments.sql', 'V30__costco_onboarding_jobs.sql'}
        if (baseline is None or (baseline.get('schemaBefore'), baseline.get('schemaAfter'), baseline.get('migrationChanges')) != (27, 28, True)
                or [entry for entry in actual if entry['path'] not in additions] != baseline['migrations']
                or {entry['path'] for entry in actual if entry['path'] in additions} != additions
                or len(actual) != len(baseline['migrations']) + 2 or max(versions) != (30,)
                or len(set(versions)) != len(versions)):
            raise RuntimeError('C3/R13 requires the exact unchanged C2 V28 list plus only its V29 and V30 migrations')
        return {'schemaBefore': 28, 'schemaAfter': 30, 'migrationChanges': True}
    if identity != (27, 28, True) or baseline is None or baseline.get('schemaAfter') != 27 or baseline.get('migrationChanges') is not False:
        raise RuntimeError('Unaccepted schema transition')
    previous = baseline['migrations']
    old_part = [entry for entry in actual if entry['path'] != 'V28__checkout_delivery_snapshot.sql']
    added = [entry for entry in actual if entry['path'] == 'V28__checkout_delivery_snapshot.sql']
    if not legacy_names or old_part != previous or len(added) != 1 or max(versions) != (28,):
        raise RuntimeError('C2 requires the exact unchanged V27 list plus only its V28 migration')
    return {'schemaBefore': 27, 'schemaAfter': 28, 'migrationChanges': True}


def checkout_migration_acceptance(content):
    text = re.sub(r'--[^\n]*', '', content.decode('utf-8'))
    statements = [' '.join(value.split()).lower() for value in text.split(';') if value.strip()]
    if statements != ['alter table bb_order_header add column delivery_snapshot jsonb',
                      'alter table bb_order_header add column checkout_payload_hash varchar(64)']:
        raise RuntimeError('C2 migration must add only the two nullable columns without defaults or data writes')


def publication_migration_acceptance(content):
    # Exact source-QA migration, canonical Git LF bytes. New SQL requires a new review.
    canonical = content.decode('utf-8').replace('\r\n', '\n').encode('utf-8')
    if hashlib.sha256(canonical).hexdigest() != 'db1a7f96ea5017fabfadd5f52809fe0357816da6433ebb31d723deac900773a7':
        raise RuntimeError('V31 publication migration differs from its exact reviewed bytes')


def recovery_contract(schema):
    if schema['schemaAfter'] == 31:
        return {
            'status': 'UNBOUND_EXACT_V31_AWARE_ARCHIVE_AND_PG_RUNTIME_REQUIRED',
            'oldV28CoreAllowed': False, 'oldDatabaseRestoreAllowed': False,
            'metadataOrClassPresenceIsRuntimeProof': False,
            'fallback': 'CONTROLLED_MAINTENANCE_AND_FORWARD_FIX_IF_NO_VERIFIED_AWARE_ARTIFACT',
            'requirement': 'Only an exact PENDING-aware core/JAR proven on V31 PG and independently hash-bound in a recoverable archive may be restored.',
        }
    return None


def rollback_description(schema):
    if schema['schemaAfter'] == 31:
        return ('V31 data must stay intact. Old V28 core ignores PENDING and is not a recovery target. '
                'Restore only the exact PENDING-aware artifact proven on V31 PG and hash-bound in an independently verified recovery archive; '
                'otherwise keep controlled maintenance and forward-fix. This capture leaves recovery UNBOUND and authorizes no activation.')
    return ('Compatible application-only recovery after fresh preflight; retain V'
            + str(schema['schemaAfter']) + ' and all newer customer writes. Never restore an old database.')
def issue_date_migration_acceptance(content):
    if hashlib.sha256(content).hexdigest() != ISSUE_DATE_SHA256:
        raise RuntimeError('Only the reviewed byte-exact V28.1 issue-date migration is accepted')


def migration_baseline(accepted):
    if (accepted.get('schemaBefore'), accepted.get('schemaAfter'), accepted.get('migrationChanges')) == ('28.1', 31, True):
        binding = accepted.get('migrationBaseline', {})
        path = Path(binding.get('path', ''))
        expected = '6a20f67e81919a0bf53088183e5bc0473a94885654fce867ec36356cf9e519f9'
        if (path.as_posix() != 'docs/reports/consumer-ui-integration-20261109/accepted-inputs.json'
                or binding.get('sha256') != expected or digest(path) != expected):
            raise RuntimeError('The unchanged accepted48433 UI V28.1 manifest is required')
        return json.loads(path.read_text())
    if (accepted.get('schemaBefore'), accepted.get('schemaAfter'), accepted.get('migrationChanges')) == (28, 28, False):
        binding = accepted.get('migrationBaseline', {})
        path = Path(binding.get('path', ''))
        if (accepted.get('candidateKind') != 'ARTICLE_DIGEST_EDITOR_V1'
                or path.as_posix() != ARTICLE_BASELINE_PATH
                or binding.get('sha256') != ARTICLE_BASELINE_SHA256
                or digest(path) != ARTICLE_BASELINE_SHA256):
            raise RuntimeError('Exact C2 accepted migration baseline required for article V28')
        return json.loads(path.read_text())
    if (accepted.get('schemaBefore'), accepted.get('schemaAfter'), accepted.get('migrationChanges')) == (28, '28.1', True):
        binding = accepted.get('migrationBaseline', {})
        path = Path(binding.get('path', ''))
        if (path.as_posix() != ARTICLE_BASELINE_PATH
                or binding.get('sha256') != ARTICLE_BASELINE_SHA256
                or digest(path) != ARTICLE_BASELINE_SHA256):
            raise RuntimeError('The immutable accepted C2 V28 manifest is required')
        return json.loads(path.read_text())
    if not accepted.get('migrationChanges'):
        return None
    binding = accepted.get('migrationBaseline', {})
    path = Path(binding.get('path', ''))
    prior = ('docs/reports/c2-cart-20261109/accepted-inputs.json'
             if (accepted.get('schemaBefore'), accepted.get('schemaAfter')) in {(28, 30), (28, 31)}
             else 'docs/reports/c1-profile-20261109/accepted-inputs.json')
    if path.as_posix() != prior or digest(path) != binding.get('sha256'):
        raise RuntimeError('Exact prior migration manifest required')
    if (accepted.get('schemaBefore'), accepted.get('schemaAfter')) == (28, 30) and binding['sha256'] != '48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba':
        raise RuntimeError('C3/R13 requires the immutable accepted C2 V28 manifest')
    return json.loads(path.read_text())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--accepted-inputs', type=Path,
                        default=Path('docs/reports/consumer-ui-20261108/accepted-inputs.json'))
    args = parser.parse_args()
    source = os.environ.get('GITHUB_SHA', '')
    if not re.fullmatch(r'[0-9a-f]{40}', source) or run('git', 'rev-parse', 'HEAD') != source:
        raise RuntimeError('Exact GitHub checkout SHA required')
    if run('git', 'status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('Tracked checkout changed during CI')
    accepted = json.loads(args.accepted_inputs.read_text())
    source_digest_acceptance(accepted)
    required_classes, expected_classes = class_acceptance(accepted)
    for entry in accepted['sourceFiles']:
        if digest(Path(entry['path'])) != entry['gitLfSha256']:
            raise RuntimeError('Accepted application source differs: ' + entry['path'])
    migration_root = Path('backend/src/main/resources/db/migration')
    schema = schema_acceptance(accepted, files(migration_root), migration_baseline(accepted))
    if (schema['schemaBefore'], schema['schemaAfter'], schema['migrationChanges']) == (27, 28, True):
        checkout_migration_acceptance((migration_root / 'V28__checkout_delivery_snapshot.sql').read_bytes())
    if (schema['schemaBefore'], schema['schemaAfter'], schema['migrationChanges']) == (28, '28.1', True):
        issue_date_migration_acceptance((migration_root / ISSUE_DATE_MIGRATION).read_bytes())
    if schema['schemaAfter'] == 31:
        publication_migration_acceptance((migration_root / 'V31__recommendation_item_publication.sql').read_bytes())
        if schema['schemaBefore'] == '28.1':
            issue_date_migration_acceptance((migration_root / ISSUE_DATE_MIGRATION).read_bytes())
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
            classes = {path: hashlib.sha256(common.read(path)).hexdigest() for path in required_classes}
            browse_record = common.read('com/bobbuy/service/PublicProductBrowseService$Browse.class')
            if b'markedScopeTotal' not in browse_record:
                raise RuntimeError('Core lacks the accepted full-scope marked count')
    if accepted.get('previousProductionCoreJarSha256') and digest(core_jar) == accepted['previousProductionCoreJarSha256']:
        raise RuntimeError('Old production core was supplied for the new batch')
    web_files = files(web)
    archive = output / 'images.tar'
    subprocess.run(['docker', 'save', '--output', str(archive), *[e['tag'] for e in images]], check=True)
    manifest = {'source': source, 'version': 'ci-' + source, 'acceptedApplicationSourceDigest': accepted['sourceDigest'],
                'acceptedSourceFileCount': len(accepted['sourceFiles']), 'requiredBackendClassCount': len(required_classes),
                'repository': os.environ.get('GITHUB_REPOSITORY'), 'runId': os.environ.get('GITHUB_RUN_ID'),
                'runAttempt': os.environ.get('GITHUB_RUN_ATTEMPT'), 'images': images,
                'archiveSha256': digest(archive), 'archiveBytes': archive.stat().st_size,
                'coreJarSha256': digest(core_jar), 'coreJarBytes': core_jar.stat().st_size,
                'coreClassHashes': classes, 'coreClassesMatchLocalAcceptedCompile': classes == expected_classes if expected_classes is not None else None,
                'frontendIndexSha256': digest(web / 'index.html'), 'frontendFiles': web_files,
                'frontendMatchesAcceptedBytes': web_files == accepted['frontendFiles'] if accepted.get('frontendFiles') is not None else None,
                'nginxSha256': digest(output / 'frontend-nginx.conf'),
                **schema, 'migrationBaseline': accepted.get('migrationBaseline'),
                'migrations': accepted['migrations'], 'independentApplicationQa': accepted['qa'],
                'independentArtifactQa': 'PENDING', 'productionStaged': False, 'productionActivated': False,
                'rollback': rollback_description(schema), 'recoveryGate': recovery_contract(schema),
                'byteDifferencePolicy': 'Source is exact. Any compile/web byte differences require explicit artifact QA binding; no equality is inferred.'}
    (output / 'artifact.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({k: manifest[k] for k in ['source', 'archiveBytes', 'archiveSha256', 'coreJarSha256',
                                            'frontendIndexSha256', 'coreClassesMatchLocalAcceptedCompile', 'frontendMatchesAcceptedBytes']}))


if __name__ == '__main__':
    main()
