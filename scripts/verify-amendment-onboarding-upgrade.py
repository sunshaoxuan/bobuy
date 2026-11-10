"""Populated V28->V29->V30 preservation on the existing explicit hosted CI PG service only."""
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
URL = c2.URL
require_isolated_ci = c2.require_isolated_ci
sql = c2.sql
migrate = c2.migrate
columns = c2.columns
fingerprints = c2.fingerprints
BASELINE = 'docs/reports/c2-cart-20261109/accepted-inputs.json'
BASELINE_SHA256 = '48bbcc808d0a0761e112b720c276592afe52f9979031a9975247065efeb277ba'
ADDED_MIGRATIONS = {
    29: ('V29__customer_order_amendments.sql', '5928444d349efd32b966e406a75346f900c255b4860f79580134fff7ecfb6c14'),
    30: ('V30__costco_onboarding_jobs.sql', '2268952a703b67477075a0bf7ad3c4b1cf71ac08111ab1ddd697a23a1757acde'),
}


def sha(content):
    return hashlib.sha256(content).hexdigest()


def migration_checksum(content):
    value = 0
    for line in content.decode('utf-8-sig').splitlines():
        value = zlib.crc32(line.encode('utf-8'), value)
    return value if value < 2**31 else value - 2**32


def verify_migration_inputs():
    raw = (ROOT / BASELINE).read_bytes()
    if sha(raw) != BASELINE_SHA256:
        raise RuntimeError('Exact accepted C2 baseline bytes required')
    baseline = json.loads(raw)
    if (baseline['schemaBefore'], baseline['schemaAfter'], baseline['migrationChanges']) != (27, 28, True):
        raise RuntimeError('Expected the accepted C2 V28 baseline')
    migration_root = ROOT / 'backend/src/main/resources/db/migration'
    expected = {entry['path']: entry['sha256'] for entry in baseline['migrations']}
    expected.update({name: digest for name, digest in ADDED_MIGRATIONS.values()})
    actual = {p.name: sha(p.read_bytes()) for p in migration_root.iterdir() if p.is_file()}
    if actual != expected:
        raise RuntimeError('Prior migration drift or unknown/missing V29/V30 migration')
    return baseline


def history():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY installed_rank),'[]') FROM "
                         "(SELECT installed_rank,version,script,checksum,success FROM flyway_schema_history ORDER BY installed_rank) x;"))


def require_history(before, after, version):
    if not before or not all(row['success'] for row in before):
        raise RuntimeError('Successful prior Flyway history required')
    name, _ = ADDED_MIGRATIONS[version]
    expected = {'installed_rank': before[-1]['installed_rank'] + 1, 'version': str(version),
                'script': name, 'checksum': migration_checksum((ROOT / 'backend/src/main/resources/db/migration' / name).read_bytes()), 'success': True}
    if after != before + [expected]:
        raise RuntimeError('Flyway history/checksum/rank prefix changed or expected suffix missing')


def indexes():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY tablename,indexname),'[]') FROM "
                         "(SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename<>'flyway_schema_history') x;"))


def constraints():
    return json.loads(sql("SELECT coalesce(json_agg(x ORDER BY table_name,name),'[]') FROM "
        "(SELECT c.relname AS table_name,x.conname AS name,x.contype AS type,x.convalidated AS validated,"
        "x.condeferrable AS deferrable,x.condeferred AS deferred,pg_get_constraintdef(x.oid) AS definition "
        "FROM pg_constraint x JOIN pg_class c ON x.conrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid "
        "WHERE n.nspname='public' AND c.relname<>'flyway_schema_history' AND x.contype IN ('p','u','f','c')) x;"))


def normalized(value):
    value = re.sub(r'::(?:character varying|text|bigint|integer)(?:\[\])?', '', value.lower())
    return re.sub(r'[\s()\"\']', '', value)


