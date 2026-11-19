import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('.',import.meta.url)),base='http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const report={views:[],checks:{},modules:{}};
function gate(){let release;const promise=new Promise(r=>release=r);return {promise,release};}
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="280"><rect width="240" height="280" fill="#e9e6df"/><rect x="60" y="45" width="120" height="160" rx="16" fill="#d6bf9f"/><text x="120" y="125" text-anchor="middle" font-size="20" fill="#453c31">SYNTHETIC</text></svg>';
async function stable(page){await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
try{
 for(const width of (process.argv.includes('--remaining')?[390,360,1920]:[1280,390,360,1920])){
  const locale=width===360?'ja-JP':'zh-CN',ctx=await browser.newContext({viewport:{width,height:width===390?844:800},deviceScaleFactor:1});
  await ctx.addInitScript(locale=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_disable_chat_websocket','true');window.progressiveTimeline={};const sample=()=>{for(const [k,sel] of Object.entries({heading:'.catalog-master-heading h1',navigation:'.category-shortcuts',firstCard:'.shopping-shelf .catalog-master-card'}))if(!window.progressiveTimeline[k]&&document.querySelector(sel))window.progressiveTimeline[k]=performance.now();};new MutationObserver(sample).observe(document,{subtree:true,childList:true});},locale);
  const page=await ctx.newPage(),nav=gate(),images=gate(),slow=gate(),errors=[],consoleErrors=[],requests=[],responses=[],bodies=[],modules=[];let imagesReleased=false,active=0,maxActive=0,failThird=width===390;
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  const inFlight=new Set();page.on('request',r=>{const u=new URL(r.url());if(u.pathname.endsWith('/product-browse/shelf')){inFlight.add(r);maxActive=Math.max(maxActive,inFlight.size);}if(u.pathname.startsWith('/api/'))requests.push({path:u.pathname,query:u.search,method:r.method()});});
  page.on('requestfinished',r=>inFlight.delete(r));page.on('requestfailed',r=>inFlight.delete(r));
  page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))responses.push({path:u.pathname,status:r.status()});if(r.status()>=200&&r.status()<300&&(/\/src\/(useProgressiveCatalog|pages\/PublicProductCatalog|public-catalog.css)/.test(u.pathname)))modules.push(r.body().then(b=>report.modules[u.pathname]=createHash('sha256').update(b).digest('hex')));});
  await page.route('**/api/storefront/product-browse/overview?**',async route=>{await nav.promise;await route.continue();});
  await page.route('**/api/storefront/product-browse/shelf?**',async route=>{
   const cat=new URL(route.request().url()).searchParams.get('category');
   if(cat==='shop-000-progressive-02')await slow.promise;
   if(cat==='shop-000-progressive-03'&&failThird){failThird=false;await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'INVALID_REQUEST',message:'Synthetic one-shot failure'})});}
   else await route.continue();
  });
  await page.route('**/progressive-fixture-images/**',async route=>{await images.promise;await route.fulfill({status:200,contentType:'image/svg+xml',body:svg});});
  await page.route('**/api/storefront/recommendation-images/progressive-icon-*',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:svg}));
  await page.goto(base+'/?node=1000',{waitUntil:'domcontentloaded'});
  await page.locator('.catalog-master-heading h1').waitFor();assert(new URL(page.url()).pathname==='/products');assert.equal(await page.locator('.catalog-master-card').count(),0);
  await stable(page);if(width!==1920)await page.screenshot({path:out+`framework-${width}.png`});nav.release();
  const first=page.locator('[data-shelf-category="shop-000-progressive-01"]');await first.locator('.catalog-master-card').first().waitFor();await page.locator('.category-shortcuts').waitFor();await stable(page);
  assert.equal(await first.locator('.catalog-master-card').count(),8);assert.equal(await first.locator('img').evaluateAll(es=>es.filter(e=>e.complete&&e.naturalWidth>0).length),0);
  const initial=await page.evaluate(()=>({timeline:window.progressiveTimeline,cards:document.querySelectorAll('.catalog-master-card').length,eager:document.querySelectorAll('.catalog-master-card img[loading=eager]').length,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('.category-shortcuts a,.category-shortcuts>button,.shopping-shelf header button')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;}).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute('aria-label')||e.textContent,width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderWidth:s.borderWidth,borderColor:s.borderColor,background:s.backgroundColor,shadow:s.boxShadow};})}));
  assert(!initial.overflow);assert.equal(initial.eager,2);assert(initial.timeline.heading<initial.timeline.navigation&&initial.timeline.navigation<initial.timeline.firstCard);for(const c of initial.controls)assert(c.height>=44,JSON.stringify(c));
  if(width!==1920){await page.screenshot({path:out+`first-slow-images-${width}.png`});await page.locator('.category-shortcuts').screenshot({path:out+`navigation-${width}.png`});}
  const second=page.locator('[data-shelf-category="shop-000-progressive-02"]');await second.scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-shelf-category="shop-000-progressive-02"] .shelf-progress'));
  const third=page.locator('[data-shelf-category="shop-000-progressive-03"]');await third.scrollIntoViewIfNeeded();
  if(width===390){await third.getByRole('alert').waitFor();await stable(page);await page.screenshot({path:out+'retry-390.png'});await third.getByRole('button',{name:/重\s*试/}).click();}
  await third.locator('.catalog-master-card').first().waitFor();assert.equal(await second.locator('.catalog-master-card').count(),0);assert.equal(await first.locator('.catalog-master-card').count(),8);assert(maxActive<=2);
  if(width!==1920){await second.scrollIntoViewIfNeeded();await stable(page);await page.screenshot({path:out+`slow-category-${width}.png`});}
  slow.release();images.release();imagesReleased=true;await second.locator('.catalog-master-card').first().waitFor();await page.evaluate(()=>window.scrollTo(0,0));await first.locator('img').first().evaluate(e=>e.decode());await stable(page);
  if(width!==1920){await page.screenshot({path:out+`ready-${width}.png`});await first.screenshot({path:out+`first-shelf-${width}.png`});}
  const initialRequests=requests.filter(r=>r.path.includes('product-browse'));
  assert(!initialRequests.some(r=>r.path==='/api/storefront/product-browse'));assert(!initialRequests.some(r=>r.path.endsWith('/shelf')&&new URLSearchParams(r.query).get('category')==='shop-000-progressive-01'));
  assert(!requests.some(r=>r.method!=='GET'));
  assert(!requests.some(r=>r.query.includes('progressive-private')));
  if(width===390){
   await page.locator('.category-shortcuts a').first().click();await page.waitForURL(/category=shop-000-progressive-01/);await page.locator('.shopping-shelf .catalog-master-card').first().waitFor();
   await page.goBack();await page.locator('.category-shortcuts').waitFor();await page.locator('.shopping-shelf .catalog-master-card').first().waitFor();
   report.checks.categoryClickAndBrowserBack='PASS';
   await page.goto(base+'/products?node=1000&category=shop-progressive-leaf-1&query=SYNTHETIC-PROGRESSIVE-1-20');await page.locator('.catalog-master-card').first().waitFor();assert.equal(await page.locator('.catalog-master-card').count(),1);report.checks.directLeafSearch='PASS';
  }
  await Promise.all(modules);assert.deepEqual(errors,[]);const unexpected=responses.filter(r=>r.status>=400&&!(width===390&&r.path.endsWith('/shelf')&&r.status===400));assert.deepEqual(unexpected,[]);
  report.views.push({width,locale,initial,maxActive,errors,consoleErrors,requests,responses});writeFileSync(out+'browser-'+width+'.json',JSON.stringify(report.views.at(-1),null,2)+'\n');await ctx.close();
 }
 report.result='PASS';writeFileSync(out+'browser.json',JSON.stringify(report,null,2)+'\n');console.log('PROGRESSIVE_BROWSER_PASS');
}finally{await browser.close();}
