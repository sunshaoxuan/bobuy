# Production verification source

Archived source, not application code. Executed once from `frontend` with system Chromium against real `https://bobuy.cc/products`; public GET requests pass through a four-request curl queue, and writes are intercepted. Save the fenced source back to `docs/reports/evidence/catalog-wide-20261116/production-browser.mjs` and run from `frontend` if a justified future check needs it.

```javascript
import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../../../frontend/package.json',import.meta.url))('@playwright/test');
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const run=promisify(execFile),out='../docs/reports/evidence/catalog-wide-20261116/production',cache=new Map(),report=[],assets=new Map();
await fs.mkdir(out,{recursive:true});
let active=0;const waiting=[];
async function read(url){if(active>=4)await new Promise(r=>waiting.push(r));active++;try{const {stdout}=await run('curl',['-fsS','--retry','2','--retry-all-errors','--max-time','45','--write-out','\n%{http_code} %{content_type}',url],{encoding:'buffer',maxBuffer:15*1024*1024});const split=stdout.lastIndexOf(10),meta=stdout.subarray(split+1).toString(),body=stdout.subarray(0,split);return {body,status:Number(meta.slice(0,3)),contentType:meta.slice(4)};}finally{active--;waiting.shift()?.();}}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for(const [width,height,locale] of [[2580,1440,'zh-CN'],[1280,800,'zh-CN'],[390,844,'en-US'],[320,800,'ja-JP']]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 await context.addInitScript(locale=>localStorage.setItem('bobbuy_locale',locale),locale);
 const page=await context.newPage(),errors=[],bad=[],requests=[],suppressedWrites=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
 await page.route('https://bobuy.cc/**',async route=>{const req=route.request(),url=req.url();if(req.method()!=='GET'){suppressedWrites.push([req.method(),url]);await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',data:{count:0}})});return;}requests.push(url);if(!cache.has(url))cache.set(url,read(url));try{const result=await cache.get(url);if(/\.(css|js)(\?|$)/.test(url))assets.set(url,{url,sha256:crypto.createHash('sha256').update(result.body).digest('hex')});await route.fulfill(result);}catch(error){errors.push(String(error));await route.abort();}});
 await page.goto('https://bobuy.cc/products',{waitUntil:'domcontentloaded',timeout:90000});await page.locator('.catalog-master-card').first().waitFor({timeout:90000});
 await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});
 await page.locator('.catalog-master-grid img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
 await page.locator('.catalog-master-grid img').evaluateAll(es=>Promise.all(es.map(e=>e.complete?null:new Promise(r=>{e.onload=r;e.onerror=r;setTimeout(r,90000)}))));
 const metrics=await page.evaluate(()=>{const grid=document.querySelector('.catalog-master-grid');const sample=e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return {x:b.x,right:b.right,...Object.fromEntries(['width','height','minWidth','minHeight','borderRadius','borderColor','borderWidth','backgroundColor','boxShadow'].map(k=>[k,s[k]]))};};return {overflow:document.documentElement.scrollWidth>innerWidth,count:grid.children.length,columns:getComputedStyle(grid).gridTemplateColumns,main:sample(document.querySelector('.store-main')),card:sample(grid.firstElementChild),sort:sample(document.querySelector('.product-sort')),toggle:sample(document.querySelector('.marked-first-toggle')),images:[...grid.querySelectorAll('img')].filter(e=>e.complete&&e.naturalWidth>0).length};});
 if(metrics.overflow||metrics.count!==(width>=1920?48:24)||metrics.images!==metrics.count)throw Error('Unexpected initial layout '+JSON.stringify(metrics));
 await page.screenshot({path:`${out}/${width}-overall.png`,fullPage:true});await page.locator('.catalog-master-heading').screenshot({path:`${out}/${width}-controls.png`});await page.locator('.catalog-master-card').first().screenshot({path:`${out}/${width}-card.png`});
 if(width===2580){const firstBrowse=requests.find(u=>u.includes('/product-browse?'));const expectedTotal=JSON.parse((await cache.get(firstBrowse)).body.toString()).data.matchedTotal;const batches=[metrics.count];while(await page.locator('.feed-loader button').count()){const before=await page.locator('.catalog-master-card').count();await page.locator('.feed-loader button').evaluate(e=>e.click());await page.waitForFunction(before=>document.querySelectorAll('.catalog-master-card').length>before,before,{timeout:90000});batches.push(await page.locator('.catalog-master-card').count());}const ids=await page.locator('.catalog-master-card').evaluateAll(es=>es.map(e=>e.getAttribute('data-product-id')));if(ids.length!==expectedTotal||new Set(ids).size!==expectedTotal)throw Error('Missing/duplicate production identities');metrics.batches=batches;metrics.uniqueIds=ids.length;metrics.expectedTotal=expectedTotal;await fs.writeFile(`${out}/ordered-product-ids.json`,JSON.stringify(ids));}
 await page.locator('.product-sort').selectOption('rating-desc');await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});if(!page.url().includes('sort=rating-desc'))throw Error('sort URL');
 await page.locator('.rec-category-filters button').nth(1).click();await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});if(!page.url().includes('category='))throw Error('category URL');
 await page.locator('.marked-first-toggle').click();await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});if(await page.locator('.marked-first-toggle').getAttribute('aria-pressed')!=='false')throw Error('priority');
 if(errors.length||bad.length)throw Error('Production browser errors '+JSON.stringify({errors,bad}));
 report.push({width,height,locale,metrics,errors,bad,requests,suppressedWrites,observedAt:new Date().toISOString()});await fs.writeFile(`${out}/browser.json`,JSON.stringify(report,null,2));await fs.writeFile(`${out}/loaded-assets.json`,JSON.stringify([...assets.values()],null,2));await context.close();console.log('PASS '+width);
}
await browser.close();

```