def column_contract(table, specifications):
    rows = []
    for ordinal, (name, kind, nullable, default) in enumerate(specifications, 1):
        match = re.fullmatch(r'varchar\((\d+)\)', kind)
        data_type, udt, length = ('character varying', 'varchar', int(match[1])) if match else {
            'bigint': ('bigint', 'int8', None), 'integer': ('integer', 'int4', None), 'jsonb': ('jsonb', 'jsonb', None),
            'timestamp': ('timestamp without time zone', 'timestamp', None),
            'timestamptz': ('timestamp with time zone', 'timestamptz', None), 'bytea': ('bytea', 'bytea', None)}[kind]
        rows.append({'table_name': table, 'column_name': name, 'ordinal_position': ordinal, 'data_type': data_type,
                     'udt_name': udt, 'character_maximum_length': length, 'is_nullable': 'YES' if nullable else 'NO', 'column_default': default})
    return rows


RECEIPT = 'bb_customer_order_amendment'
JOB = 'bb_costco_onboarding_job'
EVIDENCE = 'bb_costco_onboarding_evidence'
COMMIT = 'bb_costco_onboarding_commit'
NEW_COLUMNS = {
    RECEIPT: column_contract(RECEIPT, [('id','varchar(128)',False,None),('customer_id','bigint',False,None),
        ('request_id','varchar(36)',False,None),('order_id','bigint',False,None),('payload_hash','varchar(64)',False,None),
        ('original_order','jsonb',False,None),('result_view','jsonb',False,None),('created_at','timestamp',False,None)]),
    JOB: column_contract(JOB, [('id','varchar(36)',False,None),('merchant_id','bigint',False,None),('supplier_id','varchar(100)',False,None),
        ('market','varchar(2)',False,None),('idempotency_key','varchar(64)',False,None),('input_hash','varchar(64)',False,None),
        ('revision','bigint',False,'0'),('state','varchar(24)',False,None),('payload','jsonb',False,None),
        ('attempt_history','jsonb',False,"'[]'::jsonb"),('attempts','integer',False,'0'),('lease_token','varchar(36)',True,None),
        ('lease_until','timestamptz',True,None),('next_run_at','timestamptz',False,'CURRENT_TIMESTAMP'),
        ('created_at','timestamptz',False,'CURRENT_TIMESTAMP'),('updated_at','timestamptz',False,'CURRENT_TIMESTAMP')]),
    EVIDENCE: column_contract(EVIDENCE, [('merchant_id','bigint',False,None),('sha256','varchar(64)',False,None),
        ('supplier_id','varchar(100)',True,None),('input_hash','varchar(64)',True,None),('kind','varchar(20)',False,None),
        ('content_type','varchar(255)',False,None),('content','bytea',False,None),('receipt','jsonb',True,None),
        ('created_at','timestamptz',False,'CURRENT_TIMESTAMP')]),
    COMMIT: column_contract(COMMIT, [('idempotency_key','varchar(64)',False,None),('merchant_id','bigint',False,None),
        ('candidate_hash','varchar(64)',False,None),('product_id','varchar(255)',False,None),('product_version','bigint',False,None),
        ('created_at','timestamptz',False,'CURRENT_TIMESTAMP')]),
}
NEW_CONSTRAINTS = {
    RECEIPT: {'bb_customer_order_amendment_pkey': ('p','PRIMARY KEY (id)'),
              'uk_customer_order_amendment_request': ('u','UNIQUE (customer_id, request_id)')},
    JOB: {'bb_costco_onboarding_job_pkey': ('p','PRIMARY KEY (id)'),
          'bb_costco_onboarding_job_idempotency_key_key': ('u','UNIQUE (idempotency_key)'),
          'bb_costco_onboarding_job_revision_check': ('c','CHECK (revision >= 0)'),
          'bb_costco_onboarding_job_attempts_check': ('c','CHECK (attempts >= 0)'),
          'bb_costco_onboarding_job_state_check': ('c',"CHECK (state = ANY (ARRAY['QUEUED','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW','COMMITTING','COMPLETED','NEEDS_INPUT','RETRY_WAIT','FAILED','CANCELLED']))")},
    EVIDENCE: {'bb_costco_onboarding_evidence_pkey': ('p','PRIMARY KEY (merchant_id, sha256)'),
               'bb_costco_onboarding_evidence_kind_check': ('c',"CHECK (kind = ANY (ARRAY['PRIVATE_PHOTO','OFFICIAL_EVIDENCE']))"),
               'bb_costco_onboarding_evidence_content_check': ('c','CHECK (octet_length(content)>0 AND octet_length(content)<=8388608)')},
    COMMIT: {'bb_costco_onboarding_commit_pkey': ('p','PRIMARY KEY (idempotency_key)'),
             'bb_costco_onboarding_commit_idempotency_key_fkey': ('f','FOREIGN KEY (idempotency_key) REFERENCES bb_costco_onboarding_job(idempotency_key)'),
             'bb_costco_onboarding_commit_product_id_fkey': ('f','FOREIGN KEY (product_id) REFERENCES bb_product(id)')},
}


