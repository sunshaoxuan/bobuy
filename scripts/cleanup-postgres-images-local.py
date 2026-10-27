"""Remove only the disposable synthetic rows made by this named local UI check.

Does not restore a whole database, rewind sequences, touch production or remove any
preexisting image. New unrelated local work is preserved.
"""
from pathlib import Path
import json,re,subprocess
root=Path(__file__).resolve().parents[1];out=root/'docs/reports/evidence/postgres18-storage'
before=json.loads((out/'ui-fixture-before.json').read_text());report=json.loads((out/'browser.json').read_text())
assert all(v=='PASS' for v in report['checks'].values())
marker=report['marker'];assert marker=='SYNTHETIC-PG18-IMAGE-20261027'
expense=int(report['expenseId']);trip=int(report['tripId']);image=report['imageUrl'].rsplit('/',1)[-1]
assert re.fullmatch(r'[a-f0-9-]{36}',image)
command=['docker','exec','-i','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d','bobuy','-qAt','-v','ON_ERROR_STOP=1']
def sql(text):return subprocess.check_output(command,input=text,text=True,encoding='utf-8').strip()
assert sql('SHOW server_version;')=='18.6'
assert sql("SELECT count(*) FROM bb_trip_expense WHERE id="+str(expense)+" AND trip_id="+str(trip)+" AND category='"+marker+"' AND receipt_object_key='pg-image:"+image+"';")=='1'
imageDelete=''
if image not in before['images']:
 imageDelete="DELETE FROM bb_recommendation_image WHERE id='"+image+"' AND merchant_id=1000 AND access_scope='PRIVATE' AND NOT EXISTS (SELECT 1 FROM bb_trip_expense WHERE receipt_object_key='pg-image:"+image+"') AND NOT EXISTS (SELECT 1 FROM bb_procurement_receipt WHERE original_object_key='pg-image:"+image+"');"
sql("BEGIN; DELETE FROM bb_financial_audit_log WHERE trip_id="+str(trip)+" AND action_type='EXPENSE_CREATE' AND modified_value LIKE '%"+marker+"%' AND modified_value LIKE '%"+image+"%'; DELETE FROM bb_trip_expense WHERE id="+str(expense)+" AND trip_id="+str(trip)+" AND category='"+marker+"'; "+imageDelete+' COMMIT;')
assert sql("SELECT count(*) FROM bb_trip_expense WHERE category='"+marker+"';")=='0'
remaining=json.loads(sql("SELECT coalesce(json_agg(id),'[]'::json) FROM bb_recommendation_image;"));assert set(before['images'])<=set(remaining)
result={'onlyNamedSyntheticExpenseAndItsAuditRemoved':True,'allPreexistingImageIdsRetained':True,'privateImageRemovedOnlyIfNewAndUnreferenced':True,'sequencesNotRewound':True,'productionTouched':False,'wholeDatabaseRestore':False}
(out/'ui-fixture-cleanup.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
