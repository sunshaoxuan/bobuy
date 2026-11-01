import {chromium,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve(process.cwd(),'../../reference-v23-acceptance');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
let latest;const errors=[];
page.on('response',async r=>{if(r.url().includes('/api/merchant/recommendations')){try{const x=await r.json();if(x.data?.post)latest=x.data;else if(x.data?.detail)latest=x.data.detail;if(r.status()>=400)errors.push({status:r.status(),body:x});}catch{}}});
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const proof={baseCommit:'7b2e6a3619414c02d27a465e32a68c65130b732b',acceptanceFixes:['optionalMultipartBooleans','publicationConstraintFlushOrder'],realPgBackend:true,uiOnlyWrites:true,checks:[]};
try{proof.checks=JSON.parse(await fs.readFile(path.join(out,'ui-checkpoints.json'),'utf8'));}catch{}
async function mark(name){if(!proof.checks.includes(name))proof.checks.push(name);await fs.writeFile(path.join(out,'ui-checkpoints.json'),JSON.stringify(proof.checks));console.log(name);}
async function reopen(){const response=page.waitForResponse(r=>r.request().method()==='GET'&&/\/api\/merchant\/recommendations\/\d+$/.test(new URL(r.url()).pathname)&&r.ok());await page.reload();latest=(await (await response).json()).data;await expect(page.locator('.rec-product')).toHaveCount(latest.items.length);}
async function field(scope,label,value){await scope.getByLabel(label,{exact:true}).fill(value);}
async function details(scope){const d=scope.locator('details').first();if(!await d.getAttribute('open'))await d.locator('summary').click();}
async function selectChannel(scope,label){await scope.getByRole('combobox',{name:'Source channel',exact:true}).click();await page.getByTitle(label,{exact:true}).last().click();}
async function context(scope,message,channel='Costco warehouse'){
 await details(scope);for(const [label,value] of [['Supplier identity','SYNTHETIC-SUPPLIER'],['Exact specification / variant identity','pack'],['Source message / campaign identity',message],['Date evidence URL','https://www.costco.co.jp/synthetic-window-evidence'],['Original window applicability evidence','SYNTHETIC: this campaign applies to this exact test ITEM']])await field(scope,label,value);
 await selectChannel(scope,channel);
}
async function saveItem(card){await Promise.all([page.waitForResponse(r=>r.request().method()==='PUT'&&/\/items\/\d+$/.test(new URL(r.url()).pathname)&&r.ok()),card.getByRole('button',{name:'Save item facts',exact:true}).click()]);}
async function edit(card){await card.getByRole('button',{name:/^Edit item facts:/}).click();await expect(card.getByRole('button',{name:'Save item facts',exact:true})).toBeVisible();}
async function addFromMaster({start,end,price,message,channel}){
 const s=page.locator('.rec-from-product');const box=s.getByRole('combobox').first();await box.fill('SYN-UI-V23');await expect(page.locator('.ant-select-item-option').filter({hasText:'SYN-UI-V23'})).toHaveCount(1);await box.press('ArrowDown');await box.press('Enter');
 await field(s,'Offer / stated price (JPY)',price);await field(s,'Price unit (e.g. 100g / pack)','pack');await field(s,'Offer / redemption start',start);await field(s,'Offer / redemption end',end);await context(s,message,channel);
 await s.getByRole('checkbox',{name:/I reviewed the exact ITEM/}).check();
 await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/from-product')&&r.ok()),s.getByRole('button',{name:'Register this issue with selected product',exact:true}).click()]);
}
try{
 await page.goto('http://127.0.0.1:18080/admin/recommendations');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/me')&&r.ok()),page.locator('button[type=submit]').click()]);await page.waitForURL('**/admin/users');await page.goto('http://127.0.0.1:18080/admin/recommendations');await expect(page.getByRole('button',{name:/New Article/})).toBeVisible({timeout:15000});console.log('Normal UI login and recommendations route ready');
 let resume;try{resume=(await fs.readFile(path.join(out,'ui-current-url.txt'),'utf8')).trim();}catch{}
 if(resume){await page.goto(resume);await expect(page.locator('#rec-title')).toBeVisible();await reopen();}else{await page.getByRole('button',{name:/New Article/}).click();await expect(page.locator('#rec-title')).toBeVisible();await fs.writeFile(path.join(out,'ui-current-url.txt'),page.url());}
 if(!proof.checks.includes('unknownStartSavedAndReopened')){
 await page.locator('#rec-title').fill('SYNTHETIC V23 UI ACCEPTANCE');await page.locator('#rec-body').fill('Isolated local test. No real products, prices or publication.');await page.getByRole('button',{name:/Save Draft/}).click();
 await page.locator('input[type=file]').first().setInputFiles(path.resolve(process.cwd(),'../../storage-ui-fixture/synthetic-rustfs-a.png'));
 const q=page.locator('.rec-upload-row').first();await field(q,'Product name *','SYNTHETIC V23 PRODUCT');await field(q,'Item number (string, optional)','SYN-UI-V23');await field(q,'Offer / stated price (JPY)','100');await field(q,'Price unit (e.g. 100g / pack)','pack');await field(q,'Offer / redemption end',day(20));await context(q,'SYNTHETIC-MAIL-1');await q.getByRole('checkbox',{name:/Item, campaign header/}).check();
 await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/images')&&r.ok()),q.getByRole('button',{name:'Register',exact:true}).click()]);
 await reopen();await expect(page.locator('.rec-product').first()).toContainText('？');await mark('unknownStartSavedAndReopened');}
 const url=page.url();let card=page.locator('.rec-product').first();
 if(!proof.checks.includes('verifiedCampaignInheritanceSavedAndReopened')){
 await edit(card);await details(card);await field(card,'Campaign start date',day(-1));await field(card,'Campaign end date',day(10));await card.getByRole('checkbox',{name:/I verified this campaign window/}).check();await saveItem(card);await reopen();await expect(page.locator('.rec-product').first()).toContainText('Inherited verified campaign window');await mark('verifiedCampaignInheritanceSavedAndReopened');}
 if(!proof.checks.includes('itemOverrideAndImmutablePriceHistory')){
 card=page.locator('.rec-product').first();await edit(card);await field(card,'Offer / redemption start',day(0));await field(card,'Offer / stated price (JPY)','90');await saveItem(card);await page.reload();card=page.locator('.rec-product').first();await expect(card).toContainText(day(0));
 await card.getByRole('button',{name:'Reference quote revision history',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('100 JPY');await expect(page.getByRole('dialog')).toContainText('90 JPY');await page.getByRole('button',{name:'Close',exact:true}).click();await mark('itemOverrideAndImmutablePriceHistory');}
 if(!proof.checks.includes('sameMasterSameImageNewWindowSavedAndReopened')){
 if(!latest?.items?.[0]?.gallery?.length){
  await page.goto('http://127.0.0.1:18080/admin/products');await page.locator('.record-title').filter({hasText:'SYNTHETIC V23 PRODUCT'}).click();const drawer=page.locator('.catalog-editor .ant-drawer-content');await drawer.getByRole('tab',{name:'Images & sources',exact:true}).click();
  await drawer.getByLabel('Official image sources',{exact:true}).last().fill('https://www.costco.co.jp/synthetic-only-test-image.png');await drawer.getByRole('checkbox',{name:/I verified the exact item\/specification/}).check();
  await drawer.locator('input[type=file]').setInputFiles(path.resolve(process.cwd(),'../../storage-ui-fixture/synthetic-rustfs-a.png'));await expect(drawer.locator('.catalog-compact-cover img')).toBeVisible();
  await drawer.getByRole('checkbox',{name:/I reviewed the data, exact model/}).check();await Promise.all([page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/api/merchant/product-catalog')&&r.ok()),drawer.getByRole('button',{name:'Confirm and save masters',exact:true}).click()]);
  await page.goto(url);await reopen();await mark('syntheticMasterGalleryMaintainedViaNormalUI');
 }
 if(page.locator('.rec-product')&&await page.locator('.rec-product').count()<2)await addFromMaster({start:day(1),end:day(5),price:'80',message:'SYNTHETIC-MAIL-2',channel:'Costco warehouse'});await reopen();await expect(page.locator('.rec-product')).toHaveCount(2);await mark('sameMasterSameImageNewWindowSavedAndReopened');}
 if(await page.locator('.rec-product').count()<3){
 await addFromMaster({start:day(0),end:day(20),price:'999',message:'SYNTHETIC-MAIL-3',channel:'Costco Online'});await reopen();await expect(page.locator('.rec-product')).toHaveCount(3);}
 if(!await page.getByRole('button',{name:/Withdraw/}).count()){
 card=page.locator('.rec-product').nth(1);await edit(card);await field(card,'Offer / redemption start',day(0));await saveItem(card);
 await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/publish')&&r.ok()),page.getByRole('button',{name:/^send Publish$|^Publish$/}).click()]);await expect(page.getByRole('button',{name:/Withdraw/})).toBeVisible();await reopen();}
 const cards=page.locator('.rec-product');await expect(cards.nth(0)).toContainText('Conflicting prices in this window');await expect(cards.nth(1)).toContainText('Conflicting prices in this window');await expect(cards.nth(2)).toContainText('999 JPY');proof.checks.push('overlapConflictNotReceiptPriorityAndOnlineIsolated');
 proof.itemCount=latest.items.length;proof.productIds=[...new Set(latest.items.map(i=>i.productId))];proof.imageHashes=[...new Set(latest.items.map(i=>i.imageHash))];proof.resolutions=latest.items.map(i=>i.referenceQuote);expect(proof.productIds).toHaveLength(1);expect(proof.imageHashes).toHaveLength(1);
 await page.setViewportSize({width:390,height:844});await page.reload();expect(await page.evaluate(()=>innerWidth)).toBe(390);await expect(page.locator('.rec-product')).toHaveCount(3);await page.screenshot({path:path.join(out,'app-mobile.png'),fullPage:true});proof.checks.push('real390pxBackendReopen');
 proof.url=url;proof.result='PASS';proof.errors=errors;await fs.writeFile(path.join(out,'ui-proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}catch(e){await page.screenshot({path:path.join(out,'app-failure.png'),fullPage:true});await fs.writeFile(path.join(out,'ui-failure.txt'),String(e)+'\n'+(await page.locator('body').innerText()).slice(-14000));console.error(String(e));process.exitCode=1;}finally{await browser.close();}
