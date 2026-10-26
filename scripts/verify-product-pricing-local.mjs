import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';assert.equal(new URL(origin).hostname,'127.0.0.1');
const out=new URL('../docs/reports/evidence/product-pricing/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));const page=await context.newPage();
const report={scope:'Normal visible UI only on existing LOCAL synthetic private NAV-TEST-000; no API-write fixture setup, no production, no orders/payments',checks:{},errors:[],writes:[],draftIds:[]};
const evidenceOnly=process.argv.includes('--evidence-only'),resume=process.argv.includes('--remaining')||evidenceOnly;if(resume){const previous=JSON.parse(readFileSync(new URL('local-ui.json',out),'utf8'));assert.equal(previous.checks.explicitApprovalAndOverlapRejectionWithConflictId,'PASS');Object.assign(report,{checks:previous.checks,writes:previous.writes,draftIds:previous.draftIds});}
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))report.writes.push({method:r.method(),path:new URL(r.url()).pathname,host:new URL(r.url()).hostname});});
const pane=()=>page.getByRole('dialog').filter({hasText:'Selling prices and adjustments'});
const row=id=>pane().locator('tr[data-row-key="'+id+'"]:visible, article[data-adjustment-id="'+id+'"]:visible');
const jst=value=>new Date(Date.parse(value)+9*60*60*1000).toISOString().slice(0,19);
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
async function openPricing(){
 const pending=page.waitForResponse(r=>r.url().includes('/api/merchant/product-pricing/')&&r.request().method()==='GET');
 await page.locator('tr').filter({has:page.locator('input[value="NAV-TEST-000"]')}).getByRole('button',{name:'Selling prices and adjustments',exact:true}).click();
 const response=await pending;assert.equal(response.status(),200);const sheet=(await response.json()).data;await pane().getByText('Adjustment history',{exact:true}).waitFor();return sheet;
}
async function saveDraft(amount,start,end,editing=false){
 await pane().getByRole('spinbutton',{name:'Adjusted amount',exact:true}).fill(String(amount));
 await pane().getByLabel('Start time (JST, inclusive)',{exact:true}).fill(jst(start));await pane().getByLabel('End time (JST, exclusive)',{exact:true}).fill(jst(end));
 await pane().getByLabel('Source and review notes (internal)',{exact:true}).fill('Synthetic UI interval test only');
 const pending=page.waitForResponse(r=>r.url().includes('/adjustments')&&r.request().method()===(editing?'PUT':'POST'));
 await pane().getByRole('button',{name:editing?'Save draft changes':'Create adjustment draft',exact:true}).click();const response=await pending;assert.equal(response.status(),200,await response.text());return (await response.json()).data;
}
async function action(id,kind,expected=200){
 await row(id).getByRole('button',{name:kind==='approve'?'Approve adjustment':'Cancel adjustment',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Review pricing action',exact:true});assert(await modal.getByRole('button',{name:'OK',exact:true}).isDisabled());
 await modal.getByRole('checkbox').check();const pending=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/adjustments/'+id+'/'+kind)&&r.request().method()==='POST');
 await modal.getByRole('button',{name:'OK',exact:true}).click();const response=await pending;assert.equal(response.status(),expected,await response.text());
 if(expected!==200){await modal.getByRole('alert').waitFor();assert((await modal.innerText()).includes('ID: '+report.draftIds[0]));await modal.getByRole('button',{name:'Cancel',exact:true}).click();return;}
 const sheet=(await response.json()).data;await modal.waitFor({state:'hidden'});return sheet;
}
try{
 await page.goto(origin+'/admin/stock-master');await page.locator('#username, .product-catalog-panel').first().waitFor();
 if(await page.locator('#username').count()){await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/recommendations"]').first().waitFor();await page.goto(origin+'/admin/stock-master');}
 const initial=await openPricing();assert.equal(initial.visibility,'DRAFTER_ONLY');assert(initial.regular?.enabled);assert.equal(initial.regular.currency,'JPY');const original=initial.regular;
 report.originalRegular=original;
 if(evidenceOnly){
  const pending=page.waitForResponse(r=>r.url().includes('/api/merchant/product-pricing/')&&r.request().method()==='GET');await pane().getByRole('button',{name:'Reload',exact:true}).click();assert.equal((await pending).status(),200);
  assert.equal(initial.history.find(h=>h.value.id===report.draftIds[0]).state,'EXPIRED');assert.equal(initial.history.find(h=>h.value.id===report.draftIds[1]).state,'CANCELLED');assert.equal(initial.effective.amount,500);
  await page.setViewportSize({width:390,height:844});await row(report.draftIds[0]).scrollIntoViewIfNeeded();await shot('pricing-expired');report.checks.reloadAndExpiredMobileEvidence='PASS';
 }else if(resume){
  const [aId,bId]=report.draftIds;assert.equal(initial.history.find(h=>h.value.id===aId).state,'EXPIRED');assert.equal(initial.effective.amount,500);assert.equal(original.amount,500);
  report.expiryObservation={endedAt:initial.history.find(h=>h.value.id===aId).value.endsAt,observedAt:initial.now,restoredRegularAmount:initial.effective.amount};report.checks.realServerExpiryRestoresUnchangedRegularQuoteWithoutPublication='PASS';
  await row(bId).getByRole('button',{name:'Edit draft',exact:true}).click();const start=new Date(Math.floor(Date.now()/1000)*1000+60000).toISOString(),end=new Date(Date.parse(start)+60000).toISOString();
  await saveDraft(original.amount-100,start,end,true);let sheet=await action(bId,'approve');assert.equal(sheet.history.find(h=>h.value.id===bId).state,'SCHEDULED');await shot('pricing-desktop');await page.setViewportSize({width:390,height:844});await shot('pricing-mobile');
  sheet=await action(bId,'cancel');assert.equal(sheet.history.find(h=>h.value.id===bId).state,'CANCELLED');assert.equal(sheet.effective.amount,500);assert.deepEqual(sheet.regular,original);assert.equal(sheet.visibility,'DRAFTER_ONLY');report.checks.editScheduledCancelRetainsHistoryAndMobile='PASS';await shot('pricing-expired');
 }else{
 const now=Math.floor(Date.now()/1000)*1000,start=new Date(now-10000).toISOString(),end=new Date(now+70000).toISOString();
 let sheet=await saveDraft(original.amount-50,start,end);const a=sheet.history[0].value;report.draftIds.push(a.id);assert.equal(sheet.effective.amount,original.amount);assert.equal(a.status,'DRAFT');
 await pane().getByRole('button',{name:'Close',exact:true}).click();await page.reload();sheet=await openPricing();assert.equal(sheet.history.find(h=>h.value.id===a.id).value.amount,original.amount-50);report.checks.visibleDraftSaveRefreshReopen='PASS';
 sheet=await action(a.id,'approve');assert.equal(sheet.effective.amount,original.amount-50);assert.equal(sheet.history.find(h=>h.value.id===a.id).state,'ACTIVE');
 let second=await saveDraft(original.amount-100,start,end);const b=second.history[0].value;report.draftIds.push(b.id);await action(b.id,'approve',400);report.checks.explicitApprovalAndOverlapRejectionWithConflictId='PASS';
 await row(b.id).getByRole('button',{name:'Edit draft',exact:true}).click();second=await saveDraft(original.amount-100,end,new Date(Date.parse(end)+60000).toISOString(),true);sheet=await action(b.id,'approve');assert.equal(sheet.history.find(h=>h.value.id===b.id).state,'SCHEDULED');
 await shot('pricing-desktop');await page.setViewportSize({width:390,height:844});await shot('pricing-mobile');sheet=await action(b.id,'cancel');assert.equal(sheet.history.find(h=>h.value.id===b.id).state,'CANCELLED');assert.equal(sheet.effective.amount,original.amount-50);report.checks.adjacentSchedulingCancellationRetainsHistoryAndMobile='PASS';
 await page.setViewportSize({width:1440,height:1000});
 for(let remaining=Date.parse(end)+150-Date.now();remaining>0;remaining=Date.parse(end)+150-Date.now()){console.log('Waiting '+Math.ceil(remaining/1000)+' seconds for actual local server expiry');await page.waitForTimeout(Math.min(10000,remaining));}
 await pane().getByRole('button',{name:'Close',exact:true}).click();await page.reload();sheet=await openPricing();assert.equal(sheet.history.find(h=>h.value.id===a.id).state,'EXPIRED');assert.equal(sheet.effective.amount,original.amount);assert.deepEqual(sheet.regular,original);assert.equal(sheet.visibility,'DRAFTER_ONLY');
 assert.equal(await row(a.id).getByRole('button',{name:'Edit draft',exact:true}).count(),0);await shot('pricing-expired');report.checks.realServerExpiryRestoresUnchangedRegularQuoteWithoutPublication='PASS';
 }
 assert.deepEqual(report.errors,[]);assert(report.writes.every(w=>w.host==='127.0.0.1'));report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:fileURLToPath(new URL('failure.png',out)),fullPage:true}).catch(()=>{});throw error;}
finally{writeFileSync(new URL('local-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report));}