def assert_stage(before_columns, after_columns, before_rows, after_rows, before_indexes, after_indexes,
                 before_constraints, after_constraints, version):
    added_tables = {RECEIPT} if version == 29 else {JOB,EVIDENCE,COMMIT} if version == 30 else set()
    if not added_tables:
        raise RuntimeError('Only V29 then V30 may be verified')
    old_names = {(row['table_name'],row['column_name']) for row in before_columns}
    if ([row for row in after_columns if (row['table_name'],row['column_name']) in old_names] != before_columns
            or before_rows != after_rows):
        raise RuntimeError('Historical schema or old-column values changed')
    expected_columns = [row for table in sorted(added_tables) for row in NEW_COLUMNS[table]]
    if version == 29:
        revision = column_contract('bb_order_header',[('order_revision','bigint',False,'0')])[0]
        revision['ordinal_position'] = max(row['ordinal_position'] for row in before_columns if row['table_name']=='bb_order_header')+1
        expected_columns.append(revision)
    added = [row for row in after_columns if (row['table_name'],row['column_name']) not in old_names]
    if sorted(added,key=lambda row:(row['table_name'],row['ordinal_position'])) != sorted(expected_columns,key=lambda row:(row['table_name'],row['ordinal_position'])):
        raise RuntimeError('Unexpected added schema/default/type/nullability')
    if [row for row in after_indexes if row['tablename'] not in added_tables] != before_indexes:
        raise RuntimeError('Historical indexes changed')
    expected_index_names = {name for table in added_tables for name,(kind,_) in NEW_CONSTRAINTS[table].items() if kind in {'p','u'}}
    expected_index_names |= {'bb_costco_onboarding_pending','bb_costco_onboarding_owner'} if version == 30 else set()
    new_indexes = [row for row in after_indexes if row['tablename'] in added_tables]
    if {row['indexname'] for row in new_indexes} != expected_index_names or len(new_indexes)!=len(expected_index_names):
        raise RuntimeError('Unexpected new indexes')
    for name,fields in [('bb_costco_onboarding_pending','state,next_run_at'),('bb_costco_onboarding_owner','merchant_id,updated_atdesc')]:
        if version==30 and normalized(next(row['indexdef'] for row in new_indexes if row['indexname']==name)) != normalized('CREATE INDEX '+name+' ON public.'+JOB+' USING btree ('+fields+')'):
            raise RuntimeError('Unexpected pending/ownership index definition')
    if [row for row in after_constraints if row['table_name'] not in added_tables] != before_constraints:
        raise RuntimeError('Historical constraints changed')
    expected_constraints = {(table,name):(kind,normalized(definition)) for table in added_tables for name,(kind,definition) in NEW_CONSTRAINTS[table].items()}
    actual_constraints = {(row['table_name'],row['name']):(row['type'],normalized(row['definition'])) for row in after_constraints if row['table_name'] in added_tables}
    if actual_constraints!=expected_constraints or any(not row['validated'] or row['deferrable'] or row['deferred'] for row in after_constraints if row['table_name'] in added_tables):
        raise RuntimeError('Unexpected new constraint definition or validation state')


