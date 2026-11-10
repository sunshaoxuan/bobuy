"""Verify only the pinned V28->28.1 change on the existing explicit hosted-CI PostgreSQL service."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import zlib

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('checkout_upgrade', Path(__file__).with_name('verify-checkout-upgrade.py'))
c2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c2)
URL, require_isolated_ci, sql, migrate, columns, fingerprints = c2.URL, c2.require_isolated_ci, c2.sql, c2.migrate, c2.columns, c2.fingerprints
BASELINE = 'docs/reports/c2-cart-20261109/accepted-inputs.json'
BASELINE_SHA256 = '48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba'
MIGRATION = 'V28_1__recommendation_issue_date.sql'
MIGRATION_SHA256 = 'd742bea25cb8ef3d205c9e2a4992d25024a372b5ab9dc38dc915f0ebbb91224e'
CONSTRAINT = 'ck_recommendation_issue_date_review'
POST_ID, ITEM_ID, ARTICLE_ID, QUOTE_ID = -281001, -281002, -281003, -281004
IMAGE_ID = 'ci-issue-date-image'
REPORT = 'backend/target/issue-date-upgrade-preservation.json'
TYPES = {'issue_date': ('date', 'date', None), 'issue_date_source_ref': ('character varying', 'varchar', 2048),
         'issue_date_source_hash': ('character varying', 'varchar', 64), 'issue_date_reviewed_by': ('bigint', 'int8', None),
         'issue_date_reviewed_at': ('timestamp with time zone', 'timestamptz', None)}


def sha(value):
    return hashlib.sha256(value).hexdigest()


def migration_checksum(value):
    result = 0
    for line in value.decode('utf-8-sig').splitlines():
        result = zlib.crc32(line.encode('utf-8'), result)
    return result if result < 2**31 else result - 2**32


def verify_migration_inputs():
    raw = (ROOT / BASELINE).read_bytes()
    if sha(raw) != BASELINE_SHA256:
        raise RuntimeError('Immutable accepted C2 V28 baseline bytes required')
    baseline = json.loads(raw)
    if (baseline.get('schemaBefore'), baseline.get('schemaAfter'), baseline.get('migrationChanges')) != (27, 28, True) or len(baseline['migrations']) != 27:
        raise RuntimeError('Expected exact C2 V28 migration baseline')
    expected = {entry['path']: entry['sha256'] for entry in baseline['migrations']}
    expected[MIGRATION] = MIGRATION_SHA256
    actual = {path.name: sha(path.read_bytes()) for path in (ROOT / 'backend/src/main/resources/db/migration').iterdir() if path.is_file()}
    if actual != expected:
        raise RuntimeError('Old migration drift or missing/unknown/unpinned issue-date migration')
    return baseline


def history():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY installed_rank),'[]') FROM (SELECT installed_rank,version,script,checksum,success FROM flyway_schema_history ORDER BY installed_rank) x;"))


def require_v28_history(rows, baseline, c2_proof):
    projected = [{key: value for key, value in row.items() if key != 'checksum'} for row in rows]
    if (c2_proof.get('scope') != 'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY' or c2_proof.get('status') != 'PASS'
            or (c2_proof.get('schemaBefore'), c2_proof.get('schemaAfter'), c2_proof.get('businessTables')) != (27, 28, 38)
            or not c2_proof.get('allOldColumnsAndValuesPreserved') or projected != c2_proof.get('migrationHistory')
            or len(rows) != 27 or rows[-1]['version'] != '28' or not all(row['success'] for row in rows)):
        raise RuntimeError('Fresh successful C2 V28 proof/history required before this forward-only gate')
    expected = {entry['path']: entry for entry in baseline['migrations']}
    if {row['script'] for row in rows} != set(expected):
        raise RuntimeError('C2 migration discovery/history differs')
    for row in rows:
        name = row['script']; match = re.fullmatch(r'V(\d+)__.+\.sql', name)
        if match is None or row['version'] != str(int(match.group(1))) or row['checksum'] != migration_checksum((ROOT / 'backend/src/main/resources/db/migration' / name).read_bytes()):
            raise RuntimeError('Prior Flyway version/script/checksum changed')


def require_history(before, after):
    expected = {'installed_rank': before[-1]['installed_rank'] + 1, 'version': '28.1', 'script': MIGRATION,
                'checksum': migration_checksum((ROOT / 'backend/src/main/resources/db/migration' / MIGRATION).read_bytes()), 'success': True}
    if after != before + [expected]:
        raise RuntimeError('Flyway history must retain its full prefix and add exactly one successful pinned 28.1 row')


def indexes():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY tablename,indexname),'[]') FROM (SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename<>'flyway_schema_history') x;"))


def constraints():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY table_name,name),'[]') FROM (SELECT c.relname table_name,x.conname name,x.contype type,x.convalidated validated,x.condeferrable deferrable,x.condeferred deferred,pg_get_constraintdef(x.oid) definition FROM pg_constraint x JOIN pg_class c ON x.conrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname<>'flyway_schema_history' AND x.contype IN ('p','u','f','c')) x;"))


def normalized_constraint(value):
    value = value.lower()
    value = re.sub(r'\btrim\s*\(\s*both\s+from\s+', 'btrim(', value)
    value = re.sub(r'\btrim\s*\(', 'btrim(', value)
    value = re.sub(r'::(?:character varying|text|bigint|integer)', '', value)
    return re.sub(r'[\s()\"\']', '', value)


def expected_constraint():
    text = (ROOT / 'backend/src/main/resources/db/migration' / MIGRATION).read_text()
    return text.split('ADD CONSTRAINT ' + CONSTRAINT + ' ', 1)[1].strip().removesuffix(';')


def assert_preserved(before_columns, after_columns, before_rows, after_rows, before_indexes, after_indexes, before_constraints, after_constraints):
    old_names = {(row['table_name'], row['column_name']) for row in before_columns}
    kept = [row for row in after_columns if (row['table_name'], row['column_name']) in old_names]
    added = [row for row in after_columns if (row['table_name'], row['column_name']) not in old_names]
    actual_types = {row['column_name']: (row['data_type'], row['udt_name'], row['character_maximum_length']) for row in added}
    if (kept != before_columns or before_rows != after_rows or len(added) != 5 or actual_types != TYPES
            or any(row['table_name'] != 'bb_recommendation_post' or row['is_nullable'] != 'YES' or row['column_default'] is not None for row in added)):
        raise RuntimeError('V28.1 changed old schema/values or its exact five-nullable-column contract')
    last = max(row['ordinal_position'] for row in before_columns if row['table_name'] == 'bb_recommendation_post')
    if [row['column_name'] for row in sorted(added, key=lambda row: row['ordinal_position'])] != list(TYPES) or sorted(row['ordinal_position'] for row in added) != list(range(last + 1, last + 6)):
        raise RuntimeError('Unexpected appended date-column order')
    if after_indexes != before_indexes:
        raise RuntimeError('Historical indexes changed or an unaccepted index was added')
    new = [row for row in after_constraints if row['name'] == CONSTRAINT and row['table_name'] == 'bb_recommendation_post']
    old = [row for row in after_constraints if row not in new]
    if (old != before_constraints or len(new) != 1 or new[0]['type'] != 'c' or not new[0]['validated']
            or new[0]['deferrable'] or new[0]['deferred'] or normalized_constraint(new[0]['definition']) != normalized_constraint(expected_constraint())):
        raise RuntimeError('Historical constraints changed or reviewed-date completeness constraint differs')


def fixture_payloads():
    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
    image_hash = sha(png); url = '/api/storefront/recommendation-images/' + IMAGE_ID
    context = {'supplierKey': 'SYNTHETIC', 'channel': 'COSTCO_WAREHOUSE', 'variantKey': 'synthetic-source-pack',
               'sourceMessageKey': 'message:ci-issue-date-source', 'sourceUrl': 'https://example.invalid/ci-source',
               'activityStart': '2026-10-01', 'activityEnd': '2026-10-31', 'activityApplies': True,
               'windowEvidence': 'SYNTHETIC explicit source header', 'startSearchComplete': True}
    gallery = [{'id': IMAGE_ID, 'url': url, 'hash': image_hash, 'sourceUrl': context['sourceUrl'],
                'assetKey': 'ci-issue-date.png', 'label': 'SYNTHETIC original', 'verifiedAt': '2026-01-01T00:00:00Z'}]
    article = {'sourceLocale': 'ja-JP', 'title': 'SYNTHETIC retained issue', 'body': 'SYNTHETIC retained source body', 'translations': {}}
    quote = {'name': 'SYNTHETIC retained item', 'itemNumber': 'CI-ISSUE-DATE', 'productId': None, 'sourceImageHash': image_hash,
             'sourceImageUrl': url, 'referencePrice': 265, 'originalPrice': 300, 'discountAmount': 35, 'priceUnit': 'pack',
             'offerStart': '2026-10-01', 'offerEnd': '2026-10-31', 'couponStart': None, 'couponEnd': None,
             'offerNotes': 'SYNTHETIC retained condition', 'context': context}
    return {'png': png, 'imageHash': image_hash, 'url': url, 'context': context, 'gallery': gallery, 'article': article, 'quote': quote}


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def seed_v28():
    p = fixture_payloads(); compact = lambda value: json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    article, quote = compact(p['article']), compact(p['quote'])
    sql(f"""BEGIN;
