import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('.',import.meta.url)),base='http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:1280,height:800}});await ctx.addInitScript(()=>{localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_disable_chat_websocket','true');});
const page=await ctx.newPage(),errors=[],network=[],quotes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/product-sales'))quotes.push(u.searchParams.get('productIds').split(','));});page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({path:u.pathname,status:r.status()});});
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="280"><rect width="240" height="280" fill="#e9e6df"/><rect x="60" y="45" width="120" height="160" rx="16" fill="#d6bf9f"/><text x="120" y="125" text-anchor="middle" font-size="20" fill="#453c31">SYNTHETIC</text></svg>';
await page.route('**/progressive-fixture-images/**',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:svg}));await page.route('**/api/storefront/recommendation-images/progressive-icon-*',r=>r.fulfill({status:200,contentType:'image/svg+xml',body:svg}));
try{
 const res=await ctx.request.get(base+'/api/storefront/product-browse/overview?merchantId=1000&locale=en-US');assert.equal(res.status(),200);const meta=(await res.json()).data;
 await page.goto(base+'/products?node=1000');await page.locator('.shopping-shelf .catalog-master-card').first().waitFor();
 const geometry=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.category-shortcuts a,.category-shortcuts>button,.shopping-shelf header button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,label:e.getAttribute('aria-label'),width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderWidth:s.borderWidth,borderColor:s.borderColor,background:s.backgroundColor,shadow:s.boxShadow};})}));assert(!geometry.overflow);for(const c of geometry.controls)assert(c.height>=44);
 await page.screenshot({path:out+'ready-en-1280.png'});await page.locator('.shopping-shelf header').first().screenshot({path:out+'header-en-1280.png'});
 for(const shelf of meta.shelves){const section=page.locator(`[data-shelf-category="${shelf.category}"]`);await section.scrollIntoViewIfNeeded();await section.locator('.catalog-master-card').first().waitFor();assert.equal(await section.locator('.catalog-master-card').count(),Math.min(8,shelf.total));}
 const ids=await page.locator('.catalog-master-card').evaluateAll(es=>es.map(e=>e.dataset.productId));assert.equal(new Set(ids).size,ids.length);assert(!ids.includes('progressive-private'));assert.equal(ids.length,meta.shelves.reduce((n,s)=>n+Math.min(8,s.total),0));
 await page.waitForFunction(()=>!document.querySelector('.shelf-progress'));assert(quotes.every(ids=>ids.length<=24&&new Set(ids).size===ids.length));assert.equal(new Set(quotes.flat()).size,quotes.flat().length);
 assert.deepEqual(errors,[]);assert.deepEqual(network.filter(r=>r.status>=400),[]);
 writeFileSync(out+'completion.json',JSON.stringify({result:'PASS',viewport:'1280x800',locale:'en-US',geometry,total:meta.matchedTotal,shelves:meta.shelves.length,previewCards:ids.length,uniqueCards:new Set(ids).size,quoteBatches:quotes.map(q=>q.length),errors,network,scope:'Desktop geometry receipt plus full sequential scrolling; reuses original 1280 slow-request functional PASS and screenshots.'},null,2)+'\n');console.log('PROGRESSIVE_COMPLETION_PASS');
}finally{await browser.close();}