def seed_v28():
    sql("""BEGIN;
INSERT INTO bb_user(id,name,username,roles,email,default_address) VALUES
 (-293001,'Synthetic C3/R13 merchant','ci-c3-r13-agent','["AGENT"]'::jsonb,'ci-c3-r13-agent@example.invalid',NULL),
 (-293002,'Synthetic historical customer','ci-c3-r13-customer','["CUSTOMER"]'::jsonb,'ci-c3-r13-customer@example.invalid','{"contactName":"Synthetic original","countryRegion":"JP","city":"Tokyo","addressLine":"Synthetic street"}'::jsonb);
INSERT INTO bb_product(id,merchant_id,name,item_number,base_price,currency,record_version,catalog_data)
 VALUES('ci-c3-r13-historical-product',-293001,'{"en-US":"Synthetic historical product"}'::jsonb,'CI-293001',61.75,'JPY',2,'{"specification":{"en-US":"Synthetic historical pack"},"model":"CI-HISTORICAL","packaging":"Synthetic box","categoryIds":[],"supplierId":null,"translatedSource":null,"reviewedBy":null,"reviewedAt":null}'::jsonb);
INSERT INTO bb_product_lifecycle_event(id,product_id,action,actor_id,occurred_at)
 VALUES('ci-c3-r13-lifecycle-history','ci-c3-r13-historical-product','RESTORE',-293001,'2026-01-01T00:00:00Z');
INSERT INTO bb_product_catalog_recovery(id,merchant_id,product_id,version_after,created_at,original)
 VALUES('ci-c3-r13-catalog-history',-293001,'ci-c3-r13-historical-product',2,'2026-01-01T00:00:00Z','{"name":{"en-US":"Synthetic previous product"},"description":{"en-US":"Synthetic retained catalog history"},"itemNumber":"CI-293001","brand":"Synthetic","categoryId":null,"catalogData":{"specification":{"en-US":"Synthetic previous pack"},"model":"CI-PRIOR","packaging":"Synthetic box","categoryIds":[],"supplierId":null,"translatedSource":null,"reviewedBy":null,"reviewedAt":null},"gallery":[],"sourceItemIds":[]}'::jsonb);
INSERT INTO bb_order_header(id,business_id,customer_id,status,payment_status,delivery_status,total_amount,currency,lines,product_identities,delivery_snapshot,checkout_payload_hash)
 VALUES(-293003,'CI-C3-R13-V28-HISTORICAL',-293002,'NEW','UNPAID','PENDING_DELIVERY',123.5,'JPY',
 '[{"id":-293004,"skuId":"ci-c3-r13-historical-product","itemName":"Synthetic historical","spec":"pack","quantity":2,"unitPrice":61.75}]'::jsonb,
 '{"-293004":{"skuId":"ci-c3-r13-historical-product","itemName":"Synthetic historical","names":{},"brand":"Synthetic","itemNumber":"CI-293001","model":"CI-HISTORICAL","packaging":"Synthetic box","specifications":{"en-US":"Synthetic historical pack"},"saleUnit":"pack"}}'::jsonb,
 '{"version":1,"contactName":"Synthetic original","countryRegion":"JP","city":"Tokyo","addressLine":"Synthetic street","phone":"synthetic-phone"}'::jsonb,
 repeat('a',64));
COMMIT;""")


FIXTURE_DEPENDENCIES = {
    'product': [{'id': 'ci-c3-r13-historical-product', 'merchant_id': -293001}],
    'lifecycle': [{'id': 'ci-c3-r13-lifecycle-history', 'product_id': 'ci-c3-r13-historical-product', 'action': 'RESTORE', 'actor_id': -293001}],
    'catalog': [{'id': 'ci-c3-r13-catalog-history', 'product_id': 'ci-c3-r13-historical-product', 'merchant_id': -293001, 'version_after': 2}],
}
FIXTURE_DELETED = {'lifecycle': ['ci-c3-r13-lifecycle-history'], 'catalog': ['ci-c3-r13-catalog-history']}