INSERT INTO bb_user(id,name,username,roles,email) VALUES({POST_ID},'SYNTHETIC issue-date merchant','ci-issue-date-agent','["AGENT"]'::jsonb,'ci-issue-date@example.invalid');
INSERT INTO bb_recommendation_post(id,merchant_id,title,body,published,published_at,publisher_id,publisher_name,article_source_locale,article_translations)
 VALUES({POST_ID},{POST_ID},'SYNTHETIC retained issue','SYNTHETIC retained source body',true,'2026-01-01T00:00:00Z',{POST_ID},'SYNTHETIC merchant','ja-JP','{{}}'::jsonb);
INSERT INTO bb_recommendation_image(id,merchant_id,image_hash,content_type,content,raw_sha256,byte_length)
 VALUES('{IMAGE_ID}',{POST_ID},'{p['imageHash']}','image/png',decode('{p['png'].hex()}','hex'),'{p['imageHash']}',{len(p['png'])});
INSERT INTO bb_recommendation_item(id,post_id,name,item_number,reference_price,original_price,discount_amount,price_unit,offer_start,offer_end,offer_notes,specification,description,image_hash,image_url,gallery,offer_identity,reference_context)
 VALUES({ITEM_ID},{POST_ID},'SYNTHETIC retained item','CI-ISSUE-DATE',265,300,35,'pack','2026-10-01','2026-10-31','SYNTHETIC retained condition','24 cartons','SYNTHETIC reference only','{p['imageHash']}','{p['url']}',{literal(compact(p['gallery']))}::jsonb,repeat('e',64),{literal(compact(p['context']))}::jsonb);
