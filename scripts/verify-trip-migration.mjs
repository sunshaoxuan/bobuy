import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = ['compose','-p','bobuy-local','-f','compose.local.yml','exec','-T','postgres'];
const db = 'bobuy_plan63_migration';
const run = (cmd, more = [], input) => execFileSync('docker',[...args,cmd,...more],{cwd:root,windowsHide:true,input,encoding:cmd === 'pg_dump' ? undefined : 'utf8'});
const sql = text => run('psql',['-U','bobuy','-d',db,'-v','ON_ERROR_STOP=1','-At'],text).trim();
const report = { environment:'existing bobuy-local PostgreSQL; isolated temporary database', checks:[] };
run('createdb',['-U','bobuy',db]);
try {
  const dir = new URL('../backend/src/main/resources/db/migration/',import.meta.url);
  for (const name of readdirSync(dir).filter(n=>/^V[1-5]__/.test(n)).sort()) sql(readFileSync(new URL(name,dir),'utf8'));
  sql(`INSERT INTO bb_user(id,name,username,roles,platform_admin) VALUES (10,'Merchant','fixture','["AGENT"]',true);
  INSERT INTO bb_trip(id,agent_id,origin,destination,depart_date,capacity,reserved_capacity,status)
    SELECT n,10,'Old origin',' Region ' || n,'2026-11-01',1,0,CASE n WHEN 5 THEN 'COMPLETED' WHEN 6 THEN 'SETTLED' ELSE 'DRAFT' END FROM generate_series(1,6) n;
  INSERT INTO bb_order_header(id,business_id,trip_id,status,payment_status,delivery_status,lines) VALUES
    (20,'pending',2,'CONFIRMED','UNPAID','PENDING_DELIVERY','[]'),
    (30,'partial',3,'NEW','UNPAID','PENDING_DELIVERY','[{"purchasedQuantity":1}]'),
    (40,'delivered',4,'DELIVERED','PAID','DELIVERED','[]'),
    (41,'cancelled',4,'CANCELLED','UNPAID','PENDING_DELIVERY','[]');`);
  const snapshot = run('pg_dump',['-U','bobuy','-d',db,'-Fc']);
  sql('BEGIN;\n'+readFileSync(new URL('V6__regional_delivery_trips.sql',dir),'utf8')+'\nCOMMIT;');
  assert.equal(sql("SELECT string_agg(status,',' ORDER BY id) FROM bb_trip"),'PUBLISHED,PUBLISHED,IN_PROGRESS,COMPLETED,COMPLETED,SETTLED');
  assert.equal(sql("SELECT delivery_area || ':' || delivery_date FROM bb_trip WHERE id=1"),'Region 1:2026-11-01');
  assert.equal(sql('SELECT count(*) FROM bb_order_header'),'4');
  assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_name='bb_trip' AND column_name IN ('origin','destination','depart_date','capacity','reserved_capacity')"),'0');
  for (const stmt of ["UPDATE bb_trip SET status='DRAFT' WHERE id=1", "UPDATE bb_trip SET delivery_area='   ' WHERE id=1"]) {
    const r=spawnSync('docker',[...args,'psql','-U','bobuy','-d',db,'-v','ON_ERROR_STOP=1'],{cwd:root,windowsHide:true,input:stmt,encoding:'utf8'});
    assert.notEqual(r.status,0);
  }
  report.checks.push('PASS: V1 through V5 fixture upgraded to V6; IDs, links, area and date preserved','PASS: empty, pending, partial procurement, delivered, cancelled and historical frozen statuses','PASS: obsolete columns removed, empty area and DRAFT rejected');
  run('pg_restore',['-U','bobuy','-d',db,'--clean','--if-exists','--exit-on-error'],snapshot);
  assert.equal(sql("SELECT origin || ':' || destination || ':' || capacity FROM bb_trip WHERE id=1"),'Old origin: Region 1:1');
  assert.equal(sql('SELECT count(*) FROM bb_order_header'),'4');
  report.checks.push('PASS: stopped-writer snapshot rollback restores V5 schema and business rows');
  report.result='PASS';
} finally {
  run('dropdb',['-U','bobuy',db]); report.temporaryDatabaseRemoved=true;
  const out=new URL('../docs/reports/evidence/PLAN63/local/',import.meta.url);mkdirSync(out,{recursive:true});
  writeFileSync(new URL('migration-report.json',out),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
