from pathlib import Path
import json,subprocess
sql="""SELECT json_build_object(
'testNoteCount',(SELECT count(*) FROM bb_product_price_adjustment WHERE source_note ~* '合成验收|验收标准|synthetic|PC-SYNTHETIC'),
'officialNoteCount',(SELECT count(*) FROM bb_product_price_adjustment WHERE source_note LIKE '%Costco%' AND type='PROMOTION'),
'promotionNotes',(SELECT json_agg(t) FROM (SELECT source_note,count(*) AS documents FROM bb_product_price_adjustment WHERE type='PROMOTION' AND channel IN ('COSTCO_WAREHOUSE','COSTCO_ONLINE') GROUP BY source_note ORDER BY count(*) DESC LIMIT 5) t)
);"""
code="import subprocess\nsql="+repr(sql)+"\np=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','exec psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atq -v ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True,check=True)\nprint(p.stdout.decode())"
p=subprocess.run(['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','python3','-'],input=code.encode(),capture_output=True,check=True)
v=json.loads(p.stdout.decode());Path(__file__).with_name('production-reason-inventory.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(v))