INSERT INTO bb_recommendation_article_revision(id,merchant_id,post_id,facts_hash,facts,recorded_at)
 VALUES({ARTICLE_ID},{POST_ID},{POST_ID},'{sha(article.encode())}',{literal(article)}::jsonb,'2026-01-01T00:00:00Z');
INSERT INTO bb_reference_quote_revision(id,merchant_id,post_id,item_id,facts_hash,facts,recorded_at)
 VALUES({QUOTE_ID},{POST_ID},{POST_ID},{ITEM_ID},'{sha(quote.encode())}',{literal(quote)}::jsonb,'2026-01-01T00:00:00Z');
COMMIT;""")


def fixture_state():
    result = {}
    for table, condition in [('bb_user', f'id={POST_ID}'), ('bb_recommendation_post', f'id={POST_ID}'),
                             ('bb_recommendation_item', f'id={ITEM_ID}'), ('bb_recommendation_image', "id='" + IMAGE_ID + "'"),
                             ('bb_recommendation_article_revision', f'id={ARTICLE_ID}'), ('bb_reference_quote_revision', f'id={QUOTE_ID}')]:
        result[table] = json.loads(sql(f"SELECT coalesce(json_agg(x),'[]') FROM (SELECT * FROM {table} WHERE {condition}) x;"))
    return result


def cleanup_own_fixture(proof_path):
    require_isolated_ci(os.environ)  # Before any connection, including reads.
    raw = Path(proof_path).read_bytes(); proof = json.loads(raw)
    if (proof.get('scope'), proof.get('status'), proof.get('schemaAfter'), proof.get('migrationSha256')) != ('EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY', 'PASS', '28.1', MIGRATION_SHA256) or fixture_state() != proof.get('fixtureAfterUpgrade'):
        raise RuntimeError('Immutable migration proof and exact unchanged owned fixture required for cleanup')
    sql(f"""BEGIN;
