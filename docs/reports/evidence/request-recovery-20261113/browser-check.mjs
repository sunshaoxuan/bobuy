import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(path.resolve('frontend/node_modules/@playwright/test'));
const out=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const directory=decodeURIComponent(out),base=process.argv[2]??'http://127.0.0.1:4193',production=base.startsWith('https:');
const report={result:'RUNNING',base,data:'Production public reads; fault responses injected in this browser only; no business writes',checks:[],console:[],pageErrors:[],requests:[],writes:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
let context;
try{
 context=await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
 const page=await context.newPage();
 page.on('pageerror',e=>report.pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.console.push(m.text());});
 page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))report.requests.push({path:new URL(r.url()).pathname+new URL(r.url()).search,status:r.status(),method:r.request().method()});});
 let tripAttempts=0,activeAttempts=0,failActive=true;
 await context.route('**/api/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.method()!=='GET'){report.writes.push({method:request.method(),path:url.pathname});await route.abort();return;}
  if(url.pathname==='/api/storefront/trips'&&!url.search){tripAttempts++;if(tripAttempts<=2){await route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({message:'temporary first-read fixture'})});return;}}
  if(url.pathname==='/api/storefront/trips'&&url.search){activeAttempts++;if(failActive){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'temporary active-trip fixture'})});return;}}
  await route.continue();
 });
 await page.goto(base+'/products',{waitUntil:'domcontentloaded'});
 await page.locator('.compact-product-card').first().waitFor({timeout:45000});
 await page.getByText('temporary active-trip fixture',{exact:true}).waitFor({timeout:15000});
 assert.equal(tripAttempts,3);assert.equal(activeAttempts,3);
 report.checks.push({name:'Initial 502 read recovers on third attempt; persistent 503 stops at three',result:'PASS',tripAttempts,activeAttempts});
 await page.screenshot({path:path.join(directory,(production?'production-':'')+'error-desktop.png')});
 const alert=page.locator('.ant-alert-error').filter({hasText:'temporary active-trip fixture'}).first();await alert.screenshot({path:path.join(directory,(production?'production-':'')+'error-alert.png')});
 const cart=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes('cart'))));
 await context.setOffline(true);await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(650);assert.equal(activeAttempts,3);
 report.checks.push({name:'Offline focus and visibility events do not issue recovery reads',result:'PASS'});
 failActive=false;
 await context.setOffline(false);
 await page.waitForFunction(()=>!document.body.innerText.includes('temporary active-trip fixture'),{},{timeout:15000});
 assert.equal(activeAttempts,4);assert.equal(tripAttempts,3);
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>key.includes('cart')))),cart);
 report.checks.push({name:'Real browser offline to online transition restores only failed metadata; cart unchanged',result:'PASS'});
 const before=report.requests.length;
 await page.evaluate(()=>{for(let i=0;i<5;i++){window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));}});await page.waitForTimeout(500);
 assert.equal(activeAttempts,4);assert.equal(tripAttempts,3);
 report.checks.push({name:'Repeated foreground events preserve successful data without metadata request storms',result:'PASS',apiRequestsAtStart:before});
 await page.screenshot({path:path.join(directory,(production?'production-':'')+'recovered-desktop.png')});
 await page.locator('.browse-workspace').screenshot({path:path.join(directory,(production?'production-':'')+'recovered-content.png')});
 // A second real tab runs a fresh page with failure exhaustion, then focus recovery.
 const foreground=await context.newPage();let foregroundFailures=0,foregroundFault=true;
 foreground.on('pageerror',e=>report.pageErrors.push(e.message));
 await foreground.route('**/api/storefront/trips?includeCurrent=true',async route=>{foregroundFailures++;if(foregroundFault)await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'foreground recovery fixture'})});else await route.continue();});
 await foreground.goto(base+'/products',{waitUntil:'domcontentloaded'});await foreground.getByText('foreground recovery fixture',{exact:true}).waitFor();assert.equal(foregroundFailures,3);
 foregroundFault=false;await foreground.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'));});
 await foreground.waitForFunction(()=>!document.body.innerText.includes('foreground recovery fixture'));assert.equal(foregroundFailures,4);
 report.checks.push({name:'Foreground focus plus visibility burst restores exhausted failed read once',result:'PASS',eventType:'Browser event fixture'});
 await foreground.close();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(directory,(production?'production-':'')+'recovered-mobile.png')});
 report.checks.push({name:'390x844 recovered page has no horizontal overflow',result:'PASS'});
 assert.equal(report.writes.length,0);assert.equal(report.pageErrors.length,0);
 const unexpectedConsole=report.console.filter(line=>!line.includes('Failed to load resource: net::ERR_INTERNET_DISCONNECTED')&&!/Failed to load resource: the server responded with a status of (502|503)/.test(line));
 assert.deepEqual(unexpectedConsole,[]);
 report.checks.push({name:'No business writes, uncaught JavaScript errors or unexpected console errors',result:'PASS',expectedFaultConsoleCount:report.console.length});
 report.assets=await page.locator('script[src],link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(node=>node.src??node.href));
 report.result='PASS';
}catch(error){report.result='FAIL';report.failure=String(error.stack??error);throw error;}
finally{fs.writeFileSync(path.join(directory,production?'production-browser.json':'local-browser.json'),JSON.stringify(report,null,2)+'\n');await context?.close();await browser.close();console.log(JSON.stringify({result:report.result,checks:report.checks,failure:report.failure}));}
