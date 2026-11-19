#!/usr/bin/env python3
"""Explicit, hash-bound category retirement. Never discovers targets by prefix/count.
Connection lives in psql's normal environment/service config, not command output.
"""
import argparse, hashlib, json, os, re, subprocess, sys, uuid
from pathlib import Path
from decimal import Decimal

def loads(text):
    def invalid_constant(_):
        raise ValueError('Non-finite JSON numbers are not supported')
    return json.loads(text, parse_float=Decimal, parse_constant=invalid_constant)

def canonical(value):
    """Canonical keys with exact JSON numbers at every depth; never coerce through float."""
    if value is None:return 'null'
    if value is True:return 'true'
    if value is False:return 'false'
    if isinstance(value,str):return json.dumps(value,ensure_ascii=False)
    if isinstance(value,int):return str(value)
    if isinstance(value,Decimal):
        if not value.is_finite():raise ValueError('Non-finite JSON numbers are not supported')
        return str(value)
    if isinstance(value,float):raise ValueError('Binary floating-point values are forbidden in capture/recovery JSON')
    if isinstance(value,list):return '['+','.join(canonical(v) for v in value)+']'
    if isinstance(value,dict):
        if any(not isinstance(k,str) for k in value):raise ValueError('JSON object keys must be strings')
        return '{'+','.join(canonical(k)+':'+canonical(value[k]) for k in sorted(value))+'}'
    raise ValueError('Unsupported JSON value type')

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def literal(value):
    tag='$r_'+uuid.uuid4().hex+'$'
    return tag+canonical(value)+tag+'::jsonb'

def validate_scope(scope):
    if not isinstance(scope,dict):raise ValueError('Scope must be an object')
    ids=scope.get('categoryIds',[])
    if not isinstance(ids,list) or any(not isinstance(i,str) for i in ids):raise ValueError('categoryIds must be a literal string array')
    if type(scope.get('merchantId')) is not int or scope['merchantId']<1 or not 1<=len(ids)<=200 or len(set(ids))!=len(ids) or any(not isinstance(i,str) or not i or len(i)>255 for i in ids):
        raise ValueError('Explicit merchantId and 1..200 unique literal categoryIds required')
    return {'merchantId':scope['merchantId'],'categoryIds':sorted(ids)}

def state_query(scope, product_ids=()):
    """Full selected product rows are local recovery evidence; protected history is hash-only."""
    return f"""
WITH scope AS (SELECT {literal(scope)} AS s),
ids AS (SELECT jsonb_array_elements_text(s->'categoryIds') id FROM scope),
pids AS (SELECT p.id FROM bb_product p WHERE p.id IN (SELECT jsonb_array_elements_text({literal(list(product_ids))}))
 OR p.category_id IN (SELECT id FROM ids)
 OR coalesce(p.catalog_data->'categoryIds','[]'::jsonb) ?| ARRAY(SELECT id FROM ids)),
related_skus AS (SELECT id FROM bb_merchant_sku WHERE product_id IN(SELECT id FROM pids)),
protected AS (
 SELECT 'items' kind,coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') value FROM bb_recommendation_item i
 WHERE i.product_id IN(SELECT id FROM pids) OR i.category_ids ?| ARRAY(SELECT id FROM ids)
 OR coalesce(i.publication_snapshot->'categoryIds','[]'::jsonb) ?| ARRAY(SELECT id FROM ids)
 OR coalesce(i.publication_snapshot#>'{{catalog,catalogData,categoryIds}}','[]'::jsonb) ?| ARRAY(SELECT id FROM ids)
 UNION ALL SELECT 'checkpoints',coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM bb_product_catalog_recovery c WHERE c.product_id IN(SELECT id FROM pids)
 UNION ALL SELECT 'orders',coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]') FROM bb_order_header o
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(o.lines,'[]'::jsonb)) line WHERE line->>'skuId' IN(SELECT id FROM pids UNION SELECT id FROM related_skus))
 UNION ALL SELECT 'skus',coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]') FROM bb_merchant_sku s WHERE s.id IN(SELECT id FROM related_skus)
)
SELECT jsonb_build_object(
 'categories',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]') FROM bb_category c WHERE c.id IN(SELECT id FROM ids)),
 'products',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]') FROM bb_product p WHERE p.id IN(SELECT id FROM pids)),
 'mappings',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.legacy_category_id),'[]') FROM bb_category_legacy_mapping m WHERE m.legacy_category_id IN(SELECT id FROM ids)),
 'paths',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.product_id),'[]') FROM bb_product_primary_category_path p WHERE p.product_id IN(SELECT id FROM pids)),
 'tree',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.id),'[]')::text,'UTF8')),'hex') FROM bb_category_tree_node n),
 'foreignKeys',(SELECT coalesce(jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid)) ORDER BY conrelid::regclass::text,conname),'[]') FROM pg_constraint WHERE contype='f' AND confrelid='bb_category'::regclass),
 'protected',(SELECT jsonb_object_agg(kind,jsonb_build_object('rows',jsonb_array_length(value),'sha256',encode(sha256(convert_to(value::text,'UTF8')),'hex'))) FROM protected)
)"""