DELETE FROM bb_recommendation_item WHERE id={ITEM_ID} AND post_id={POST_ID};
DELETE FROM bb_recommendation_post WHERE id={POST_ID} AND merchant_id={POST_ID};
DELETE FROM bb_recommendation_image WHERE id='{IMAGE_ID}' AND merchant_id={POST_ID};
DELETE FROM bb_user WHERE id={POST_ID} AND username='ci-issue-date-agent';
COMMIT;""")
    state = fixture_state()
    if any(state[table] for table in ['bb_user', 'bb_recommendation_post', 'bb_recommendation_item', 'bb_recommendation_image']) or any(state[table] != proof['fixtureAfterUpgrade'][table] for table in ['bb_recommendation_article_revision', 'bb_reference_quote_revision']):
        raise RuntimeError('Owned fixture dependencies were not released or retained history changed')
    rows = fingerprints(proof['beforeColumns'])
    if any(value != proof['afterFingerprints'][table] for table, value in rows.items() if table not in {'bb_user', 'bb_recommendation_post', 'bb_recommendation_item', 'bb_recommendation_image'}):
        raise RuntimeError('A table unrelated to the owned fixture cleanup changed')
    receipt = {'status': 'PASS_OWN_FIXTURE_DEPENDENCIES_REMOVED_AFTER_IMMUTABLE_PROOF', 'migrationProofSha256': sha(raw),
               'retainedArticleAndQuoteHistory': True, 'unrelatedTablesUnchanged': True, 'businessDatasourceUsed': False}
    target = ROOT / 'backend/target/surefire-reports/issue-date-fixture-cleanup.json'; target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x') as out:
        json.dump(receipt, out, indent=2); out.write('\n')


def main():
    require_isolated_ci(os.environ)  # Before any command, database connection, seed, or cleanup.
    baseline = verify_migration_inputs()
    output = ROOT / REPORT
    if output.exists():
        raise RuntimeError('Preserve/reconcile the existing gate outcome instead of repeating it')
    c2_proof = json.loads((ROOT / 'backend/target/c2-upgrade-preservation.json').read_bytes())
    before_history = history(); require_v28_history(before_history, baseline, c2_proof)
    seed_v28()
    before_columns, before_indexes, before_constraints = columns(), indexes(), constraints()
    before_rows = fingerprints(before_columns)
    if len(before_rows) != 38 or not all(len(rows) == 1 for rows in fixture_state().values()):
        raise RuntimeError('Expected 38 prior business tables and exact representative synthetic source/image/history fixture')
    migrate('28.1')  # No clean/reset/restore. The preceding existing C2 gate already established V28.
    after_columns, after_indexes, after_constraints, after_history = columns(), indexes(), constraints(), history()
    after_rows = fingerprints(before_columns)
    assert_preserved(before_columns, after_columns, before_rows, after_rows, before_indexes, after_indexes, before_constraints, after_constraints)
    require_history(before_history, after_history)
    nulls = sql(f"SELECT count(*) FROM bb_recommendation_post WHERE id={POST_ID} AND " + ' AND '.join(name + ' IS NULL' for name in TYPES) + ';')
    if nulls != '1':
        raise RuntimeError('Legacy source date must stay wholly unknown after upgrade')
    report = {'scope': 'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY', 'status': 'PASS', 'schemaBefore': 28, 'schemaAfter': '28.1',
              'businessTables': 38, 'migrationBaselineSha256': BASELINE_SHA256, 'migrationSha256': MIGRATION_SHA256,
              'allOldColumnsAndValuesPreserved': True, 'newHistoricalColumnsNull': True, 'oldIndexesAndConstraintsPreserved': True,
              'newCompletenessConstraintVerified': True, 'migrationAppliedOnce': True, 'businessDatasourceUsed': False,
              'databaseRestored': False, 'old82ApplicationBoot': 'NOT_RUN', 'oldPostMappingAndOldFlywayRuntime': 'PENDING_CI_JAVA_TESTS',
              'beforeColumns': before_columns, 'afterColumns': after_columns, 'beforeFingerprints': before_rows, 'afterFingerprints': after_rows,
              'beforeIndexes': before_indexes, 'afterIndexes': after_indexes, 'beforeConstraints': before_constraints, 'afterConstraints': after_constraints,
              'beforeHistory': before_history, 'afterHistory': after_history, 'fixtureAfterUpgrade': fixture_state()}
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as out:
        json.dump(report, out, indent=2); out.write('\n')
    print(json.dumps({key: value for key, value in report.items() if key not in {'beforeColumns', 'afterColumns', 'beforeFingerprints', 'afterFingerprints', 'beforeIndexes', 'afterIndexes', 'beforeConstraints', 'afterConstraints', 'beforeHistory', 'afterHistory', 'fixtureAfterUpgrade'}}))
    cleanup_own_fixture(output)


if __name__ == '__main__':
    main()
