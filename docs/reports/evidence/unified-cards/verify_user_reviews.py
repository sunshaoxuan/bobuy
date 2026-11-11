"""Local-only review contract and migration evidence. Never targets production."""
import argparse, concurrent.futures, json, subprocess, urllib.request, urllib.error, uuid
from pathlib import Path
from decimal import Decimal

ROOT=Path(__file__).resolve().parent
DB='bobuy_cards_20261111'
BASE='http://127.0.0.1:18081'

def sql(statement, failure=None):
    result=subprocess.run(['docker','exec','bobuy-local-postgres-1','psql','-U','bobuy','-d',DB,'-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-c',statement],capture_output=True,text=True,encoding='utf-8')
    if failure:
        assert result.returncode and failure in result.stderr, 'Expected SQL constraint '+failure
        return
    if result.returncode: raise RuntimeError('Local SQL check failed: '+result.stderr[:250])
    return result.stdout.strip()

def fingerprints(tables):
    result={}
    for table in tables:
        assert table.replace('_','').isalnum()
        result[table]={'rows':sql('SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,\'[]\')) FROM "'+table+'" t'),
          'columns':sql("SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY ordinal_position)::text,'[]')) FROM information_schema.columns c WHERE table_schema='public' AND table_name='"+table+"'")}
    return result

def http(method,path,data=None,token=None):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    req=urllib.request.Request(BASE+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=30) as response: return response.status,json.load(response)
    except urllib.error.HTTPError as error:
        raw=error.read()
        return error.code,json.loads(raw) if raw else {}

def checked(method,path,data=None,token=None,status=200):
    actual,body=http(method,path,data,token)
    assert actual==status, f'{method} {path}: {actual}, expected {status}'
    return body.get('data',body)

def login(name):
    return checked('POST','/api/auth/login',{'username':name,'password':name+'-pass'})['accessToken']

def clone_product(product):
    assert product.replace('-','').isalnum()
    sql("INSERT INTO bb_product SELECT (jsonb_populate_record(NULL::bb_product,to_jsonb(p)||jsonb_build_object('id','"+product+"','name',jsonb_build_object('ja-JP','Synthetic user review contract'),'deleted_at',NULL,'deleted_by',NULL))).* FROM bb_product p WHERE id='demo-chicken'")