def run_sql(command, sql):
    result=subprocess.run(command, input=sql, text=True, capture_output=True, timeout=90)
    if result.returncode:
        # Do not echo SQL, rows, connection details or credentials from database diagnostics.
        refusal=re.search(r'retirement: [A-Za-z0-9 ,._-]+',result.stderr)
        raise RuntimeError(refusal.group(0) if refusal else 'Database command failed; transaction not committed (exit %d)'%result.returncode)
    lines=[line for line in result.stdout.splitlines() if line.startswith('{')]
    if len(lines)!=1: raise RuntimeError('Expected exactly one database receipt')
    return loads(lines[0])

def validate_state(scope, state):
    if sorted(c['id'] for c in state['categories'])!=scope['categoryIds']:
        raise ValueError('All explicitly selected categories must exist')
    if any(c.get('merchant_id')!=scope['merchantId'] for c in state['categories']+state['products']):
        raise ValueError('Cross-merchant or shared category/product scope refused')
    if len(state['products'])>10000: raise ValueError('Bounded operation exceeds 10000 products')
    if {f['table'].split('.')[-1] for f in state['foreignKeys']} != {'bb_product','bb_category_legacy_mapping'}:
        raise ValueError('Unexpected category foreign-key consumers; review compatibility first')
    for p in state['products']:
        data=p.get('catalog_data')
        if data is not None and (not isinstance(data,dict) or not isinstance(data.get('categoryIds'),list)):
            raise ValueError('Unsupported catalog_data shape; review before migration')

def capture(command,scope):
    state=run_sql(command,'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\n'+state_query(scope)+';\nCOMMIT;')
    validate_state(scope,state)
    plan={'format':2,'operationId':str(uuid.uuid4()),'scope':scope,'before':state}
    plan['sha256']=digest(plan)
    return plan

def validate_plan(plan):
    if plan.get('format')!=2 or plan.get('sha256')!=digest({k:v for k,v in plan.items() if k!='sha256'}): raise ValueError('Manifest checksum mismatch')
    if not re.fullmatch(r'[a-zA-Z0-9-]{1,64}',plan.get('operationId','')): raise ValueError('Invalid operation ID')
    scope=validate_scope(plan['scope']);validate_state(scope,plan['before'])
    return scope

def changed_state(plan):
    result=loads(canonical(plan['before']));ids=set(plan['scope']['categoryIds'])
    result['categories']=[];result['mappings']=[]
    for p in result['products']:
        if p.get('category_id') in ids:p['category_id']=None
        if p.get('catalog_data') is not None:p['catalog_data']['categoryIds']=[x for x in p['catalog_data']['categoryIds'] if x not in ids]
    return result

