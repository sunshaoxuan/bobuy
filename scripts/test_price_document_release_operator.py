"""Root release guards: refuse incomplete candidates and post-opening restores."""
import importlib.util,subprocess,unittest
from pathlib import Path
path=Path(__file__).resolve().parents[1]/'docs/reports/evidence/daily-product-offer-tags-20261112/erp-price-documents/release-operator.py'
spec=importlib.util.spec_from_file_location('price_release_operator',path);operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)
class ReleaseGuardsTest(unittest.TestCase):
 def candidate(self):
  source='a'*40
  return {'source':source,'release':'20261112.price-documents.1','images':[{'name':n} for n in operator.UPDATES]},{'source':source,'result':'PASS','codeql':'success','backendFailures':0,'frontendFailures':0,'migration':'PASS','ui':'PASS'}
 def test_exact_compatible_candidate_and_complete_gates_are_accepted(self):
  a,g=self.candidate();operator.validate(a,g)
 def test_partial_applications_or_mismatched_or_failed_evidence_are_refused(self):
  a,g=self.candidate();a['images'].pop()
  with self.assertRaises(ValueError):operator.validate(a,g)
  for key,bad in [('source','b'*40),('codeql','pending'),('ui','FAIL'),('backendFailures',1),('frontendFailures',1),('migration','PENDING')]:
   a,g=self.candidate();g[key]=bad
   with self.subTest(key=key),self.assertRaises(ValueError):operator.validate(a,g)
 def test_only_verified_known_closed_phases_allow_database_restore(self):
  self.assertTrue(operator.can_restore('UPGRADING',True));self.assertTrue(operator.can_restore('FREEZING',True))
  for phase in [*operator.NO_RESTORE,'UNKNOWN','PREPARED']:
   self.assertFalse(operator.can_restore(phase,True));self.assertFalse(operator.can_restore(phase,False))
  self.assertFalse(operator.can_restore('UPGRADING',False))
 def test_real_postgres_fingerprint_preserves_business_and_approval_semantics(self):
  query=operator.fingerprint_query('bb_product_price_adjustment')+';'
  setup="BEGIN;CREATE TEMP TABLE bb_product_price_adjustment(id int,created_at timestamptz,updated_at timestamptz,approved_at timestamptz,source_note text,amount numeric) ON COMMIT DROP;INSERT INTO bb_product_price_adjustment VALUES(1,now(),now(),now(),'Synthetic release fingerprint',100);"
  sql=setup+query+"UPDATE bb_product_price_adjustment SET created_at=created_at+interval '1 second',updated_at=updated_at+interval '1 second';"+query+"UPDATE bb_product_price_adjustment SET approved_at=approved_at+interval '1 second';"+query+"UPDATE bb_product_price_adjustment SET source_note=source_note||' SYNTHETIC FINGERPRINT PROBE';"+query+"UPDATE bb_product_price_adjustment SET amount=90;"+query+'ROLLBACK;'
  p=subprocess.run(['docker','exec','-i','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True,timeout=30)
  self.assertEqual(p.returncode,0,p.stderr.decode('utf-8',errors='replace'));rows=p.stdout.decode().splitlines();self.assertEqual(len(rows),5);self.assertEqual(rows[0],rows[1]);self.assertNotEqual(rows[1],rows[2]);self.assertNotEqual(rows[2],rows[3]);self.assertNotEqual(rows[3],rows[4])
  with self.assertRaises(ValueError):operator.fingerprint_query('wrong;table')
if __name__=='__main__':unittest.main()
