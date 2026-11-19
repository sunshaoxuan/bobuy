import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('.',import.meta.url)),base='http://127.0.0.1:5175';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const results=[];
function gate(){let release;const promise=new Promise(r=>release=r);return {promise,release};}
try{
 for(const width of [1920,390])for(const scenario of ['normal','slow-icons','failed-icons','slow-products','slow-shelf']){
  const ctx=await browser.newContext({viewport:{width,height:width===1920?900:844}}),page=await ctx.newPage(),blocked=gate(),errors=[],consoleErrors=[],network=[];
  await ctx.addInitScript(()=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('response',r=>{const p=new URL(r.url()).pathname;if(p.startsWith('/api/'))network.push({path:p,status:r.status()});});
  await page.route('**/api/storefront/recommendation-images/*',async route=>{
   const p=new URL(route.request().url()).pathname;
   if(p.includes('icon-priority')&&scenario==='failed-icons'){await route.fulfill({status:404,body:''});return;}
   if(p.includes('icon-priority')&&scenario==='slow-icons'||p.includes('product-priority')&&scenario==='slow-products')await blocked.promise;
   await route.continue();
  });
  if(scenario==='slow-shelf')await page.route('**/api/storefront/product-browse/shelf?**',async route=>{if(new URL(route.request().url()).searchParams.get('category')==='shop-000-progressive-02')await blocked.promise;await route.continue();});
  await page.goto(base+'/products?node=1000',{waitUntil:'domcontentloaded'});const first=page.locator('[data-shelf-category="shop-000-progressive-01"]');await first.locator('.catalog-master-card').first().waitFor();assert.equal(await first.locator('.catalog-master-card').count(),8);
  assert.equal(await page.locator('.category-shortcuts a').count(),24); // 23 fixture roots + existing synthetic root
  assert(!(await page.locator('.public-product-catalog').innerText()).includes('本批'));for(const e of await page.locator('.catalog-progress > span').allTextContents())assert.equal(e,'正在加载');
  if(scenario==='slow-icons')assert.equal(await page.locator('.category-shortcuts img').evaluateAll(es=>es.filter(e=>e.complete&&e.naturalWidth>0).length),0);
  if(scenario==='failed-icons'){await page.waitForFunction(()=>document.querySelectorAll('.category-shortcuts span.category-shortcuts-image').length>0);}
  if(scenario==='slow-products')assert.equal(await first.locator('img').evaluateAll(es=>es.filter(e=>e.complete&&e.naturalWidth>0).length),0);
  if(scenario==='slow-shelf'){
   const second=page.locator('[data-shelf-category="shop-000-progressive-02"]'),third=page.locator('[data-shelf-category="shop-000-progressive-03"]');await second.scrollIntoViewIfNeeded();await third.scrollIntoViewIfNeeded();await third.locator('.catalog-master-card').first().waitFor();assert.equal(await second.locator('.catalog-master-card').count(),0);await page.evaluate(()=>window.scrollTo(0,0));
  }
  if(scenario==='normal')await page.locator('.category-shortcuts img').first().evaluate(i=>i.decode());
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const timings=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/api/')).map(r=>({path:new URL(r.name).pathname,start:r.startTime,end:r.responseEnd,bytes:r.transferSize})));
  const geometry=await page.locator('.category-shortcuts').evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...el.querySelectorAll('a,button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,label:e.getAttribute('aria-label'),width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,shadow:s.boxShadow};}),images:[...el.querySelectorAll('img')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,loading:e.loading,priority:e.getAttribute('fetchpriority'),naturalWidth:e.naturalWidth}))}));assert(!geometry.overflow);for(const c of geometry.controls)assert(c.height>=44);
  await page.screenshot({path:out+`${scenario}-${width}.png`});if(scenario==='normal')await page.locator('.category-shortcuts').screenshot({path:out+`navigation-${width}.png`});
  blocked.release();
  if(scenario==='failed-icons'){await page.locator('.category-shortcuts a').first().click();await page.waitForURL(/category=shop-000-progressive-01/);await page.locator('.catalog-master-card').first().waitFor();}
  const unexpected=network.filter(r=>r.status>=400&&!(scenario==='failed-icons'&&r.path.includes('icon-priority')&&r.status===404));assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);if(scenario!=='failed-icons')assert.deepEqual(consoleErrors,[]);
  results.push({width,scenario,result:'PASS',geometry,timings,errors,consoleErrors,network});writeFileSync(out+'faults.json',JSON.stringify({result:'PASS',results},null,2)+'\n');await ctx.close();console.log('PASS',scenario,width);
 }
}finally{await browser.close();}