def transact(command,plan,mode,compatible_revision):
    scope=validate_plan(plan)
    if not re.fullmatch('[0-9a-f]{40}',compatible_revision): raise ValueError('Record the verified compatible application revision (40 hex)')
    expected=changed_state(plan);ids=[p['id'] for p in plan['before']['products']]
    payload={**plan,'expected':expected,'compatibleRevision':compatible_revision}
    setup=f"""BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
-- Short bounded classification write lock. Orders/recommendations remain writable.
LOCK TABLE bb_category,bb_product,bb_category_legacy_mapping,bb_retired_category,bb_category_retirement_operation IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE bb_category_tree_node,bb_product_primary_category_path IN SHARE MODE;
CREATE TEMP TABLE retirement_input AS SELECT {literal(payload)} AS p;
CREATE TEMP TABLE retirement_current AS {state_query(scope,ids)};
ALTER TABLE retirement_current RENAME COLUMN jsonb_build_object TO s;
"""
    action="""
DO $body$
DECLARE p jsonb; current_state jsonb; old_op bb_category_retirement_operation%ROWTYPE;
BEGIN
 SELECT i.p INTO p FROM retirement_input i; SELECT s INTO current_state FROM retirement_current;
 SELECT * INTO old_op FROM bb_category_retirement_operation WHERE id=p->>'operationId';
 IF FOUND THEN
  IF old_op.manifest_sha256<>p->>'sha256' THEN RAISE EXCEPTION 'retirement: operation hash conflict'; END IF;
  IF old_op.before_state<>p->'before' OR old_op.after_state<>p->'expected' THEN RAISE EXCEPTION 'retirement: operation evidence changed'; END IF;
  IF old_op.status='APPLIED' AND current_state=p->'expected' THEN
   IF (SELECT count(*) FROM bb_retired_category WHERE operation_id=p->>'operationId')<>jsonb_array_length(p#>'{before,categories}') OR EXISTS(
    SELECT 1 FROM bb_retired_category r WHERE r.operation_id=p->>'operationId' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p#>'{before,categories}') c WHERE c=r.original AND c->>'id'=r.id AND c->'name'=r.name AND (c->>'merchant_id')::bigint=r.merchant_id AND c->>'tag_key' IS NOT DISTINCT FROM r.tag_key)) THEN RAISE EXCEPTION 'retirement: archived evidence changed'; END IF;
   RETURN;
  END IF;
  RAISE EXCEPTION 'retirement: replay state changed or already restored';
 END IF;
 IF current_state<>p->'before' THEN RAISE EXCEPTION 'retirement: captured scope drifted'; END IF;
 IF EXISTS(SELECT 1 FROM bb_retired_category WHERE id IN(SELECT jsonb_array_elements_text(p#>'{scope,categoryIds}'))) THEN RAISE EXCEPTION 'retirement: target already archived'; END IF;
 INSERT INTO bb_retired_category(id,merchant_id,tag_key,name,original,operation_id)
 SELECT c->>'id',(c->>'merchant_id')::bigint,c->>'tag_key',c->'name',c,p->>'operationId' FROM jsonb_array_elements(p#>'{before,categories}') c;
 UPDATE bb_product b SET category_id=e->>'category_id',catalog_data=NULLIF(e->'catalog_data','null'::jsonb)
 FROM jsonb_array_elements(p#>'{expected,products}') e WHERE b.id=e->>'id';
 DELETE FROM bb_category_legacy_mapping WHERE legacy_category_id IN(SELECT jsonb_array_elements_text(p#>'{scope,categoryIds}'));
 DELETE FROM bb_category WHERE id IN(SELECT jsonb_array_elements_text(p#>'{scope,categoryIds}'));
 INSERT INTO bb_category_retirement_operation(id,manifest_sha256,compatible_revision,status,before_state,after_state)
 VALUES(p->>'operationId',p->>'sha256',p->>'compatibleRevision','APPLIED',p->'before',p->'expected');
END $body$;
"""
    if mode=='restore':action="""
DO $body$
DECLARE p jsonb; current_state jsonb; old_op bb_category_retirement_operation%ROWTYPE;
BEGIN
 SELECT i.p INTO p FROM retirement_input i; SELECT s INTO current_state FROM retirement_current;
 SELECT * INTO old_op FROM bb_category_retirement_operation WHERE id=p->>'operationId';
 IF NOT FOUND OR old_op.manifest_sha256<>p->>'sha256' THEN RAISE EXCEPTION 'retirement: missing or mismatched operation'; END IF;
 IF old_op.status='RESTORED' AND current_state=p->'before' THEN RETURN; END IF;
 IF old_op.status<>'APPLIED' OR current_state<>old_op.after_state OR old_op.after_state<>p->'expected' THEN RAISE EXCEPTION 'retirement: recovery scope changed - preserve new writes'; END IF;
 IF (SELECT count(*) FROM bb_retired_category WHERE operation_id=p->>'operationId')<>jsonb_array_length(p#>'{before,categories}') OR EXISTS(
 SELECT 1 FROM bb_retired_category r WHERE r.operation_id=p->>'operationId' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p#>'{before,categories}') c WHERE c=r.original AND c->>'id'=r.id AND c->'name'=r.name AND (c->>'merchant_id')::bigint=r.merchant_id AND c->>'tag_key' IS NOT DISTINCT FROM r.tag_key)) THEN RAISE EXCEPTION 'retirement: archived evidence changed'; END IF;
 DELETE FROM bb_retired_category WHERE operation_id=p->>'operationId';
 INSERT INTO bb_category SELECT * FROM jsonb_populate_recordset(NULL::bb_category,p#>'{before,categories}');
 INSERT INTO bb_category_legacy_mapping SELECT * FROM jsonb_populate_recordset(NULL::bb_category_legacy_mapping,p#>'{before,mappings}');
 UPDATE bb_product b SET category_id=e->>'category_id',catalog_data=NULLIF(e->'catalog_data','null'::jsonb)
 FROM jsonb_array_elements(p#>'{before,products}') e WHERE b.id=e->>'id';
 UPDATE bb_category_retirement_operation SET status='RESTORED',restored_at=now(),restored_by=current_user WHERE id=p->>'operationId';
END $body$;
"""
    wanted='before' if mode=='restore' else 'expected'
    finish=f"""
CREATE TEMP TABLE retirement_after AS {state_query(scope,ids)};
DO $verify$ BEGIN
 IF (SELECT jsonb_build_object FROM retirement_after)<>(SELECT p->'{wanted}' FROM retirement_input) THEN RAISE EXCEPTION 'retirement: final scope readback mismatch'; END IF;
END $verify$;
SELECT jsonb_build_object('result','PASS','action','{mode}','operationId',p->>'operationId','manifestSha256',p->>'sha256','compatibleRevision',p->>'compatibleRevision','categoryCount',jsonb_array_length(p#>'{{scope,categoryIds}}'),'productCount',jsonb_array_length(p#>'{{before,products}}')) FROM retirement_input;
COMMIT;
"""
    return run_sql(command,setup+action+finish)

