from pathlib import Path
import subprocess,json
root=Path(__file__).parent;e=root/'docs/reports/evidence/offer-period-presentation-20261113/source-unification';e.mkdir(exist_ok=True,parents=True)
sql="""SELECT json_build_object(
'flywayLatest',(SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1),
'productPricingColumns',(SELECT json_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='bb_product' AND (column_name~*'offer|promo|discount|adjust|coupon' OR column_name IN ('base_price','sale'))),
'recommendationOfferColumns',(SELECT json_agg(column_name ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='public' AND table_name='bb_recommendation_item' AND column_name~*'offer|promo|discount|coupon|reference_price|original_price|price_unit'),
'productCounts',(SELECT json_build_object('total',count(*),'saleNonNull',count(*) FILTER(WHERE sale IS NOT NULL),'saleEnabled',count(*) FILTER(WHERE sale->>'enabled'='true'),'positiveBase',count(*) FILTER(WHERE base_price>0)) FROM bb_product),
'saleKeys',(SELECT json_agg(key) FROM (SELECT DISTINCT jsonb_object_keys(sale) AS key FROM bb_product WHERE sale IS NOT NULL) q),
'legacyAttributeKeys',(SELECT json_agg(key) FROM (SELECT DISTINCT jsonb_object_keys(attributes) AS key FROM bb_product WHERE attributes IS NOT NULL) q WHERE key~*'offer|promo|discount|coupon|优惠|促销|调价'),
'approvedWebsiteDocuments',(SELECT count(*) FROM bb_product_price_adjustment WHERE channel='STOREFRONT' AND status='APPROVED')
);"""
code="import subprocess\nsql="+repr(sql)+"\np=subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c','exec psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\" -Atq'],input=sql.encode(),capture_output=True,check=True)\nprint(p.stdout.decode())"
ssh=['ssh','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41']
p=subprocess.run(ssh+['python3','-'],input=code.encode(),capture_output=True)
if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace')[-1200:])
value=json.loads(p.stdout.decode());(e/'database-inventory.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(value))
