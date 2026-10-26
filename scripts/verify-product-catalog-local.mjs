import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';assert.equal(new URL(origin).hostname,'127.0.0.1');
const out=new URL('../docs/reports/evidence/product-catalog/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
const page=await context.newPage(),report={scope:'Existing shared LOCAL synthetic NAV-TEST-000; all saves through visible UI, no production content or API-write setup',checks:{},errors:[],writes:[]};
const projectionOnly=process.argv.includes('--projection-only');if(projectionOnly){const previous=JSON.parse(readFileSync(new URL('local-ui.json',out),'utf8'));assert.equal(previous.checks.reopenFourLanguagesStructuredFieldsAndThreeImagesDesktopMobile,'PASS');Object.assign(report,{checks:previous.checks,writes:previous.writes,productId:previous.productId});}
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',request=>{if(!['GET','HEAD','OPTIONS'].includes(request.method()))report.writes.push({method:request.method(),path:new URL(request.url()).pathname,host:new URL(request.url()).hostname});});
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page-level horizontal overflow');await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
const acknowledge='I reviewed the data, exact model/specification and official images, and resolved the listed conflicts';
try{
 await page.goto(origin+'/admin/stock-master');
 await page.locator('#username, .product-catalog-panel').first().waitFor();
 if(await page.locator('#username').count()){await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/recommendations"]').first().waitFor();}
 if(!projectionOnly){await page.goto(origin+'/admin/stock-master');await page.getByRole('button',{name:'Review and complete product masters',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Generate suggestions from linked recommendations',exact:true}).click();
 const input=dialog.getByRole('textbox',{name:'Product-master batch JSON',exact:true});await input.waitFor();
 await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Product-master batch JSON"]')?.value.includes('NAV-TEST-000'));
 const candidates=JSON.parse(await input.inputValue()),row=candidates.find(value=>value.itemNumber==='NAV-TEST-000');assert(row,'Existing synthetic profile proposal');
 assert.equal(row.gallery.length,3);assert(row.gallery.every(p=>p.sourceUrl?.startsWith('https://')),'Exact existing-gallery provenance supplemented');
 row.name={'ja-JP':'Synthetic 新鮮商品','zh-CN':'合成中文主档','zh-TW':'合成繁體主檔','en-US':'Synthetic canonical product'};
 row.specification={'ja-JP':'100g（合成）','zh-CN':'100g（合成）','zh-TW':'100g（合成）','en-US':'100g (synthetic)'};
 row.model='MODEL-1';row.packaging='Synthetic fixture';row.translationsReviewed=true;
 await input.fill('invalid JSON');await dialog.getByRole('button',{name:'Validate and preview',exact:true}).click();
 assert(await dialog.getByRole('button',{name:/Confirm and save masters/}).isDisabled());
 await input.fill(JSON.stringify([row],null,2));await dialog.getByRole('button',{name:'Validate and preview',exact:true}).click();
 await dialog.getByRole('checkbox',{name:acknowledge,exact:true}).check();
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/merchant/product-catalog'&&r.request().method()==='PUT');
 await dialog.getByRole('button',{name:/Confirm and save masters/}).click();const response=await saved;assert.equal(response.status(),200,await response.text());
 const result=(await response.json()).data;assert.equal(result.length,1);assert(result[0].canonical);assert(result[0].value.version>row.version);
 report.productId=row.productId;report.checks.visibleBulkInvalidCorrectionPreviewReviewedSave='PASS';
 await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();
 const stockRow=page.locator('tr').filter({has:page.locator('input[value="NAV-TEST-000"]')});await stockRow.getByRole('button',{name:'Product master',exact:true}).click();
 const editor=page.getByRole('dialog');await editor.getByText('Recommendations read product information from this master.',{exact:true}).waitFor();
 assert.equal(await editor.getByRole('textbox',{name:'Name (translation only; no Japanese suffix) ja-JP',exact:true}).inputValue(),row.name['ja-JP']);
 for(const [label,locale] of [['简体中文','zh-CN'],['繁體中文','zh-TW'],['English','en-US']]){await editor.getByRole('tab',{name:label,exact:true}).click();assert.equal(await editor.getByRole('textbox',{name:'Name (translation only; no Japanese suffix) '+locale,exact:true}).inputValue(),row.name[locale]);}
 assert.equal(await editor.locator('.product-catalog-images img').count(),3);assert.equal(await editor.getByRole('textbox',{name:'Model',exact:true}).inputValue(),'MODEL-1');
 await shot('master-desktop');await page.setViewportSize({width:390,height:844});await shot('master-mobile');
 report.checks.reopenFourLanguagesStructuredFieldsAndThreeImagesDesktopMobile='PASS';
 await editor.getByRole('button',{name:'Close',exact:true}).click();}
 await page.goto(origin+'/admin/recommendations?post=12');await page.getByRole('button',{name:/Customer preview/}).click();await page.locator('.rec-pin').first().waitFor();await page.setViewportSize({width:390,height:844});
 const card=page.locator('.rec-pin').filter({hasText:'NAV-TEST-000'});assert.equal(await card.count(),1);assert((await card.innerText()).includes('Synthetic canonical product'));assert((await card.innerText()).includes('Synthetic 新鮮商品'));
 await card.scrollIntoViewIfNeeded();await shot('projected-mobile');await page.setViewportSize({width:1440,height:1000});await card.scrollIntoViewIfNeeded();await shot('projected-desktop');
 report.checks.linkedRecommendationProjectsReviewedMaster='PASS';assert.deepEqual(report.errors,[]);assert(report.writes.every(w=>w.host==='127.0.0.1'));report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:fileURLToPath(new URL('failure.png',out)),fullPage:true}).catch(()=>{});throw error;}
finally{writeFileSync(new URL('local-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify(report));}