def cleanup_fixture_dependencies(proof_path):
    """After immutable migration proof, release only our two FK dependencies.

    This is not business seed behavior. It is confined to the same explicitly
    permitted, ephemeral hosted-CI database and leaves product/order/user rows.
    """
    require_isolated_ci(os.environ)  # Before even a read query.
    proof_path = Path(proof_path)
    # Existing workflow uploads this whole directory; keep the new receipt without
    # changing the immutable preservation report or broadening workflow permissions.
    receipt_path = proof_path.parent / 'surefire-reports' / 'c3-r13-fixture-cleanup.json'
    raw = proof_path.read_bytes()
    proof = json.loads(raw)
    initial = proof.get('initialFingerprints', {})
    if (proof.get('scope') != 'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY'
            or proof.get('status') != 'PASS' or proof.get('schemaBefore') != 28 or proof.get('schemaAfter') != 30
            or proof.get('schemaStages') != [29, 30] or proof.get('originalBusinessTables') != 38 or proof.get('businessTables') != 42
            or proof.get('migrationBaselineSha256') != BASELINE_SHA256
            or proof.get('allOldColumnsAndValuesPreserved') is not True or proof.get('businessDatasourceUsed') is not False
            or proof.get('noDatabaseRestore') is not True or len(initial) != 38
            or proof.get('finalOldColumnFingerprints') != initial
            or len(proof.get('stages', [])) != 2
            or any(stage.get('status') != 'PASS' or stage.get('schemaAfter') != version
                   or stage.get('allOldColumnsAndValuesPreserved') is not True
                   for stage, version in zip(proof.get('stages', []), [29, 30]))):
        raise RuntimeError('Completed unchanged populated migration proof required before fixture cleanup')
    if receipt_path.exists():
        raise RuntimeError('Existing cleanup receipt must not be overwritten or replayed')
    observed = json.loads(sql("""SELECT json_build_object(
 'product',(SELECT coalesce(json_agg(x),'[]') FROM (SELECT id,merchant_id FROM bb_product WHERE id='ci-c3-r13-historical-product') x),
 'lifecycle',(SELECT coalesce(json_agg(x ORDER BY id),'[]') FROM (SELECT id,product_id,action,actor_id FROM bb_product_lifecycle_event WHERE product_id='ci-c3-r13-historical-product' OR id='ci-c3-r13-lifecycle-history') x),
 'catalog',(SELECT coalesce(json_agg(x ORDER BY id),'[]') FROM (SELECT id,product_id,merchant_id,version_after FROM bb_product_catalog_recovery WHERE product_id='ci-c3-r13-historical-product' OR id='ci-c3-r13-catalog-history') x));"""))
    if observed != FIXTURE_DEPENDENCIES:
        raise RuntimeError('Unexpected synthetic fixture dependency identity or count; refuse cleanup')
    deleted = json.loads(sql("""BEGIN;
DO $fixture_cleanup$
DECLARE removed_lifecycle text; removed_catalog text;
BEGIN
 PERFORM 1 FROM bb_product WHERE id='ci-c3-r13-historical-product' AND merchant_id=-293001 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unexpected synthetic product owner'; END IF;
 IF (SELECT count(*) FROM bb_product_lifecycle_event WHERE product_id='ci-c3-r13-historical-product')<>1
    OR (SELECT count(*) FROM bb_product_lifecycle_event WHERE id='ci-c3-r13-lifecycle-history' AND product_id='ci-c3-r13-historical-product' AND actor_id=-293001 AND action='RESTORE')<>1
    OR (SELECT count(*) FROM bb_product_catalog_recovery WHERE product_id='ci-c3-r13-historical-product')<>1
    OR (SELECT count(*) FROM bb_product_catalog_recovery WHERE id='ci-c3-r13-catalog-history' AND product_id='ci-c3-r13-historical-product' AND merchant_id=-293001 AND version_after=2)<>1
 THEN RAISE EXCEPTION 'Synthetic dependency changed before deletion'; END IF;
 DELETE FROM bb_product_lifecycle_event WHERE id='ci-c3-r13-lifecycle-history' AND product_id='ci-c3-r13-historical-product' AND actor_id=-293001 AND action='RESTORE' RETURNING id INTO removed_lifecycle;
 IF removed_lifecycle IS DISTINCT FROM 'ci-c3-r13-lifecycle-history' THEN RAISE EXCEPTION 'Unexpected lifecycle deletion'; END IF;
 DELETE FROM bb_product_catalog_recovery WHERE id='ci-c3-r13-catalog-history' AND product_id='ci-c3-r13-historical-product' AND merchant_id=-293001 AND version_after=2 RETURNING id INTO removed_catalog;
 IF removed_catalog IS DISTINCT FROM 'ci-c3-r13-catalog-history' THEN RAISE EXCEPTION 'Unexpected catalog deletion'; END IF;
END;
$fixture_cleanup$;
SELECT json_build_object('lifecycle',ARRAY['ci-c3-r13-lifecycle-history'],'catalog',ARRAY['ci-c3-r13-catalog-history']);
COMMIT;"""))
    if deleted != FIXTURE_DELETED or proof_path.read_bytes() != raw:
        raise RuntimeError('Unexpected cleanup result or changed migration proof; no cleanup PASS receipt')
    receipt = {'scope': 'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY', 'stage': 'POST_PRESERVATION_FIXTURE_DEPENDENCIES_ONLY',
               'status': 'PASS', 'preservationProofFile': proof_path.name, 'preservationProofSha256': sha(raw), 'preservationProofUnchanged': True,
               'deleted': deleted, 'productOrderUserRowsRetained': True, 'businessDatasourceUsed': False}
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    with receipt_path.open('x', encoding='utf-8') as output:
        output.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt))
    return receipt


