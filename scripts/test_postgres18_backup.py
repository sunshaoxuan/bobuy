from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path
import unittest
spec=spec_from_file_location('backup',Path(__file__).with_name('postgres18-backup.py'));backup=module_from_spec(spec);spec.loader.exec_module(backup)
class CrossMajorRestoreChecks(unittest.TestCase):
 def snapshot(self,definition='CHECK (old_array_cast)'):
  return {'rows':{'bb_product':'142:exact-hash'},'constraints':[{'relation':'bb_product','conname':'check_amount','contype':'c','convalidated':True,'definition':definition}]}
 def test_target_must_parse_equal_predicate_not_just_accept_changed_text(self):
  old=self.snapshot();new=self.snapshot('CHECK (target_array_cast)')
  result=backup.verify_fingerprint(old,new,lambda relation,definition:'CHECK (target_array_cast)')
  self.assertEqual(result['constraintInventoryAndSemantics'],'PASS')
  with self.assertRaises(RuntimeError):backup.verify_fingerprint(old,new,lambda *_:'CHECK (different_predicate)')
 def test_missing_constraints_changed_data_or_validation_state_fail(self):
  old=self.snapshot()
  for new in [{'rows':{'bb_product':'142:changed'},'constraints':old['constraints']},
              {'rows':old['rows'],'constraints':[]},
              {'rows':old['rows'],'constraints':[{**old['constraints'][0],'convalidated':False}]}]:
   with self.assertRaises(RuntimeError):backup.verify_fingerprint(old,new,lambda *_:'unused')
 def test_scope_rejects_other_projects(self):
  for container in ['postgres','some-other-postgres','bobuy-postgres;echo unsafe']:
   with self.assertRaises(ValueError):backup.base_command(container)
  with self.assertRaises(ValueError):backup.base_command('bobuy-postgres','invalid;name')
if __name__=='__main__':unittest.main()