def private_write(path,value):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:f.write(canonical(value)+'\n')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('action',choices=['capture','status','apply','restore']);p.add_argument('--psql-command-json',default='["psql","-X","-qAt","-v","ON_ERROR_STOP=1"]')
    p.add_argument('--scope');p.add_argument('--plan',required=True);p.add_argument('--confirm-sha256');p.add_argument('--compatible-revision');p.add_argument('--receipt')
    args=p.parse_args();cmd=loads(args.psql_command_json)
    if not isinstance(cmd,list) or not cmd or any(not isinstance(s,str) for s in cmd):raise ValueError('psql command must be an argv JSON array')
    if args.action=='capture':
        plan=capture(cmd,validate_scope(loads(Path(args.scope).read_text())));private_write(args.plan,plan)
        result={'result':'CAPTURED','sha256':plan['sha256'],'categories':len(plan['before']['categories']),'activeProducts':sum(x.get('deleted_at') is None for x in plan['before']['products']),'deletedProducts':sum(x.get('deleted_at') is not None for x in plan['before']['products'])}
    else:
        plan=loads(Path(args.plan).read_text());validate_plan(plan)
        if args.action=='status':
            ids=[p['id'] for p in plan['before']['products']]
            result=run_sql(cmd,"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; WITH observed AS ("+state_query(plan['scope'],ids)+"), operation AS (SELECT * FROM bb_category_retirement_operation WHERE id="+literal(plan['operationId'])+"#>>'{}') SELECT jsonb_build_object('operationId',"+literal(plan['operationId'])+",'status',coalesce((SELECT status FROM operation),'NOT_STARTED'),'manifestMatches',coalesce((SELECT manifest_sha256="+literal(plan['sha256'])+"#>>'{}' FROM operation),false),'matchesBefore',(SELECT jsonb_build_object FROM observed)="+literal(plan['before'])+",'matchesAfter',(SELECT jsonb_build_object FROM observed)="+literal(changed_state(plan))+"); COMMIT;")
        else:
            if args.confirm_sha256!=plan['sha256']:raise ValueError('Explicit reviewed plan SHA256 required')
            result=transact(cmd,plan,args.action,args.compatible_revision or '')
    if args.receipt:private_write(args.receipt,result)
    print(canonical(result))

if __name__=='__main__':
    try:main()
    except (ValueError,RuntimeError,subprocess.TimeoutExpired) as error:
        print(str(error) if not isinstance(error,subprocess.TimeoutExpired) else 'Database command timed out; reconcile operation ledger before retry',file=sys.stderr);sys.exit(1)