def api_contract():
    agent,customer=login('agent'),login('customer')
    product='review-contract-'+uuid.uuid4().hex[:12]
    clone_product(product)
    public='/api/storefront/product-reviews/'+product
    mine='/api/product-reviews/'+product+'/mine'
    sql("INSERT INTO bb_product_rating(product_id,merchant_id,stars,public_visible,version,reviewed_at) VALUES('"+product+"',1000,5,true,1,now())")
    before=checked('GET',public)
    assert before['average'] is None and before['count']==0 and len(before['distribution'])==9
    checked('PUT',mine,{'stars':5,'comment':'','version':0},status=401)
    for version in range(9):
        score=1+version*.5
        saved=checked('PUT',mine,{'stars':score,'comment':'Synthetic agent review','version':version},agent)
        assert saved['version']==version+1
    checked('PUT',mine,{'stars':2.5,'comment':'<script>synthetic plain text</script>','version':0},customer)
    summary=checked('GET',public)
    assert summary['count']==2 and summary['average']==3.75 and summary['sum']==7.5
    checked('PUT',mine,{'stars':4.5,'comment':'Synthetic edited customer review','version':1},customer)
    assert checked('GET',public)['average']==4.75
    for score in [0,.5,1.1,4.25,5.5]: checked('PUT',mine,{'stars':score,'comment':'','version':9},agent,status=400)
    checked('PUT',mine,{'stars':5,'comment':'x'*2001,'version':9},agent,status=400)
    checked('PUT',mine,{'stars':1,'comment':'stale','version':0},agent,status=409)
    checked('PUT',mine,{'stars':1,'comment':'Forged author ignored','version':9,'userId':1001},agent)
    assert checked('GET',mine,token=customer)['stars']==4.5
    comments=checked('GET',public+'/comments')
    assert len(comments['items'])==2
    for row in comments['items']: assert set(row)=={'id','stars','comment','updatedAt'}
    summary=checked('GET',public)
    assert sum(b['count'] for b in summary['distribution'])==summary['count']==2
    assert sum(Decimal(str(b['stars']))*b['count'] for b in summary['distribution'])==Decimal(str(summary['sum']))
    concurrent=product+'-race';clone_product(concurrent)
    race='/api/product-reviews/'+concurrent+'/mine'
    with concurrent_futures() as executor:
        statuses=list(executor.map(lambda score:http('PUT',race,{'stars':score,'comment':'race create','version':0},agent)[0],[3,4]))
    assert sorted(statuses)==[200,409]
    with concurrent_futures() as executor:
        statuses=list(executor.map(lambda score:http('PUT',race,{'stars':score,'comment':'race update','version':1},agent)[0],[3.5,4.5]))
    assert sorted(statuses)==[200,409]
    assert checked('GET',race,token=agent)['version']==2
    assert checked('GET','/api/storefront/product-reviews/'+concurrent)['count']==1
    invalid=product+'-constraint';clone_product(invalid)
    for score in ['0.5','1.04','1.1','5.5']:
        sql("INSERT INTO bb_product_review(product_id,user_id,stars,comment,version,created_at,updated_at) VALUES('"+invalid+"',1000,"+score+",'',1,now(),now())",failure='23514')
    sql("UPDATE bb_product SET visibility_status='DRAFTER_ONLY' WHERE id='"+product+"'")
    for path in [public,public+'/comments',mine]: checked('GET',path,token=agent,status=404)
    checked('PUT',mine,{'stars':5,'comment':'private','version':10},agent,status=404)
    sql("UPDATE bb_product SET visibility_status='PUBLIC',deleted_at=now(),deleted_by=1000 WHERE id='"+product+"'")
    checked('GET',public,status=404)
    checked('PUT','/api/merchant/product-ratings/'+concurrent,{'stars':5,'publicVisible':True,'version':0,'reviewed':True},agent,status=404)
    report={'result':'PASS','product':product,'concurrentProduct':concurrent,'checks':['legacy excluded','nine valid score values','customer and agent parity','edit keeps count','mean and histogram coherence','anonymous rejected','range and length rejected','stale version rejected','author impersonation ignored','public review privacy','concurrent create one winner','concurrent update one winner','PostgreSQL exact-score constraints','private and deleted inaccessible','obsolete merchant endpoint removed']}
    sql("UPDATE bb_product SET visibility_status='DRAFTER_ONLY' WHERE id LIKE 'review-contract-%'")
    (ROOT/'user-review-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))

def concurrent_futures(): return concurrent.futures.ThreadPoolExecutor(max_workers=2)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['pre','post','api']);args=parser.parse_args()
    if args.phase=='pre':
        tables=sql("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'flyway_schema_history' ORDER BY tablename").splitlines()
        assert 'bb_product_review' not in tables
        (ROOT/'user-review-migration-before.json').write_text(json.dumps(fingerprints(tables),indent=2),encoding='utf-8')
        print('PRE: retained '+str(len(tables))+' table fingerprints')
    elif args.phase=='post':
        before=json.loads((ROOT/'user-review-migration-before.json').read_text(encoding='utf-8'))
        assert fingerprints(list(before))==before,'Migration changed retained data or columns'
        assert sql('SELECT count(*) FROM bb_product_review')=='0'
        assert sql("SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1")=='32'
        report={'result':'PASS','retainedTables':len(before),'newReviews':0,'schema':'32','legacyTablePreserved':True}
        (ROOT/'user-review-migration.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report))
    else: api_contract()
