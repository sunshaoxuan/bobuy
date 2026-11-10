"""Pure negative boundaries only; no PG, JVM, container, network or production calls."""
import copy
import json
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('amendment_onboarding_upgrade',Path(__file__).with_name('verify-amendment-onboarding-upgrade.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AmendmentOnboardingUpgradeTest(unittest.TestCase):
    CI_ENV={'GITHUB_ACTIONS':'true','GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_JOB':'postgres-migration-verify','BOBBUY_ISOLATED_CI_POSTGRES':'true'}

    def cleanup_receipt_path(self, path):
        return path.parent/'surefire-reports'/'c3-r13-fixture-cleanup.json'

    def cleanup_proof(self, directory):
        fingerprints={f'table_{index}': '0:synthetic' for index in range(38)}
        proof={'scope':'EXISTING_EPHEMERAL_HOSTED_CI_POSTGRES_ONLY','status':'PASS','schemaBefore':28,'schemaAfter':30,
               'migrationBaselineSha256':module.BASELINE_SHA256,
               'schemaStages':[29,30],'originalBusinessTables':38,'businessTables':42,'allOldColumnsAndValuesPreserved':True,
               'businessDatasourceUsed':False,'noDatabaseRestore':True,'initialFingerprints':fingerprints,'finalOldColumnFingerprints':fingerprints,
               'stages':[{'schemaAfter':version,'status':'PASS','allOldColumnsAndValuesPreserved':True} for version in [29,30]]}
        path=Path(directory)/'c3-r13-upgrade-preservation.json'
        path.write_text(json.dumps(proof))
        return path,proof

    def setUp(self):
        self.old=[{'table_name':'bb_order_header','column_name':'id','ordinal_position':1,'data_type':'bigint','udt_name':'int8',
                   'character_maximum_length':None,'is_nullable':'NO','column_default':None}]
        self.rows={'bb_order_header':'1:old-snapshot-and-hash'}
        self.revision={**self.old[0],'column_name':'order_revision','ordinal_position':2,'column_default':'0'}

    def stage(self,version):
        tables=[module.RECEIPT] if version==29 else [module.JOB,module.EVIDENCE,module.COMMIT]
        before=self.old if version==29 else self.old+[self.revision]+module.NEW_COLUMNS[module.RECEIPT]
        added=[row for table in tables for row in module.NEW_COLUMNS[table]]+([self.revision] if version==29 else [])
        after=sorted(before+added,key=lambda row:(row['table_name'],row['ordinal_position']))
        before=sorted(before,key=lambda row:(row['table_name'],row['ordinal_position']))
        constraints=[{'table_name':table,'name':name,'type':kind,'validated':True,'deferrable':False,'deferred':False,'definition':definition}
                     for table in tables for name,(kind,definition) in module.NEW_CONSTRAINTS[table].items()]
        indexes=[{'tablename':table,'indexname':name,'indexdef':'unique index from migrated constraint'}
                 for table in tables for name,(kind,_) in module.NEW_CONSTRAINTS[table].items() if kind in {'p','u'}]
        if version==30:
            indexes += [{'tablename':module.JOB,'indexname':'bb_costco_onboarding_pending','indexdef':'CREATE INDEX bb_costco_onboarding_pending ON public.bb_costco_onboarding_job USING btree (state, next_run_at)'},
                        {'tablename':module.JOB,'indexname':'bb_costco_onboarding_owner','indexdef':'CREATE INDEX bb_costco_onboarding_owner ON public.bb_costco_onboarding_job USING btree (merchant_id, updated_at DESC)'}]
        return [before,after,self.rows,self.rows,[],indexes,[],constraints,version]

    def test_only_explicit_original_ci_identity_and_endpoint_are_permitted(self):
        env={'GITHUB_ACTIONS':'true','GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_JOB':'postgres-migration-verify','BOBBUY_ISOLATED_CI_POSTGRES':'true'}
        module.require_isolated_ci(env)
        self.assertEqual(module.URL,'jdbc:postgresql://127.0.0.1:5432/bobbuy')
        for key in env:
            with self.subTest(key=key),self.assertRaises(RuntimeError):
                module.require_isolated_ci({**env,key:'wrong'})

    def test_unapproved_execution_stops_before_any_command_or_connection(self):
        with patch.dict(module.os.environ,{},clear=True),patch.object(module,'verify_migration_inputs') as inputs,patch.object(module,'migrate') as migrate,patch.object(module,'sql') as sql:
            with self.assertRaises(RuntimeError):module.main()
            inputs.assert_not_called();migrate.assert_not_called();sql.assert_not_called()

    def test_correct_additive_stage_shapes_keep_old_projection(self):
        for version in [29,30]:
            with self.subTest(version=version):module.assert_stage(*self.stage(version))

    def test_v28_synthetic_users_use_the_actual_v5_role_set_storage(self):
        # The first real PG run rejected a V1-only `role` column before migration.
        # Check the submitted fixture against the retained role-set migration.
        with patch.object(module,'sql') as sql:
            module.seed_v28()
        fixture=sql.call_args.args[0]
        role_migration=(module.ROOT/'backend/src/main/resources/db/migration/V5__user_role_sets.sql').read_text()
        self.assertIn('DROP COLUMN role',role_migration)
        self.assertIn('username,roles,email',fixture)
        self.assertNotIn('username,role,email',fixture)
        self.assertIn("'[\"AGENT\"]'::jsonb",fixture)
        self.assertIn("'[\"CUSTOMER\"]'::jsonb",fixture)

    def test_catalog_and_recovery_fixture_json_use_real_persisted_record_fields(self):
        # Real PG preservation passed, but its invalid JSON later prevented the
        # transaction group from loading these synthetic historical entities.
        with patch.object(module,'sql') as sql:
            module.seed_v28()
        import json,re
        objects=[json.loads(value) for value in re.findall(r"'([^']*)'::jsonb",sql.call_args.args[0])]
        metadata=[value for value in objects if isinstance(value,dict) and value.get('model')=='CI-HISTORICAL']
        history=[value for value in objects if isinstance(value,dict) and value.get('name',{}).get('en-US')=='Synthetic previous product']
        self.assertEqual(len(metadata),1);self.assertEqual(len(history),1)
        catalog_fields={'specification','model','packaging','categoryIds','supplierId','translatedSource','reviewedBy','reviewedAt'}
        state_fields={'name','description','itemNumber','brand','categoryId','catalogData','gallery','sourceItemIds'}
        self.assertEqual(set(metadata[0]),catalog_fields)
        self.assertEqual(set(history[0]),state_fields)
        self.assertEqual(set(history[0]['catalogData']),catalog_fields)
        self.assertIsInstance(history[0]['sourceItemIds'],list)
        identities=[value['-293004'] for value in objects if isinstance(value,dict) and '-293004' in value]
        self.assertEqual(len(identities),1)
        self.assertEqual(set(identities[0]),{'skuId','itemName','names','brand','itemNumber','model','packaging','specifications','saleUnit'})
        self.assertEqual(identities[0]['skuId'],'ci-c3-r13-historical-product')
        self.assertEqual(identities[0]['itemName'],'Synthetic historical')
        self.assertEqual(identities[0]['saleUnit'],'pack')

    def test_old_rows_or_snapshot_rewrite_or_loss_rejects(self):
        for version in [29,30]:
            for rows in [{},{'bb_order_header':'0:lost'},{'bb_order_header':'1:changed-delivery-snapshot'}]:
                args=self.stage(version);args[3]=rows
                with self.subTest(version=version,rows=rows),self.assertRaises(RuntimeError):module.assert_stage(*args)

    def test_old_column_change_or_removal_rejects(self):
        for version in [29,30]:
            args=self.stage(version);args[1]=copy.deepcopy(args[1]);next(row for row in args[1] if row['table_name']=='bb_order_header' and row['column_name']=='id')['data_type']='text'
            with self.subTest(version=version),self.assertRaises(RuntimeError):module.assert_stage(*args)

    def test_new_defaults_types_nullability_and_extra_columns_reject(self):
        for key,value in [('column_default','1'),('data_type','text'),('is_nullable','YES')]:
            args=self.stage(29);args[1]=copy.deepcopy(args[1]);next(row for row in args[1] if row['column_name']=='order_revision')[key]=value
            with self.subTest(key=key),self.assertRaises(RuntimeError):module.assert_stage(*args)
        args=self.stage(30);args[1]=args[1]+[{**module.NEW_COLUMNS[module.JOB][0],'column_name':'unreviewed'}]
        with self.assertRaises(RuntimeError):module.assert_stage(*args)

    def test_unknown_indexes_and_ownership_index_rewrite_reject(self):
        args=self.stage(30);args[5].append({'tablename':module.JOB,'indexname':'unknown','indexdef':'unexpected'})
        with self.assertRaises(RuntimeError):module.assert_stage(*args)
        args=self.stage(30);next(row for row in args[5] if row['indexname']=='bb_costco_onboarding_owner')['indexdef']='CREATE INDEX bb_costco_onboarding_owner ON public.bb_costco_onboarding_job USING btree (merchant_id)'
        with self.assertRaises(RuntimeError):module.assert_stage(*args)

    def test_constraint_rewrite_missing_or_unvalidated_reject(self):
        for mode in ['definition','missing','validated','deferrable']:
            args=self.stage(30)
            if mode=='missing':args[7].pop()
            elif mode=='definition':args[7][0]['definition']='CHECK (true)'
            else:args[7][0][mode]=mode=='deferrable'
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):module.assert_stage(*args)

    def test_postgres_cast_and_format_normalization_does_not_change_operator_or_values(self):
        expected="CHECK (kind = ANY (ARRAY['PRIVATE_PHOTO','OFFICIAL_EVIDENCE']))"
        actual="CHECK (((kind)::text = ANY ((ARRAY['PRIVATE_PHOTO'::character varying, 'OFFICIAL_EVIDENCE'::character varying])::text[])))"
        self.assertEqual(module.normalized(expected),module.normalized(actual))
        self.assertNotEqual(module.normalized('CHECK (revision >= 0)'),module.normalized('CHECK (revision >= -1)'))

    def test_history_requires_exact_prefix_checksum_success_and_rank(self):
        path=module.ROOT/'backend/src/main/resources/db/migration'/module.ADDED_MIGRATIONS[29][0]
        old=[{'installed_rank':27,'version':'28','script':'V28__checkout_delivery_snapshot.sql','checksum':-1352681989,'success':True}]
        suffix={'installed_rank':28,'version':'29','script':module.ADDED_MIGRATIONS[29][0],'checksum':module.migration_checksum(path.read_bytes()),'success':True}
        module.require_history(old,old+[suffix],29)
        for key,value in [('installed_rank',29),('checksum',0),('version','30'),('success',False)]:
            with self.subTest(key=key),self.assertRaises(RuntimeError):module.require_history(old,old+[{**suffix,key:value}],29)
        with self.assertRaises(RuntimeError):module.require_history([],[],29)
        with self.assertRaises(RuntimeError):module.require_history(old,[{**old[0],'checksum':0},suffix],29)

    def test_flyway_checksum_matches_previously_executed_v28_checksum(self):
        path=module.ROOT/'backend/src/main/resources/db/migration/V28__checkout_delivery_snapshot.sql'
        self.assertEqual(module.migration_checksum(path.read_bytes()),-1352681989)

    def test_unknown_stage_cannot_be_inferred_as_a_success(self):
        args=self.stage(29);args[-1]=31
        with self.assertRaises(RuntimeError):module.assert_stage(*args)

    def test_cleanup_requires_existing_complete_unchanged_preservation_proof(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True),patch.object(module,'sql') as sql:
            path=Path(directory)/'missing.json'
            with self.assertRaises(FileNotFoundError):module.cleanup_fixture_dependencies(path)
            path,proof=self.cleanup_proof(directory)
            for field,value in [('status','FAIL'),('schemaAfter',29),('migrationBaselineSha256','wrong'),('businessDatasourceUsed',True),('allOldColumnsAndValuesPreserved',False),('stages',[]),('finalOldColumnFingerprints',{})]:
                path.write_text(json.dumps({**proof,field:value}))
                with self.subTest(field=field),self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
            sql.assert_not_called()

    def test_cleanup_environment_guard_runs_before_proof_or_connection(self):
        with tempfile.TemporaryDirectory() as directory,patch.object(module,'sql') as sql:
            for key in self.CI_ENV:
                with patch.dict(module.os.environ,{**self.CI_ENV,key:'wrong'},clear=True),self.subTest(key=key),self.assertRaises(RuntimeError):
                    module.cleanup_fixture_dependencies(Path(directory)/'missing.json')
            sql.assert_not_called()

    def test_cleanup_rejects_missing_dependency_without_delete_or_pass(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True):
            path,_=self.cleanup_proof(directory)
            for kind in module.FIXTURE_DEPENDENCIES:
                observed=copy.deepcopy(module.FIXTURE_DEPENDENCIES);observed[kind]=[]
                with patch.object(module,'sql',return_value=json.dumps(observed)) as sql,self.subTest(kind=kind),self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
                self.assertEqual(sql.call_count,1);self.assertFalse(self.cleanup_receipt_path(path).exists())

    def test_cleanup_rejects_extra_dependency_without_delete_or_pass(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True):
            path,_=self.cleanup_proof(directory)
            for kind in module.FIXTURE_DEPENDENCIES:
                observed=copy.deepcopy(module.FIXTURE_DEPENDENCIES);observed[kind].append({**observed[kind][0],'id':'unknown'})
                with patch.object(module,'sql',return_value=json.dumps(observed)) as sql,self.subTest(kind=kind),self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
                self.assertEqual(sql.call_count,1);self.assertFalse(self.cleanup_receipt_path(path).exists())

    def test_cleanup_rejects_foreign_id_product_actor_or_merchant(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True):
            path,_=self.cleanup_proof(directory)
            for kind,rows in module.FIXTURE_DEPENDENCIES.items():
                for field,value in rows[0].items():
                    observed=copy.deepcopy(module.FIXTURE_DEPENDENCIES);observed[kind][0][field]=value+1 if isinstance(value,int) else 'foreign'
                    with patch.object(module,'sql',return_value=json.dumps(observed)) as sql,self.subTest(kind=kind,field=field),self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
                    self.assertEqual(sql.call_count,1);self.assertFalse(self.cleanup_receipt_path(path).exists())

    def test_cleanup_executes_only_two_ordered_guarded_deletes_after_proof_then_binds_receipt(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True):
            path,_=self.cleanup_proof(directory);original=path.read_bytes();receipt_path=self.cleanup_receipt_path(path);calls=[]
            def execute(statement):
                self.assertEqual(path.read_bytes(),original);self.assertFalse(receipt_path.exists());calls.append(statement)
                if len(calls)==1:
                    self.assertNotIn('DELETE',statement);return json.dumps(module.FIXTURE_DEPENDENCIES)
                self.assertTrue(statement.startswith('BEGIN;'));self.assertTrue(statement.rstrip().endswith('COMMIT;'))
                self.assertIn('FOR UPDATE',statement);self.assertIn('RAISE EXCEPTION',statement)
                deletes=[line.strip() for line in statement.splitlines() if line.strip().startswith('DELETE FROM')]
                self.assertEqual(len(deletes),2)
                self.assertTrue(deletes[0].startswith('DELETE FROM bb_product_lifecycle_event WHERE'))
                self.assertTrue(deletes[1].startswith('DELETE FROM bb_product_catalog_recovery WHERE'))
                for statement,identity,owner in [(deletes[0],'ci-c3-r13-lifecycle-history','actor_id=-293001'),(deletes[1],'ci-c3-r13-catalog-history','merchant_id=-293001')]:
                    self.assertIn("id='"+identity+"'",statement);self.assertIn("product_id='ci-c3-r13-historical-product'",statement);self.assertIn(owner,statement);self.assertIn('RETURNING id INTO',statement)
                return json.dumps(module.FIXTURE_DELETED)
            with patch.object(module,'sql',side_effect=execute),patch('builtins.print'):receipt=module.cleanup_fixture_dependencies(path)
            self.assertEqual(len(calls),2);self.assertEqual(path.read_bytes(),original)
            self.assertEqual(receipt,json.loads(receipt_path.read_text()));self.assertEqual(receipt['preservationProofSha256'],module.sha(original))
            self.assertTrue(receipt['productOrderUserRowsRetained']);self.assertEqual(receipt['deleted'],module.FIXTURE_DELETED)

    def test_cleanup_sql_failure_or_unexpected_result_never_writes_pass(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True):
            path,_=self.cleanup_proof(directory)
            for results in [[RuntimeError('read failed')],[json.dumps(module.FIXTURE_DEPENDENCIES),RuntimeError('transaction failed')],[json.dumps(module.FIXTURE_DEPENDENCIES),json.dumps({'lifecycle':[],'catalog':[]})]]:
                with patch.object(module,'sql',side_effect=results),self.subTest(results=results),self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
                self.assertFalse(self.cleanup_receipt_path(path).exists())

    def test_cleanup_proof_change_during_transaction_never_writes_pass(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True):
            path,_=self.cleanup_proof(directory);calls=[]
            def execute(statement):
                calls.append(statement)
                if len(calls)==1:return json.dumps(module.FIXTURE_DEPENDENCIES)
                path.write_text('changed proof');return json.dumps(module.FIXTURE_DELETED)
            with patch.object(module,'sql',side_effect=execute),self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
            self.assertFalse(self.cleanup_receipt_path(path).exists())

    def test_cleanup_does_not_overwrite_existing_receipt_or_replay_deletes(self):
        with tempfile.TemporaryDirectory() as directory,patch.dict(module.os.environ,self.CI_ENV,clear=True),patch.object(module,'sql') as sql:
            path,_=self.cleanup_proof(directory);receipt_path=self.cleanup_receipt_path(path);receipt_path.parent.mkdir();receipt_path.write_text('retained prior outcome')
            with self.assertRaises(RuntimeError):module.cleanup_fixture_dependencies(path)
            sql.assert_not_called();self.assertEqual(receipt_path.read_text(),'retained prior outcome')
