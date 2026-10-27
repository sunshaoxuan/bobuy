import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';assert.equal(new URL(origin).hostname,'127.0.0.1');
const out=new URL('../docs/reports/evidence/product-lifecycle/',import.meta.url);mkdirSync(out,{recursive:true});
const dictionary=readFileSync(new URL('../frontend/src/locales/en-US.ts',import.meta.url),'utf8');
function t(key){const m=dictionary.match(new RegExp(`['"]${key.replaceAll('.','\\.')}['"]:\\s*(['"])(.*?)\\1`));assert(m,key);return m[2];}
const report={scope:'Existing shared LOCAL environment; synthetic article/product created, hidden and restored through visible UI only; no production writes',checks:{},writes:[],errors:[]};
const previousFile=new URL('local-ui.json',out);const previous=existsSync(previousFile)?JSON.parse(readFileSync(previousFile,'utf8')):null;
if(previous?.result==='FAIL'&&previous.postId){report.postId=previous.postId;report.resumedExistingSyntheticArticle=true;}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{assert.equal(new URL(r.url()).origin,origin);if(r.url().includes('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method())){report.writes.push({method:r.method(),path:new URL(r.url()).pathname});writeFileSync(new URL('ui-progress.json',out),JSON.stringify(report,null,2));}});
async function progress(stage){report.stage=stage;writeFileSync(new URL('ui-progress.json',out),JSON.stringify(report,null,2));console.log(stage);}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-level overflow');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
async function uiResponse(action,path,method){const pending=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()===method).then(r=>({r}),error=>({error}));await action();const result=await pending;if(result.error)throw result.error;const r=result.r;assert.equal(r.status(),200,await r.text());return (await r.json()).data;}
async function feed(){await page.goto(origin+'/recommendations');await page.locator('.rec-issue-directory').waitFor();return page.locator('article.rec-pin').count();}
function fixtureRow(){return page.locator('tr[data-row-key="'+report.productId+'"],article[data-product-id="'+report.productId+'"]');}
async function selectFixture(){await page.getByRole('button',{name:t('trash.no_images'),exact:true}).click();await page.getByRole('textbox',{name:t('trash.search'),exact:true}).fill(report.productId);const row=fixtureRow();await row.waitFor();await row.getByRole('checkbox').check();await page.getByRole('checkbox',{name:t('trash.review'),exact:true}).check();}
async function remove(){await uiResponse(()=>page.getByRole('button',{name:/Logically delete selected products \(1\)/}).click(),'/api/admin/products/trash/delete','POST');await fixtureRow().waitFor({state:'hidden'});}
try{
 await progress('Login to existing local synthetic administrator');await page.goto(origin+'/admin/recommendations');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/recommendations"]').first().waitFor();
 report.baselineCards=await feed();
 await progress('Open and verify the unique local synthetic fixture');await page.goto(origin+'/admin/recommendations');
 let detail;
 if(report.postId){detail=await uiResponse(()=>page.goto(origin+'/admin/recommendations?post='+report.postId),'/api/merchant/recommendations/'+report.postId,'GET');assert.equal(detail.post.title,'[Synthetic] Logical deletion UI 20261027');}
 else {detail=await uiResponse(()=>page.getByRole('button',{name:new RegExp(t('rec.new'))}).click(),'/api/merchant/recommendations','POST');report.postId=detail.post.id;}
 if(!detail.items.length){
  await page.locator('#rec-title').fill('[Synthetic] Logical deletion UI 20261027');await page.locator('#rec-body').fill('Local recoverable-deletion acceptance fixture only. No actual selling price or inventory.');
  await uiResponse(()=>page.getByRole('button',{name:new RegExp(t('rec.save'))}).click(),'/api/merchant/recommendations/'+report.postId,'PUT');
  const fileName='LIFECYCLE-UI-20261027.png';await page.locator('input[type=file][accept="image/png,image/jpeg"]').first().setInputFiles({name:fileName,mimeType:'image/png',buffer:readFileSync(new URL('../docs/fixtures/postgres18-receipt.png',import.meta.url))});
  await page.locator('#rec-batch').fill(JSON.stringify([{fileName,name:'[Synthetic] Lifecycle UI product',itemNumber:'LIFECYCLE-UI-20261027',referencePrice:123,currency:'JPY',offerNotes:'Synthetic source reference; not a selling price.'}]));await page.locator('.rec-uploads').getByRole('button',{name:t('rec.batch_preview'),exact:true}).click();
  const uploaded=await uiResponse(()=>page.getByRole('button',{name:new RegExp(t('rec.register_all'))}).click(),'/api/merchant/recommendations/'+report.postId+'/images','POST');detail=uploaded.detail??uploaded;
 }
 assert.equal(detail.items.length,1);assert.equal(detail.items[0].itemNumber,'LIFECYCLE-UI-20261027');report.productId=detail.items[0].productId;report.itemId=detail.items[0].id;assert(report.productId);await progress('Existing synthetic registration verified; no duplicate import');
 await uiResponse(()=>page.getByRole('button',{name:new RegExp('^.*'+t('rec.publish')+'$')}).click(),'/api/merchant/recommendations/'+report.postId+'/publish','POST');
 assert.equal(await feed(),report.baselineCards+1);report.checks.normalUiCreationAndPublishedOccurrence='PASS';
 await progress('Review and logically delete exact synthetic product');await page.goto(origin+'/admin/deleted-products');await selectFixture();await shot('desktop-reviewed');await remove();await page.reload();await page.getByRole('button',{name:t('trash.deleted'),exact:true}).click();await page.getByRole('textbox',{name:t('trash.search'),exact:true}).fill(report.productId);
 const deletedRow=fixtureRow();await deletedRow.waitFor();assert((await deletedRow.innerText()).includes(String(report.itemId)));await shot('desktop-deleted-reopened');report.checks.reviewDeleteReopenLinkedItemVisibleOnlyInAdminTrash='PASS';
 assert.equal(await feed(),report.baselineCards);await page.goto(origin+'/recommendations?topic='+report.postId+'&item='+report.itemId);await page.locator('.rec-issue-directory').waitFor();assert.equal(await page.locator('article.rec-pin').count(),0);assert.equal(await page.locator('.rec-product-detail:visible').count(),0);assert.equal(await page.locator('.rec-category-filters button').count(),1);report.checks.themeRetainedEmptyCountsAndDirectItemHidden='PASS';
 await progress('Restore from mobile recycle bin and verify original association');await page.setViewportSize({width:390,height:844});await page.goto(origin+'/admin/deleted-products');await page.getByRole('textbox',{name:t('trash.search'),exact:true}).fill(report.productId);await fixtureRow().waitFor();await shot('mobile-deleted');await uiResponse(()=>page.getByRole('button',{name:t('trash.restore'),exact:true}).click(),'/api/admin/products/trash/restore','POST');await fixtureRow().waitFor({state:'hidden'});
 assert.equal(await feed(),report.baselineCards+1);await page.goto(origin+'/recommendations?topic='+report.postId);await page.locator('.rec-issue-directory').waitFor();assert.equal(await page.locator('article.rec-pin').count(),1);await shot('mobile-restored-recommendation');report.checks.mobileRestoreExactOriginalRecommendationAndCounts='PASS';
 await progress('Return synthetic fixture to private inactive state through normal UI');await page.goto(origin+'/admin/recommendations?post='+report.postId);await uiResponse(()=>page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).click(),'/api/merchant/recommendations/'+report.postId+'/withdraw','POST');await page.goto(origin+'/admin/deleted-products');await selectFixture();await remove();assert.equal(await feed(),report.baselineCards);report.checks.fixtureUnpublishedAndLogicallyDeletedNoPublicPollution='PASS';
 assert.equal(report.errors.length,0);report.result='PASS';
}catch(error){report.result='FAIL';report.error=String(error);report.visibleFailureText=(await page.locator('body').innerText()).slice(0,4000);await page.screenshot({path:fileURLToPath(new URL('failure.png',out))});throw error;}
finally{writeFileSync(new URL('local-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
