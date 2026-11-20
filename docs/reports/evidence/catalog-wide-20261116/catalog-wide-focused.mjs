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
for(const [width,height,locale] of [[320,800,'zh-TW'],[2580,1440,'zh-CN']]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
 await context.addInitScript(({locale})=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_test_role','AGENT');localStorage.setItem('bobbuy_test_user','1001');},{locale});
 const page=await context.newPage(),errors=[],bad=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());if(req.method()!=='GET'){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'success',data:{count:0}})});return;}
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
 const card=page.locator('.catalog-master-card').first();
 await card.evaluate(e=>{e.scrollIntoView({block:'start'});window.scrollBy(0,-40);});
 const action=card.locator('.marker-product-trigger');await action.focus();
 const hit=await action.evaluate(e=>{const b=e.getBoundingClientRect();return {width:b.width,height:b.height,reachable:e.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)),focused:document.activeElement===e};});
 if(!hit.reachable||hit.height<44||!hit.focused)throw Error('Management action inaccessible');
 await card.screenshot({path:`${out}/${width}-card-action-focus.png`});
 const before=requests.filter(r=>r.includes('/product-browse?')).length;
 await card.locator('.product-name').click();
 await page.locator('.catalog-master-detail h1').waitFor({timeout:90000});
 await page.waitForTimeout(500);
 const after=requests.filter(r=>r.includes('/product-browse?')).length;
 if(before!==after)throw Error('Browse changed while detail open');
 await page.locator('.catalog-master-detail .ant-drawer-close').click();
 report.push({width,locale,hit,detailPaused:before===after,errors,bad});
 await fs.writeFile(`${out}/focused-interactions.json`,JSON.stringify(report,null,2));await context.close();
}
await browser.close();console.log(JSON.stringify(report));
