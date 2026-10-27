import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';assert.equal(new URL(origin).hostname,'127.0.0.1');
const out=new URL('../docs/reports/evidence/mail-settings-local/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
const page=await context.newPage();
const report={scope:'Existing shared LOCAL fixture; settings saved through visible UI only; no credential/key or message',checks:{},errors:[],writes:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))report.writes.push({method:r.method(),path:new URL(r.url()).pathname});});
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true,animations:'disabled'});}
try {
 await page.goto(origin+'/admin/settings');await page.locator('#username, .mail-settings-page').first().waitFor();
 if(await page.locator('#username').count()) {await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/settings"]').first().click();}
 await page.getByRole('heading',{name:'System settings · Mail',exact:true}).waitFor();
 const warning='External encryption key is not configured. Password storage and delivery activation are unavailable.';
 await page.getByText(warning,{exact:true}).waitFor();
 assert(await page.getByLabel('SMTP password',{exact:true}).isDisabled());assert(await page.getByRole('switch').isDisabled());
 assert(await page.getByRole('button',{name:'Send test message',exact:true}).isDisabled());
 assert.equal(await page.getByLabel('SMTP username',{exact:true}).inputValue(),'postmaster@bobuy.cc');
 assert.equal(await page.getByLabel('SMTP password',{exact:true}).inputValue(),'');
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/admin/settings/mail' && r.request().method()==='PUT');
 await page.getByRole('button',{name:'Save mail settings',exact:true}).click();const response=await saved;assert.equal(response.status(),200,await response.text());
 const data=(await response.json()).data;assert.equal(data.enabled,false);assert.equal(data.passwordStored,false);assert.equal(data.keyReady,false);assert.equal(data.password,undefined);assert.equal(data.encryptedPassword,undefined);
 report.checks.visibleSaveDisabledNonSecretConfiguration='PASS';
 await page.reload();await page.getByText(warning,{exact:true}).waitFor();assert.equal(await page.getByLabel('Reply-To address',{exact:true}).inputValue(),'postmaster@bobuy.cc');
 assert.equal(await page.getByLabel('SMTP password',{exact:true}).inputValue(),'');assert(await page.getByRole('button',{name:'Send test message',exact:true}).isDisabled());
 await shot('desktop');report.checks.reopenPasswordAbsentDeliveryAndTestsDisabled='PASS';
 await page.setViewportSize({width:390,height:844});await shot('mobile');report.checks.mobileNoHorizontalOverflow='PASS';
 assert(!report.writes.some(w=>w.path.endsWith('/test')));assert.equal(report.errors.length,0);
 writeFileSync(new URL('browser.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {await browser.close();}
