"""Safety guards for the scoped migration release; never contacts a host."""
import copy,hashlib,importlib.util,json,unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

FILE=Path(__file__).resolve().parents[1]/'docs/reports/evidence/geographic-master-20261112/production/geographic-operator.py'
spec=importlib.util.spec_from_file_location('geographic_operator',FILE)
operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)

class GeographicReleaseGuards(unittest.TestCase):
    def artifact(self):
        return {'source':operator.SOURCE,'release':operator.RELEASE,'migrationSha256':{'34':'seed'},'images':[
            {'name':'core-service','tag':'bobuy/core:'+operator.RELEASE,'imageId':'sha256:'+'1'*64},
            {'name':'frontend','tag':'bobuy/frontend:'+operator.RELEASE,'imageId':'sha256:'+'2'*64}]}

    def test_accepts_exact_scoped_source_images_and_migration(self):
        value=self.artifact();self.assertIs(operator.validate_artifact(value),value)

    def test_rejects_other_source_services_tags_and_migrations(self):
        base=self.artifact()
        invalid=[]
        value=copy.deepcopy(base);value['source']='other';invalid.append(value)
        value=copy.deepcopy(base);value['migrationSha256']['35']='unreviewed';invalid.append(value)
        value=copy.deepcopy(base);value['images'].append({'name':'auth-service'});invalid.append(value)
        value=copy.deepcopy(base);value['images'][0]['tag']='bobuy/core:latest';invalid.append(value)
        for value in invalid:
            with self.subTest(value=value),self.assertRaises(ValueError):operator.validate_artifact(value)

    def test_database_restore_requires_verified_unchanged_frozen_writers(self):
        self.assertTrue(operator.rollback_allowed('MIGRATED',True,True))
        for phase,unchanged,verified in [('OPENING_WRITES',True,True),('WRITES_OPEN',True,True),('FORWARD_RECOVERY_REQUIRED',True,True),('MIGRATED',False,True),('MIGRATED',True,False)]:
            with self.subTest(phase=phase,unchanged=unchanged,verified=verified):self.assertFalse(operator.rollback_allowed(phase,unchanged,verified))

    def test_ci_and_local_evidence_are_source_bound(self):
        with TemporaryDirectory(prefix='geo-operator-') as tmp,patch.object(operator,'STAGE',Path(tmp)):
            stage=Path(tmp);gates={'source':operator.SOURCE,'frontendTests':814,'frontendAffectedTests':6,'backendTests':674,'codeql':'success','failures':0,'configuredJacoco':'PASS'}
            for ci in ['success','failure']:
                gates['codeql']=ci;data=json.dumps(gates).encode();(stage/'accepted-gates.json').write_bytes(data)
                (stage/'artifact.json').write_text(json.dumps({'gatesSha256':hashlib.sha256(data).hexdigest()}))
                if ci=='success':operator.verify_ci()
                else:
                    with self.assertRaises(RuntimeError):operator.verify_ci()

    def test_reference_data_and_loaded_artifacts_are_checked(self):
        with TemporaryDirectory(prefix='geo-reference-') as tmp,patch.object(operator,'STAGE',Path(tmp)):
            stage=Path(tmp);expected=[['JP',None,1,'Japan',None]];data=json.dumps(expected).encode();(stage/'geographic-reference.json').write_bytes(data)
            artifact={'referenceSha256':hashlib.sha256(data).hexdigest(),'coreJarSha256':'jar-sha','frontend':{'index.html':'asset-sha'}}
            def run(*args):
                if 'sha256sum' in args:return 'jar-sha /app/app.jar'
                if args[-1].startswith('cd '):return 'asset-sha ./index.html'
                if args[-1].endswith('parentCode=JP'):return json.dumps({'data':[{}]*47})
                if args[-1].endswith('parentCode=US'):return json.dumps({'data':[]})
                return json.dumps({'data':[{}]*249})
            with patch.object(operator,'sql',return_value=json.dumps(expected)),patch.object(operator,'run',side_effect=run):operator.verify_geographic_reference(artifact)
            self.assertEqual(json.loads((stage/'geographic-acceptance.json').read_text())['result'],'PASS')
            with patch.object(operator,'sql',return_value='[]'),self.assertRaises(RuntimeError):operator.verify_geographic_reference(artifact)
            with patch.object(operator,'sql',return_value=json.dumps(expected)),patch.object(operator,'run',return_value='wrong /app/app.jar'),self.assertRaises(RuntimeError):operator.verify_geographic_reference(artifact)

if __name__=='__main__':unittest.main()
