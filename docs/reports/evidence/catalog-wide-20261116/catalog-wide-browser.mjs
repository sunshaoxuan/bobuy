import {createRequire} from 'node:module';
const {chromium}=createRequire(new URL('../../../../frontend/package.json',import.meta.url))('@playwright/test');
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const run=promisify(execFile),out='../docs/reports/evidence/catalog-wide-20261116',cache=new Map(),report=[];
let active=0;const waiting=[];
async function limited(remote){if(active>=4)await new Promise(r=>waiting.push(r));active++;try{return (await run('curl',['-L','-sS','--retry','2','--retry-all-errors','--max-time','45',remote],{encoding:'buffer',maxBuffer:15*1024*1024})).stdout;}finally{active--;waiting.shift()?.();}}
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
for(const [width,height,locale] of [[2580,1440,'zh-CN'],[1280,800,'zh-CN'],[390,844,'en-US'],[320,800,'ja-JP']]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 await context.addInitScript(({locale})=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_test_role','AGENT');localStorage.setItem('bobbuy_test_user','1001');},{locale});
 const page=await context.newPage(),errors=[],bad=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());if(req.method()!=='GET')throw Error('Unexpected write '+url);
  requests.push(url.pathname+url.search);
  const remote='https://bobuy.cc'+url.pathname+url.search;
  if(!cache.has(remote))cache.set(remote,limited(remote));
  try{const body=await cache.get(remote);await route.fulfill({status:200,body,contentType:url.pathname.includes('images/')?'image/jpeg':'application/json'});}catch(e){await route.abort();errors.push(String(e));}
 });
 await page.goto('http://localhost:4173/products');
 await page.locator('.catalog-master-card').first().waitFor({timeout:90000});
 await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});
 await page.locator('.catalog-master-grid img').evaluateAll(es=>es.forEach(e=>e.loading='eager'));
 await page.waitForTimeout(2000);
 await page.locator('.catalog-master-grid img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.complete?null:new Promise(r=>{i.onload=r;i.onerror=r;setTimeout(r,90000)}))));
 const metrics=await page.evaluate(()=>{const grid=document.querySelector('.catalog-master-grid'),main=document.querySelector('.store-main');const r=e=>{const s=getComputedStyle(e),b=e.getBoundingClientRect();return Object.fromEntries(['width','height','minWidth','minHeight','borderRadius','borderColor','borderWidth','backgroundColor','boxShadow'].map(k=>[k,s[k]]).concat([['x',b.x],['right',b.right]]));};return {overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(grid).gridTemplateColumns,main:r(main),card:r(grid.firstElementChild),sort:r(document.querySelector('.product-sort')),toggle:r(document.querySelector('.marked-first-toggle')),loader:document.querySelector('.feed-loader button')?r(document.querySelector('.feed-loader button')):null,count:grid.children.length,images:[...grid.querySelectorAll('img')].map(i=>({loaded:i.complete&&i.naturalWidth>0}))};});
 if(metrics.overflow)throw Error('Overflow '+width);
 await page.screenshot({path:`${out}/${width}-overall.png`,fullPage:true});
 await page.locator('.catalog-master-heading').screenshot({path:`${out}/${width}-controls.png`});
 await page.locator('.catalog-master-card').first().screenshot({path:`${out}/${width}-card.png`});
 const initialIds=await page.locator('.catalog-master-card').evaluateAll(es=>es.map(e=>e.textContent));
 const loader=page.locator('.feed-loader button');
 if(width===2580){
  // Click from the top, avoiding a separate observer entry while checking the manual fallback.
  await loader.evaluate(e=>e.click());await page.waitForFunction(n=>document.querySelectorAll('.catalog-master-card').length>n,metrics.count,{timeout:90000});
  const after=await page.locator('.catalog-master-card').count();if(after!==metrics.count+48)throw Error('Wrong wide batch '+after);metrics.afterNext=after;
  await page.setViewportSize({width:1280,height:800});await loader.evaluate(e=>e.click());await page.waitForFunction(n=>document.querySelectorAll('.catalog-master-card').length>n,after,{timeout:90000});metrics.afterResize=await page.locator('.catalog-master-card').count();if(metrics.afterResize!==after+48)throw Error('Resize changed offsets');await page.setViewportSize({width,height});
 }
 await page.locator('.product-sort').selectOption('rating-desc');await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});
 if(!page.url().includes('sort=rating-desc'))throw Error('sort URL');
 const category=page.locator('.rec-category-filters button').nth(1);await category.click();await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});
 if(!page.url().includes('category='))throw Error('category URL');
 await page.locator('.marked-first-toggle').click();await page.waitForFunction(()=>!document.querySelector('.public-product-catalog[aria-busy=true]'),{},{timeout:90000});
 if(await page.locator('.marked-first-toggle').getAttribute('aria-pressed')!=='false')throw Error('priority');
 metrics.finalCount=await page.locator('.catalog-master-card').count();
 report.push({width,height,locale,metrics,errors,bad,requests,initialCount:initialIds.length});await fs.writeFile(`${out}/browser.json`,JSON.stringify(report,null,2));await context.close();
}
await browser.close();
const files=await fs.readdir('dist/assets');await fs.writeFile(`${out}/assets.json`,JSON.stringify(await Promise.all(files.filter(f=>/\.(css|js)$/.test(f)).map(async f=>({file:f,sha256:crypto.createHash('sha256').update(await fs.readFile('dist/assets/'+f)).digest('hex')}))),null,2));
console.log(JSON.stringify(report.map(({width,metrics,errors,bad})=>({width,metrics,errors,bad})),null,2));
