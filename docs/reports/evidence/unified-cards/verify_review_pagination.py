"""Disposable pagination fixture, guarded to the task's copied local database."""
import sys, json
from pathlib import Path
from verify_user_reviews import sql, checked, DB

PRODUCT = 'review-pagination-c1-20261111'
assert DB == 'bobuy_cards_20261111'
assert sql('SELECT current_database()') == DB
phase = sys.argv[1]
if phase == 'create':
    assert sql("SELECT count(*) FROM bb_user WHERE id BETWEEN 9900000001 AND 9900000021") == '0'
    assert sql("SELECT count(*) FROM bb_product WHERE id='"+PRODUCT+"'") == '0'
    sql("""BEGIN;
INSERT INTO bb_user SELECT (jsonb_populate_record(NULL::bb_user,to_jsonb(u)||jsonb_build_object(
'id',9900000000+g,'name','Synthetic pagination '||g,'username','review-pagination-c1-'||g,
'password_hash',NULL,'enabled',false,'email',NULL,'phone',NULL,'social_accounts',NULL,
'email_verified_at',NULL,'platform_admin',false))).* FROM bb_user u CROSS JOIN generate_series(1,21) g WHERE username='customer';
INSERT INTO bb_product SELECT (jsonb_populate_record(NULL::bb_product,to_jsonb(p)||jsonb_build_object(
'id','review-pagination-c1-20261111','name',jsonb_build_object('zh-CN','合成分页验收 C1','ja-JP','合成分页验收 C1'),
'deleted_at',NULL,'deleted_by',NULL))).* FROM bb_product p WHERE id='demo-chicken';
INSERT INTO bb_product_review(product_id,user_id,stars,comment,version,created_at,updated_at)
SELECT 'review-pagination-c1-20261111',9900000000+g,1+mod(g,9)*0.5,'合成分页验收第'||g||'条',1,now(),now()+g*interval '1 second' FROM generate_series(1,21) g;
COMMIT;""")
elif phase == 'check':
    base = '/api/storefront/product-reviews/'+PRODUCT
    summary = checked('GET', base)
    first = checked('GET', base+'/comments?page=0')
    second = checked('GET', base+'/comments?page=1')
    assert summary['count'] == 21
    assert len(first['items']) == 20 and first['hasNext']
    assert len(second['items']) == 1 and not second['hasNext']
    assert len({item['id'] for item in first['items']+second['items']}) == 21
    assert all(set(item)=={'id','stars','comment','updatedAt'} for item in first['items']+second['items'])
    result = dict(result='PASS', count=21, firstPage=20, secondPage=1, summary=summary)
    Path(__file__).with_name('review-pagination-api.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(result))
elif phase == 'cleanup':
    sql("BEGIN; DELETE FROM bb_product_review WHERE product_id='"+PRODUCT+"'; DELETE FROM bb_product WHERE id='"+PRODUCT+"'; DELETE FROM bb_user WHERE id BETWEEN 9900000001 AND 9900000021 AND username LIKE 'review-pagination-c1-%'; COMMIT;")
    assert sql("SELECT count(*) FROM bb_user WHERE id BETWEEN 9900000001 AND 9900000021") == '0'
    assert sql("SELECT count(*) FROM bb_product WHERE id='"+PRODUCT+"'") == '0'
    assert checked('GET','/api/storefront/product-reviews/demo-chicken')['count'] == 2
    print('Disposable pagination fixture removed; baseline count remains 2.')
else:
    raise ValueError(phase)
