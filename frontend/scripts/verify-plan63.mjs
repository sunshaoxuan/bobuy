import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';
import { measureMerchantControls } from './measure-merchant.mjs';
const origin='http://127.0.0.1:18080';
const output=new URL('../../docs/reports/evidence/PLAN63/local/',import.meta.url);
mkdirSync(output,{recursive:true});
const report={origin,data:'Local seeded database and explicitly labelled browser-only empty fixture',views:[],geometryFailures:[],checks:[],fixtureTripIds:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const contrast=async(page,selector)=>page.locator(selector).evaluateAll(elements=>elements.map(e=>{
 const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),lum=a=>a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
 const style=getComputedStyle(e);let parent=e,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=='rgba(0, 0, 0, 0)')break;parent=parent.parentElement;}
 const a=lum(rgb(style.color)),b=lum(rgb(bg||'rgb(255,255,255)'));return {text:e.textContent.trim(),foreground:style.color,background:bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
}));
const snapshot=async(page,name,locator)=>locator?locator.screenshot({path:fileURLToPath(new URL(name+'.png',output)),animations:'disabled'}):page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:true,animations:'disabled'});
async function expectReady(api){for(let i=0;i<30;i++){const r=await api.request.get(origin+'/api/storefront/trips');if(r.status()===200)return;await new Promise(r=>setTimeout(r,1000));}throw new Error('local API readiness timeout');}
async function geometry(page,view,state){
 const values=await page.evaluate(measureMerchantControls,'.trip-editor button,.trip-editor input.ant-input,.trip-editor textarea.ant-input,.trip-editor .ant-picker,.regional-trips-table button,.regional-trips-table .ant-pagination-item');
 view.controls.push({state,values});
 for(const c of values){
  const key=view.width+'/'+view.locale+'/'+state+'/'+c.name;
  if(c.hitArea.height<43.99) report.geometryFailures.push(key+': hit height '+c.hitArea.height);
  if(c.glyph){
   if(Object.values(c.margins).some(v=>v<2.99))report.geometryFailures.push(key+': ink margins '+JSON.stringify(c.margins));
   const t=Math.min(2,c.glyph.height*.1)+.01;
   if((c.alignment!=='top-start' && Math.abs(c.centerError.y)>t) || (c.alignment==='center' && Math.abs(c.centerError.x)>t))report.geometryFailures.push(key+': ink center '+JSON.stringify(c.centerError));
  }
 }
 const actions=values.filter(c=>c.name.includes('Save')||c.name.includes('Cancel')||c.name.includes('保存')||c.name.includes('取消')||c.name.includes('キャンセル')||c.name.includes('儲存'));
 if(actions.length===2){const [a,b]=actions.sort((a,b)=>a.hitArea.x-b.hitArea.x);assert(b.hitArea.x-a.hitArea.x-a.hitArea.width>=6);}
}
try{
 const api=await browser.newContext();
 await expectReady(api);
 const login=await (await api.request.post(origin+'/api/auth/login',{data:{username:'agent',password:'agent-pass'}})).json();
 assert(login.data?.accessToken,'local login');
 const session=login.data,headers={Authorization:'Bearer '+session.accessToken};
 async function request(method,path,data,status=200){const r=await api.request[method](origin+'/api'+path,{headers,data});assert.equal(r.status(),status,path+': '+await r.text());return (await r.json()).data;}
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 const created=await request('post','/trips',{deliveryArea:'PLAN63 Tokyo regional delivery',deliveryDate:date});
 report.fixtureTripIds.push(created.id);
 assert.equal(created.agentId,session.user.id);assert.equal(created.status,'PUBLISHED');
 assert(!('capacity' in created)&&!('origin' in created)&&!('departDate' in created));
 for(const field of ['agentId','status','capacity','reservedCapacity','origin','destination','departDate'])await request('post','/trips',{deliveryArea:'Invalid',deliveryDate:date,[field]:field==='status'?'COMPLETED':1},400);
 await request('post','/trips',{deliveryArea:' ',deliveryDate:date},400);
 const removed=await api.request.patch(origin+'/api/trips/'+created.id+'/status',{headers,data:{status:'COMPLETED'}});assert([404,405].includes(removed.status()));
 report.checks.push('PASS: authenticated ownership; strict two-field writes; removed manual-status endpoint');
 const customerLogin=await (await api.request.post(origin+'/api/auth/login',{data:{username:'customer',password:'customer-pass'}})).json();
 const customer=customerLogin.data.user;assert(customer.roles.includes('CUSTOMER'));
 const order=await request('post','/orders',{status:'NEW',deliveryStatus:'PENDING_DELIVERY',businessId:'PLAN63-'+Date.now(),customerId:customer.id,tripId:created.id,lines:[{skuId:'prd-1000',itemName:'Matcha',quantity:100000,unitPrice:10}]});
 for(const [orderState,tripState]of [['CONFIRMED','PUBLISHED'],['PURCHASED','IN_PROGRESS'],['DELIVERED','COMPLETED']]){
  await request('patch','/orders/'+order.id+'/status',{status:orderState});
  assert.equal((await request('get','/trips/'+created.id)).status,tripState);
 }

 const customerContext=await browser.newContext({viewport:{width:390,height:844}});
 await customerContext.addInitScript(session=>{if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_auth_user',JSON.stringify(session.user));localStorage.setItem('bobbuy_access_token',session.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',String(Date.now()+3600000));},customerLogin.data);
 const billing=await customerContext.newPage();const billingErrors=[];billing.on('pageerror',e=>billingErrors.push(e.message));billing.on('console',m=>{if(m.type()==='error')billingErrors.push(m.text());});billing.on('response',r=>{if(r.status()>=400)billingErrors.push(r.status()+' '+r.url());});
 await billing.goto(origin+'/client/billing',{waitUntil:'networkidle'});
 await billing.locator('.ant-select-selector').first().click();await billing.locator('.ant-select-item-option-content').filter({hasText:created.deliveryArea}).click();
 const receiptButton=billing.getByRole('button',{name:'Confirm receipt',exact:true});await receiptButton.waitFor();assert(await receiptButton.isEnabled());
 report.billingViews=[];
 for(const [width,height]of [[360,800],[390,844],[768,1024],[1440,1000]])for(const locale of ['zh-CN','zh-TW','en-US','ja-JP']){
  await billing.setViewportSize({width,height});await billing.evaluate(locale=>localStorage.setItem('bobbuy_locale',locale),locale);await billing.reload({waitUntil:'networkidle'});
  await billing.locator('.ant-select-selector').first().click();await billing.locator('.ant-select-item-option-content').filter({hasText:created.deliveryArea}).click();await billing.locator('.client-billing-actions button').first().waitFor();await billing.evaluate(()=>document.fonts.ready);
  assert.equal(await billing.locator('html').getAttribute('lang'),locale,'actual billing locale');
  assert(!(await billing.locator('.client-billing-page').innerText()).includes('PENDING_CONFIRMATION'),'internal billing enum shown');
  if(locale!=='en-US')assert(!(await billing.locator('.ant-alert-description').innerText()).includes('Delivery completed'),'untranslated freeze reason');
  assert(await billing.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'billing page overflow');
  const bounds=await billing.locator('.client-list-card').first().evaluate(e=>{const card=e.getBoundingClientRect(),table=e.querySelector('.ant-descriptions').getBoundingClientRect();return {cardRight:card.right,tableRight:table.right};});assert(bounds.tableRight<=bounds.cardRight-10,'billing descriptions clipped');
  assert((await billing.locator('.client-billing-header .ant-select-selection-item').innerText()).startsWith(date),'delivery date must lead the selected label');
  const selector=await billing.locator('.client-billing-header .ant-select').boundingBox();assert(selector.x>=15&&selector.x+selector.width<=width-15,'billing selector clipped');
  await snapshot(billing,'billing-'+width+'-'+locale);
  if(width===390&&locale==='en-US'){await snapshot(billing,'billing-delivered-390');await snapshot(billing,'billing-actions-original',billing.locator('.client-billing-actions'));}
  const values=await billing.evaluate(measureMerchantControls,'.client-billing-actions button');report.billingViews.push({width,height,locale,controls:values});
  for(const c of values){const key='billing/'+width+'/'+locale+'/'+c.name;if(c.hitArea.height<43.99)report.geometryFailures.push(key+': hit height '+c.hitArea.height);if(c.glyph&&(Object.values(c.margins).some(v=>v<2.99)||Math.abs(c.centerError.y)>Math.min(2,c.glyph.height*.1)+.01||Math.abs(c.centerError.x)>Math.min(2,c.glyph.height*.1)+.01))report.geometryFailures.push(key+': ink geometry');}
  if(values.length===2){const [a,b]=values;const gap=b.hitArea.y>=a.hitArea.y+a.hitArea.height?b.hitArea.y-a.hitArea.y-a.hitArea.height:b.hitArea.x-a.hitArea.x-a.hitArea.width;assert(gap>=6,'billing action gap');}
 }
 await billing.setViewportSize({width:390,height:844});await billing.evaluate(()=>localStorage.setItem('bobbuy_locale','en-US'));await billing.reload({waitUntil:'networkidle'});await billing.locator('.ant-select-selector').first().click();await billing.locator('.ant-select-item-option-content').filter({hasText:created.deliveryArea}).click();
 for(const name of ['Confirm receipt','Confirm statement']){await billing.getByRole('button',{name,exact:true}).click();const response=billing.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/confirm'));await billing.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();assert.equal((await response).status(),200);await billing.getByRole('dialog').waitFor({state:'hidden'});}
 assert.deepEqual(billingErrors,[]);await customerContext.close();
 await request('post','/procurement/'+created.id+'/payments',{businessId:order.businessId,amount:10,paymentMethod:'CASH'});
 report.checks.push('PASS: delivered-trip customer receipt and statement confirmation in real browser; offline payment before final settlement');
 await request('post','/procurement/'+created.id+'/finalize-settlement');
 await request('post','/procurement/'+created.id+'/payments',{businessId:order.businessId,amount:10,paymentMethod:'CASH'},400);
 assert.equal((await request('get','/trips/'+created.id)).status,'SETTLED');
 report.checks.push('PASS: quantity 100000 accepted; automatic published/in-progress/completed/settled workflow');
 const longArea=('区域送货 Tokyo regional delivery 京都大阪 ' .repeat(10)).slice(0,255);
 const editable=await request('post','/trips',{deliveryArea:longArea,deliveryDate:date});
 report.fixtureTripIds.push(editable.id);
 for(const [width,height]of [[360,800],[390,844],[768,1024],[1440,1000]])for(const locale of ['zh-CN','zh-TW','en-US','ja-JP']){
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(({session,locale})=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_auth_user',JSON.stringify(session.user));localStorage.setItem('bobbuy_access_token',session.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',String(Date.now()+3600000));},{session,locale});
  const page=await context.newPage();const view={width,height,locale,errors:[],network:[],controls:[]};report.views.push(view);
  page.on('pageerror',e=>view.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')view.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)view.network.push(r.status()+' '+r.url());});page.on('requestfailed',r=>view.network.push(r.url()+' '+r.failure()?.errorText));
  await page.goto(origin+'/admin/trips',{waitUntil:'networkidle'});await page.locator('.regional-trips-table .ant-table-row').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow');
  if(width<768)assert.equal(await page.locator('.merchant-content').evaluate(e=>e.getBoundingClientRect().x+parseFloat(getComputedStyle(e).paddingLeft)),16);
  const area=page.locator('.regional-trips-table [data-row-key="'+editable.id+'"]').locator('[tabindex="0"]');
  assert.equal(await area.getAttribute('title'),null);
  assert(await area.evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)*3+1),'regional summary exceeds three lines');
  await area.focus();await page.locator('.ant-tooltip-inner').filter({hasText:longArea}).waitFor();
  if(width===390&&locale==='zh-CN')await snapshot(page,'full-region-tooltip-original',page.locator('.ant-tooltip-inner'));
  await page.locator('#deliveryArea').focus();await page.locator('.ant-tooltip-inner').waitFor({state:'hidden'});
  view.contrast=await contrast(page,'.regional-trips-table th,.trip-list-heading>span,.regional-trips-table .ant-tag');
  assert(view.contrast.every(c=>c.ratio>=4.5),'trip text contrast');
  await snapshot(page,'trips-'+width+'-'+locale);await geometry(page,view,'create');
  const table=page.locator('.ant-table-content');await table.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
  await page.locator('.regional-trips-table [data-row-key="'+editable.id+'"]').locator('button').click();
  await page.locator('#deliveryArea').fill(longArea);await page.waitForTimeout(200);
  assert.equal(await page.locator('#deliveryArea').inputValue(),longArea);
  assert(await page.locator('#deliveryArea').evaluate(e=>e.tagName==='TEXTAREA'&&e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1),'long regional input clipping');
  await snapshot(page,'edit-'+width+'-'+locale);await geometry(page,view,'edit');
  if(width===390&&locale==='zh-CN'){
   await snapshot(page,'editor-original',page.locator('.trip-editor'));
   await page.locator('#deliveryArea').fill('PLAN63 东京都区域送货');
   const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/api/trips/'));
   await page.locator('[data-testid=trips-submit]').click();const response=await saved;assert.equal(response.status(),200);assert.deepEqual(Object.keys(response.request().postDataJSON()).sort(),['deliveryArea','deliveryDate']);
   await page.locator('.trip-editor-heading').filter({hasText:'发布送货安排'}).waitFor();
   report.checks.push('PASS: actual browser edit saved with two-field payload');
   await request('put','/trips/'+editable.id,{deliveryArea:longArea,deliveryDate:date});
  }
  assert.deepEqual(view.errors,[]);assert.deepEqual(view.network,[]);await context.close();
 }
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(session=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_auth_user',JSON.stringify(session.user));localStorage.setItem('bobbuy_access_token',session.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',String(Date.now()+3600000));},session);
 const page=await context.newPage();
 report.related={errors:[],network:[]};
 page.on('pageerror',e=>report.related.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.related.errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)report.related.network.push(r.status()+' '+r.url());});page.on('requestfailed',r=>report.related.network.push(r.url()+' '+r.failure()?.errorText));
 for(const route of ['dashboard','orders','procurement','picking']){await page.goto(origin+'/admin/'+route,{waitUntil:'networkidle'});await snapshot(page,'related-'+route+'-390');}
 await page.goto(origin,{waitUntil:'networkidle'});await snapshot(page,'storefront-390');
 await page.goto(origin+'/admin/trips',{waitUntil:'networkidle'});
 await page.locator('#deliveryArea').fill('PLAN63 browser-created regional delivery');await page.locator('#deliveryDate').fill(date);await page.locator('#deliveryDate').press('Enter');
 const createResponse=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/api/trips'));await page.locator('[data-testid=trips-submit]').click();const createdInBrowser=await createResponse;assert.equal(createdInBrowser.status(),200);assert.deepEqual(Object.keys(createdInBrowser.request().postDataJSON()).sort(),['deliveryArea','deliveryDate']);report.fixtureTripIds.push((await createdInBrowser.json()).data.id);report.checks.push('PASS: actual browser create saved with two-field payload');
 await page.route('**/api/trips',r=>r.fulfill({json:{status:'success',data:[]}}));await page.goto(origin+'/admin/trips',{waitUntil:'networkidle'});await page.locator('.ant-table-placeholder').waitFor();await snapshot(page,'empty-fixture-390');
 await page.locator('[data-testid=trips-submit]').click();await page.locator('.ant-form-item-explain-error').nth(1).waitFor();assert.equal(await page.locator('.ant-form-item-explain-error').count(),2);await snapshot(page,'required-fields-390');
 assert.deepEqual(report.related.errors,[]);assert.deepEqual(report.related.network,[]);
 await page.setContent('<button style="height:20px;width:80px">Too small</button>');const bad=await page.evaluate(measureMerchantControls,'button');assert(bad[0].hitArea.height<44);report.checks.push('PASS: negative geometry fixture rejected; required fields; empty browser fixture');
 await context.close();
 report.functionalResult='PASS';report.geometryResult=report.geometryFailures.length?'FAIL':'PASS';
 }finally{
 await browser.close();
 if(report.fixtureTripIds.length){
  const ids=report.fixtureTripIds.map(id=>{assert(Number.isSafeInteger(id));return id;}).join(',');
  const scope=' IN ('+ids+')';
  const sql=['BEGIN;', 'UPDATE partner_wallets w SET balance=balance-x.amount FROM (SELECT partner_id,sum(amount) amount FROM wallet_transactions WHERE trip_id'+scope+' GROUP BY partner_id) x WHERE w.partner_id=x.partner_id;', 'DELETE FROM bb_chat_message WHERE trip_id'+scope+' OR order_id IN (SELECT id FROM bb_order_header WHERE trip_id'+scope+');', ...['wallet_transactions','bb_financial_audit_log','bb_customer_payment_ledger','bb_trip_profit_share_config','bb_trip_logistics_tracking','bb_trip_expense','bb_procurement_receipt','bb_order_header'].map(t=>'DELETE FROM '+t+' WHERE trip_id'+scope+';'),'DELETE FROM bb_trip WHERE id'+scope+';','COMMIT;'].join('\n');
  execFileSync('docker',['compose','-p','bobuy-local','-f','compose.local.yml','exec','-T','postgres','psql','-U','bobuy','-d','bobuy','-v','ON_ERROR_STOP=1'],{cwd:fileURLToPath(new URL('../../',import.meta.url)),windowsHide:true,input:sql,stdio:['pipe','ignore','pipe']});report.fixturesRemoved=true;
 }
 writeFileSync(new URL('browser-report.json',output),JSON.stringify(report,null,2));}
console.log(JSON.stringify({functionalResult:report.functionalResult,views:report.views.length,geometryResult:report.geometryResult,geometryFailures:report.geometryFailures}));
