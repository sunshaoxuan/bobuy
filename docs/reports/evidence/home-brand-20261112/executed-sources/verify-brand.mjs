import {chromium} from './frontend/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const base=process.argv[2]||'http://127.0.0.1:5178';
const out=path.resolve('docs/reports/evidence/home-brand-20261112',base.startsWith('https')?'production':'local');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Users/X02851/AppData/Local/ms-playwright/chromium-1194/chrome-win/chrome.exe',headless:true});const results=[];
for(const width of [1440,390,360]){
 const page=await browser.newPage({viewport:{width,height:950},deviceScaleFactor:1});const errors=[],network=[],cancellations=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)network.push({url:r.url(),status:r.status()});});
 page.on('requestfailed',r=>{const value={url:r.url(),failure:r.failure()?.errorText};(value.failure==='net::ERR_ABORTED'?cancellations:network).push(value);});
 await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.browse-search').waitFor();await page.locator('.rec-pin').first().waitFor();await page.waitForLoadState('networkidle');
 const assets=[];
 if(base.startsWith('https')){
  const urls=await page.locator('script[type="module"][src],link[rel="stylesheet"][href]').evaluateAll(nodes=>nodes.map(n=>n.src||n.href));
  for(const url of urls){const u=new URL(url);if(u.origin!==new URL(base).origin||!u.pathname.startsWith('/assets/'))continue;const response=await page.request.get(url);if(!response.ok())throw Error('Asset fetch failed');const bytes=await response.body();const digest=createHash('sha256').update(bytes).digest('hex');const expected=createHash('sha256').update(fs.readFileSync(path.resolve('frontend/dist'+u.pathname))).digest('hex');if(digest!==expected)throw Error('Loaded assets differ from candidate');assets.push({path:u.pathname,sha256:digest});}
  if(assets.length<2)throw Error('Missing loaded asset bindings');
 }
 if(await page.locator('.home-brand-intro').count())throw Error('Intro still rendered');
 const brand=page.locator(width>767?'.browse-sidebar .browse-brand':'.browse-mobile-brand');
 await brand.screenshot({path:path.join(out,`brand-${width}.png`)});await page.screenshot({path:path.join(out,`viewport-${width}.png`)});await page.screenshot({path:path.join(out,`home-${width}.png`),fullPage:true});
 const geometry=await brand.evaluate(el=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};return {hotspot:box(el),domain:box(el.querySelector('.browse-brand-domain')),name:box(el.querySelector('strong')),overflow:document.documentElement.scrollWidth>innerWidth,font:getComputedStyle(el.querySelector('.browse-brand-domain')).font};});
 if(geometry.overflow)throw Error('Horizontal overflow');
 const search=page.locator('.browse-search input');const count=await page.locator('.rec-pin').count();if(count===0)throw Error('Missing catalog for search verification');await search.fill('zzNoSuchProduct73929');await page.waitForFunction(()=>document.querySelectorAll('.rec-pin').length===0);await page.waitForLoadState('networkidle');await page.screenshot({path:path.join(out,`search-${width}.png`)});await search.fill('');await page.locator('.rec-pin').first().waitFor();await page.waitForLoadState('networkidle');
 if(width<768){await page.locator('.browse-menu-toggle').click();await page.locator('.browse-drawer .browse-brand').waitFor();await page.waitForTimeout(400);await page.screenshot({path:path.join(out,`menu-${width}.png`)});await page.locator('.browse-drawer .browse-brand').screenshot({path:path.join(out,`menu-brand-${width}.png`)});await page.locator('.browse-drawer .browse-brand').click();await page.waitForTimeout(400);if(await page.locator('.browse-drawer').isVisible())throw Error('Menu did not close');}
 await page.goto(base+'/products',{waitUntil:'domcontentloaded'});await brand.click();await page.waitForTimeout(600);if(new URL(page.url()).pathname!=='/')throw Error('Brand home link failed');
 results.push({width,geometry,errors,network,cancellations,assets,introRemoved:true,searchInput:true,brandHome:true});await page.close();
}
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({base,results},null,2));await browser.close();console.log(JSON.stringify(results,null,2));
