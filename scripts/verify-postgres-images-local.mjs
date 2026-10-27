import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';assert.equal(new URL(origin).hostname,'127.0.0.1');
const out=new URL('../docs/reports/evidence/postgres18-storage/',import.meta.url);mkdirSync(out,{recursive:true});
const marker='SYNTHETIC-PG18-IMAGE-20261027';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
const page=await context.newPage();const report={scope:'Existing LOCAL synthetic fixture only; normal visible expense-image UI; no production data or restore',marker,checks:{},errors:[],writes:[]};
const resume=process.argv.includes('--resume');if(resume)Object.assign(report,JSON.parse(readFileSync(new URL('browser-progress.json',out),'utf8')));
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))report.writes.push({method:r.method(),path:new URL(r.url()).pathname});});
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
try {
 await page.goto(origin+'/admin/procurement');await page.locator('#username, [data-testid="procurement-trip-select"]').first().waitFor();
 if(await page.locator('#username').count()){await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/procurement"]').first().click();}
 await page.getByTestId('procurement-trip-select').waitFor();
 await page.getByTestId('procurement-trip-select').click();
 const option=page.locator('.ant-select-item-option').filter({hasText:'2000'});await option.first().click();
 if(!resume){await page.getByPlaceholder('e.g. Parking fee',{exact:true}).fill(marker);
 await page.getByPlaceholder('Cost',{exact:true}).fill('0.01');
 await page.getByLabel('Upload receipt image',{exact:true}).setInputFiles(fileURLToPath(new URL('../docs/fixtures/postgres18-receipt.png',import.meta.url)));
 await page.getByText('Receipt image selected',{exact:true}).waitFor();
 const pending=page.waitForResponse(r=>/\/api\/procurement\/\d+\/expenses$/.test(new URL(r.url()).pathname)&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Add Expense',exact:true}).click();const response=await pending;assert.equal(response.status(),200,await response.text());
 const item=(await response.json()).data;report.expenseId=item.id;report.tripId=item.tripId;report.imageUrl=item.receiptThumbnailUrl;
 assert.match(item.receiptThumbnailUrl,/^\/api\/merchant\/media\/[a-z0-9-]+$/i);report.checks.visibleUploadToPostgres='PASS';
 writeFileSync(new URL('browser-progress.json',out),JSON.stringify(report,null,2)+'\n');
 }
 await page.reload();const row=page.locator('tr').filter({hasText:marker});await row.waitFor();
 await row.getByRole('button',{name:'Preview Receipt',exact:true}).click();
 const dialog=page.getByRole('dialog');const image=dialog.getByRole('img',{name:'Preview Receipt',exact:true});
 await image.waitFor();await page.waitForFunction(()=>{const i=document.querySelector('.ant-modal img');return i?.complete&&i.naturalWidth>0;});
 assert((await image.getAttribute('src')).startsWith('blob:'));
 await dialog.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const d=document.querySelector('.ant-modal');return d&&d.getAnimations({subtree:true}).every(a=>a.playState!=='running')&&getComputedStyle(d).opacity==='1';});
 await shot('private-receipt-desktop');report.checks.reopenAuthenticatedPrivatePreview='PASS';
 await page.setViewportSize({width:390,height:844});await shot('private-receipt-mobile');report.checks.privatePreviewMobile='PASS';
 const anonymous=await browser.newContext();const anonymousPage=await anonymous.newPage();const denial=anonymousPage.waitForResponse(r=>r.url()===origin+report.imageUrl);
 await anonymousPage.goto(origin+report.imageUrl).catch(e=>assert.match(e.message,/ERR_HTTP_RESPONSE_CODE_FAILURE/));
 const denied=await denial;assert([401,403].includes(denied.status()));await anonymous.close();report.checks.anonymousPrivateImageRejected='PASS';
 assert.equal(report.errors.length,0);writeFileSync(new URL('browser.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} catch(e){await page.screenshot({path:fileURLToPath(new URL('browser-failure.png',out)),fullPage:true});console.log((await page.locator('body').innerText()).slice(0,5000));throw e;}
finally {await browser.close();}
