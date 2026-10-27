import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080',out=new URL('../docs/reports/evidence/product-lifecycle/',import.meta.url);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
const page=await context.newPage();const report={scope:'Existing LOCAL customer fixture, ordinary visible login and direct navigation only; no product writes or credential reads',checks:{}};
try{
 await page.goto(origin+'/admin/deleted-products');await page.locator('#username').fill('customer');await page.locator('#password').fill('customer-pass');
 const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/auth/login'&&r.request().method()==='POST');await page.locator('button[type=submit]').click();const response=await pending;report.loginStatus=response.status();
 if(response.status()!==200){report.result='BLOCKED';report.visibleReason=await page.getByRole('alert').allTextContents();}
 else{await page.locator('#username').waitFor({state:'hidden'});report.afterLoginUrl=page.url();await page.goto(origin+'/admin/deleted-products');await page.waitForURL(origin+'/');assert.equal(await page.locator('a[href="/admin/deleted-products"]').count(),0);assert(!(await page.locator('body').innerText()).includes('LIFECYCLE-UI-20261027'));report.checks.customerCannotSeeDeletedProducts='PASS';report.result='PASS';}
 await page.screenshot({path:fileURLToPath(new URL('customer-access.png',out))});
}catch(error){report.result='FAIL';report.error=String(error);report.finalUrl=page.url();report.visibleText=(await page.locator('body').innerText()).slice(0,2200);}
finally{writeFileSync(new URL('customer-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));if(report.result!=='PASS')process.exitCode=1;