def main():
    require_isolated_ci(os.environ)  # Before any connection, seed, Maven or SQL.
    baseline = verify_migration_inputs()
    migrate(28)  # Same ephemeral service; no new database, restore or clean.
    before_history = history()
    expected_history = [{'installed_rank': rank, 'version': re.match(r'V(\d+)__',entry['path']).group(1),
                         'script': entry['path'], 'checksum': migration_checksum((ROOT/'backend/src/main/resources/db/migration'/entry['path']).read_bytes()),
                         'success': True}
                        for rank,entry in enumerate(sorted(baseline['migrations'],key=lambda entry:int(re.match(r'V(\d+)__',entry['path']).group(1))),1)]
    if before_history != expected_history or len(before_history)!=27 or before_history[-1]['checksum']!=-1352681989:
        raise RuntimeError('Expected the verified V28 CI database before follow-up fixture writes')
    seed_v28()
    initial_columns = columns()
    initial_rows = fingerprints(initial_columns)
    if len(initial_rows)!=38 or any(not initial_rows[name].startswith('1:') for name in ['bb_product','bb_product_lifecycle_event','bb_product_catalog_recovery']):
        raise RuntimeError('Populated synthetic fixture missing')
    before_columns,before_rows,before_indexes,before_constraints = initial_columns,initial_rows,indexes(),constraints()
    stages=[]
    for version in [29,30]:
        migrate(version)
        after_columns,after_history = columns(),history()
        after_rows = fingerprints(before_columns)
        after_indexes,after_constraints = indexes(),constraints()
        assert_stage(before_columns,after_columns,before_rows,after_rows,before_indexes,after_indexes,before_constraints,after_constraints,version)
        require_history(before_history,after_history,version)
        if sql('SELECT count(*) FROM bb_order_header WHERE order_revision<>0;')!='0':
            raise RuntimeError('Historical order revisions not initialized to zero')
        stages.append({'schemaAfter':version,'status':'PASS','businessTables':len({row['table_name'] for row in after_columns}),
            'allOldColumnsAndValuesPreserved':True,'beforeFingerprints':before_rows,'afterFingerprints':after_rows,
            'beforeHistory':before_history,'afterHistory':after_history,'columns':after_columns,'indexes':after_indexes,'constraints':after_constraints})
        before_columns,before_rows,before_indexes,before_constraints,before_history = after_columns,fingerprints(after_columns),after_indexes,after_constraints,after_history
    final_rows=fingerprints(initial_columns)
    if final_rows!=initial_rows:
        raise RuntimeError('V28 user/product/history/order/snapshot values changed across the full upgrade')
    report={'scope':'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY','status':'PASS','schemaBefore':28,'schemaAfter':30,
        'schemaStages':[29,30],'migrationBaselineSha256':BASELINE_SHA256,'originalBusinessTables':38,'businessTables':42,
        'syntheticFixtures':['users','product','lifecycle history','catalog recovery history','order with V28 delivery snapshot and payload hash'],
        'allOldColumnsAndValuesPreserved':True,'noDatabaseRestore':True,'businessDatasourceUsed':False,
        'initialFingerprints':initial_rows,'finalOldColumnFingerprints':final_rows,'stages':stages}
    output=ROOT/'backend/target/c3-r13-upgrade-preservation.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({key:value for key,value in report.items() if key not in {'initialFingerprints','finalOldColumnFingerprints','stages'}}))
    cleanup_fixture_dependencies(output)


if __name__=='__main__':
    main()
