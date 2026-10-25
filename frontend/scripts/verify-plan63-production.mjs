import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../node_modules/playwright-core/index.mjs';

const origin='https://bobuy.cc';
const release=process.env.BOBUY_RELEASE;
assert.match(release||'',/^20261025\.[1-9][0-9]*$/);
const output=new URL('../../docs/reports/evidence/PLAN63/production/',import.meta.url);
mkdirSync(output,{recursive:true});
const ssh=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41'];
const credentials=JSON.parse(execFileSync('ssh',[...ssh,'cat /etc/bobuy-admin.json'],{encoding:'utf8',windowsHide:true}));
const marker='PLAN63_'+Date.now();
const fixtures={marker,trips:[]};
const report={release,origin,startedAt:new Date().toISOString(),data:'Production HTTPS; explicitly labelled zero-value acceptance fixtures',checks:[],views:[],states:[],fixtures};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const contexts=[];
async function call(context,token,method,path,data,status=200){
 const response=await context.request[method](origin+'/api'+path,{headers:token?{Authorization:'Bearer '+token}:{},data});
 assert.equal(response.status(),status,method+' '+path+' status');
 return status===200?(await response.json()).data:null;
}
async function login(width,height){
 const context=await browser.newContext({viewport:{width,height}});contexts.push(context);
 await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
 const page=await context.newPage();
 const view={width,height,errors:[],network:[],telemetry:[]};report.views.push(view);
 page.on('pageerror',e=>view.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')view.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)view.network.push({status:r.status(),path:new URL(r.url()).pathname});});
 page.on('requestfailed',r=>{const url=new URL(r.url());if(url.origin===origin){const failure={path:url.pathname,error:r.failure()?.errorText};if(url.pathname==='/cdn-cgi/rum'&&failure.error?.includes('ERR_ABORTED'))view.telemetry.push(failure);else view.network.push(failure);}});
 await page.goto(origin+'/admin',{waitUntil:'networkidle'});
 await page.locator('#username').fill(credentials.username);await page.locator('#password').fill(credentials.password);
 const identity=page.waitForResponse(r=>r.url()===origin+'/api/auth/me'&&r.request().method()==='GET');
 const accounts=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/users'&&r.request().method()==='GET');
 await page.locator('button[type=submit]').click();await page.waitForURL('**/admin/users');
 const identityResponse=await identity;assert.equal(identityResponse.status(),200);await identityResponse.finished();
 const accountsResponse=await accounts;assert.equal(accountsResponse.status(),200);await accountsResponse.finished();
 await page.waitForLoadState('networkidle');
 await page.goto(origin+'/admin/trips',{waitUntil:'networkidle'});
 const token=await page.evaluate(()=>localStorage.getItem('bobbuy_access_token'));assert(token);
 const user=await call(context,token,'get','/auth/me');
 return {context,page,token,user,view};
}
async function refresh(client,status=200){
 const csrf=(await client.context.cookies()).find(c=>c.name==='bobbuy_csrf_token');assert(csrf);
 const response=await client.context.request.post(origin+'/api/auth/refresh',{headers:{'X-BOBBUY-CSRF-TOKEN':csrf.value}});
 assert.equal(response.status(),status,'independent session refresh');
 if(status===200){client.token=(await response.json()).data.accessToken;assert(client.token);}
}
async function create(client,label,date){
 await client.page.locator('#deliveryArea').fill(marker+' '+label);
 await client.page.locator('#deliveryDate').fill(date);await client.page.locator('#deliveryDate').press('Enter');
 const pending=client.page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/trips'));
 await client.page.locator('[data-testid=trips-submit]').click();const response=await pending;
 assert.equal(response.status(),200);const trip=(await response.json()).data;fixtures.trips.push(trip.id);
 writeFileSync(new URL('fixture-scope.json',output),JSON.stringify(fixtures,null,2));
 assert.deepEqual(Object.keys(response.request().postDataJSON()).sort(),['deliveryArea','deliveryDate']);
 assert.equal(trip.status,'PUBLISHED');assert.equal(trip.deliveryDate,date);
 assert(!('capacity'in trip)&&!('origin'in trip)&&!('departDate'in trip));
 return trip;
}
try{
 const desktop=await login(1440,1000),mobile=await login(390,844);
 assert.equal(desktop.user.id,mobile.user.id);
 const tokens=await Promise.all(contexts.map(c=>c.cookies().then(cs=>cs.find(v=>v.name==='bobbuy_refresh_token'))));
 assert(tokens.every(c=>c?.secure&&c?.httpOnly));assert.notEqual(tokens[0].value,tokens[1].value);
 const html=await (await desktop.context.request.get(origin)).text();
 const localHtml=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const assets=[...localHtml.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]);assert(assets.length>0);
 for(const asset of assets){assert(html.includes(asset));assert.deepEqual(await(await desktop.context.request.get(origin+asset)).body(),readFileSync(new URL('../dist'+asset,import.meta.url)));}
 report.assets=assets;report.checks.push('Exact production frontend assets match candidate');
 await Promise.all([refresh(desktop),refresh(mobile)]);
 report.checks.push('Same account: two browser logins, distinct secure HttpOnly cookies, concurrent independent refresh');
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const trip=await create(desktop,'desktop',date);const second=await create(mobile,'mobile',date);assert.notEqual(trip.id,second.id);
 assert.equal(trip.agentId,desktop.user.id);assert.equal(second.agentId,desktop.user.id);
 report.checks.push('Both sessions create via real UI; strict area/date payload; authenticated account ownership');
 for(const field of ['agentId','status','capacity','origin','destination','departDate'])await call(desktop.context,desktop.token,'post','/trips',{deliveryArea:'Invalid acceptance fixture',deliveryDate:date,[field]:field==='status'?'COMPLETED':1},400);
 await call(desktop.context,desktop.token,'patch','/trips/'+trip.id+'/status',{status:'COMPLETED'},404);
 const password=randomBytes(24).toString('base64url');
 const customer=await call(desktop.context,desktop.token,'post','/admin/users',{username:marker.toLowerCase(),name:marker,email:marker.toLowerCase()+'@example.invalid',password,roles:['CUSTOMER'],enabled:true});
 fixtures.customer=customer.id;writeFileSync(new URL('fixture-scope.json',output),JSON.stringify(fixtures,null,2));
 const order=await call(desktop.context,desktop.token,'post','/orders',{status:'NEW',deliveryStatus:'PENDING_DELIVERY',businessId:marker,customerId:customer.id,tripId:trip.id,lines:[{skuId:marker,itemName:marker,quantity:100000,unitPrice:0}]});
 report.states.push((await call(desktop.context,desktop.token,'get','/trips/'+trip.id)).status);
 for(const [orderState,tripState] of [['CONFIRMED','PUBLISHED'],['PURCHASED','IN_PROGRESS'],['DELIVERED','COMPLETED']]){
  await call(desktop.context,desktop.token,'patch','/orders/'+order.id+'/status',{status:orderState});
  assert.equal((await call(mobile.context,mobile.token,'get','/trips/'+trip.id)).status,tripState);report.states.push(tripState);
 }
 for(const action of ['RECEIPT','BILLING'])await call(desktop.context,desktop.token,'post','/procurement/'+trip.id+'/ledger/'+marker+'/confirm',{action});
 await call(desktop.context,desktop.token,'post','/procurement/'+trip.id+'/finalize-settlement');
 assert.equal((await call(mobile.context,mobile.token,'get','/trips/'+trip.id)).status,'SETTLED');report.states.push('SETTLED');
 await call(desktop.context,desktop.token,'post','/procurement/'+trip.id+'/finalize-settlement',undefined,400);
 report.checks.push('100000 quantity accepted; order purchase/delivery and actual settlement automatically advance trip; repeat settlement rejected');
 for(const client of [desktop,mobile]){
  await client.page.reload({waitUntil:'networkidle'});await client.page.locator('.regional-trips-table').waitFor();
  assert((await client.page.locator('.regional-trips-table').innerText()).includes(marker));
  assert(await client.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await client.page.screenshot({path:fileURLToPath(new URL('trips-'+client.view.width+'.png',output)),fullPage:true});
  await client.page.locator('.trip-editor').screenshot({path:fileURLToPath(new URL('editor-'+client.view.width+'.png',output))});
  assert.deepEqual(client.view.errors,[]);assert.deepEqual(client.view.network,[]);
 }
 const csrf=(await desktop.context.cookies()).find(c=>c.name==='bobbuy_csrf_token');
 assert.equal((await desktop.context.request.post(origin+'/api/auth/logout',{headers:{'X-BOBBUY-CSRF-TOKEN':csrf.value}})).status(),200);
 const fresh=(await mobile.context.cookies()).find(c=>c.name==='bobbuy_csrf_token');
 const oldCookie=(await desktop.context.cookies()).find(c=>c.name==='bobbuy_refresh_token');assert(!oldCookie);
 await refresh(mobile);await call(mobile.context,mobile.token,'get','/trips/'+second.id);
 assert.equal((await mobile.context.request.post(origin+'/api/auth/refresh',{headers:{'X-BOBBUY-CSRF-TOKEN':'forged'}})).status(),403);
 await mobile.context.request.post(origin+'/api/auth/logout',{headers:{'X-BOBBUY-CSRF-TOKEN':(await mobile.context.cookies()).find(c=>c.name==='bobbuy_csrf_token').value}});
 report.checks.push('Logout in desktop does not revoke mobile refresh/read; forged CSRF rejected; both test sessions logged out');
 report.functionalResult='PASS';report.browserResult='PASS';
}finally{
 for(const context of contexts){
  const csrf=(await context.cookies()).find(c=>c.name==='bobbuy_csrf_token');
  if(csrf)await context.request.post(origin+'/api/auth/logout',{headers:{'X-BOBBUY-CSRF-TOKEN':csrf.value}});
 }
 await browser.close();
 if(fixtures.trips.length||fixtures.customer){
  try{
   const cleanup=readFileSync(new URL('../../scripts/cleanup-regional-production.py',import.meta.url),'utf8');
   const result=execFileSync('ssh',[...ssh,'python3 - '+"'"+JSON.stringify(fixtures)+"'"],{input:cleanup,encoding:'utf8',windowsHide:true});
   assert(result.includes('fixture_trips=0'));assert(!fixtures.customer||result.includes('fixture_customers=0'));
   report.fixtureCleanup='PASS';
  }catch(e){report.fixtureCleanup='FAIL';report.cleanupError='Remote cleanup failed; inspect explicit fixture-scope.json';}
 }
 report.finishedAt=new Date().toISOString();
 report.result=report.functionalResult==='PASS'&&report.browserResult==='PASS'&&report.fixtureCleanup==='PASS'?'PASS':'FAIL';
 writeFileSync(new URL('browser-report.json',output),JSON.stringify(report,null,2));
}
assert.equal(report.result,'PASS');console.log(JSON.stringify({release,result:report.result,checks:report.checks,states:report.states,cleanup:report.fixtureCleanup}));
