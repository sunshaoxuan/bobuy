"""Pure negative boundaries only; no PG, JVM, container, network or production calls."""
import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('amendment_onboarding_upgrade',Path(__file__).with_name('verify-amendment-onboarding-upgrade.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AmendmentOnboardingUpgradeTest(unittest.TestCase):
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
