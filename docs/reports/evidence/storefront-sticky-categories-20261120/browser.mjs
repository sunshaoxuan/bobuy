import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('.',import.meta.url),base='http://127.0.0.1:5176',browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),results=[];
const rect=r=>({top:r.top,bottom:r.bottom,width:r.width,height:r.height});
async function geometry(page){return page.evaluate(()=>{
 const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
 return {header:box('.store-header'),dock:box('.catalog-dock'),surface:box('.catalog-dock-surface'),y:scrollY,overflow:document.documentElement.scrollWidth>innerWidth,compact:document.querySelector('.catalog-dock').dataset.compact,headingSize:getComputedStyle(document.querySelector('.catalog-dock h1')).fontSize,controls:[...document.querySelectorAll('.category-shortcuts a,.category-shortcuts>button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:e.textContent,current:e.getAttribute('aria-current'),width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,color:s.color,shadow:s.boxShadow,outline:s.outline,transition:s.transitionDuration};}),icon:box('.category-shortcuts img'),trackScroll:document.querySelector('.category-shortcuts-track').scrollLeft,firstCardDocumentTop:document.querySelector('.catalog-master-card').getBoundingClientRect().top+scrollY};
 });}
async function settle(page){await page.waitForFunction(()=>document.querySelector('.public-product-catalog')?.getAttribute('aria-busy')==='false'&&document.querySelectorAll('.catalog-master-card').length>0);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(220);}
async function shot(page,name){await page.screenshot({path:new URL(name+'.png',out).pathname});await page.locator('.catalog-dock-surface').screenshot({path:new URL(name+'-navigation.png',out).pathname});}
function check(g,compact){assert(!g.overflow);assert.equal(g.compact,String(compact));assert(g.dock.top>=g.header.bottom-1);if(compact)assert(Math.abs(g.dock.top-g.header.bottom)<1);for(const c of g.controls){assert(c.width>=44);assert(c.height>=44);}assert.equal(g.dock.height,156);assert.equal(g.icon.width,compact?36:48);}
try{
 for(const [width,height] of [[1920,900],[390,844],[360,800],[1280,800]]){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:width<400,isMobile:width<400}),page=await ctx.newPage(),errors=[],consoleErrors=[],network=[];
  await ctx.addInitScript(()=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('response',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/'))network.push({path:u.pathname,category:u.searchParams.get('category'),status:r.status()});});
  await page.goto(base+'/products?node=1000');await settle(page);await page.locator('.category-shortcuts img').first().evaluate(i=>i.decode());
  const expanded=await geometry(page);check(expanded,false);await shot(page,'expanded-'+width);
  if(width===1280){results.push({width,scenario:'expanded',expanded,errors,consoleErrors,network});await ctx.close();continue;}
  await page.evaluate(()=>scrollTo(0,420));await page.waitForFunction(()=>document.querySelector('.catalog-dock').dataset.compact==='true');await page.waitForTimeout(220);
  const compact=await geometry(page);check(compact,true);assert(Math.abs(compact.firstCardDocumentTop-expanded.firstCardDocumentTop)<1);await shot(page,'compact-'+width);
  const track=page.locator('.category-shortcuts-track'),box=await track.boundingBox(),y=await page.evaluate(()=>scrollY);
  if(width<400){
   const cdp=await ctx.newCDPSession(page),x=box.x+box.width-20,ty=box.y+35;
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:ty}]});
   for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*35,y:ty}]});await page.waitForTimeout(20);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
  }else{await page.locator('.category-shortcuts>button').last().click();await page.waitForTimeout(350);}
  assert(await track.evaluate(e=>e.scrollLeft)>0);assert(Math.abs(await page.evaluate(()=>scrollY)-y)<2);
  const target=page.locator('.category-shortcuts a[href*="category=shop-000-progressive-07"]');await target.focus();await page.waitForTimeout(80);
  const before={y:await page.evaluate(()=>scrollY),x:await track.evaluate(e=>e.scrollLeft)};
  const focus=await target.evaluate(e=>({focused:document.activeElement===e,outline:getComputedStyle(e).outlineWidth}));assert(focus.focused);assert.notEqual(focus.outline,'0px');
  await target.press('Enter');await page.waitForURL(/category=shop-000-progressive-07/);await page.waitForFunction(()=>document.querySelectorAll('.catalog-master-card').length===20);await settle(page);
  assert.equal(await page.locator('.category-shortcuts a[aria-current="true"]').count(),1);assert((await page.locator('.category-shortcuts a[aria-current="true"]').getAttribute('href')).includes('category=shop-000-progressive-07'));
  assert(await page.locator('.catalog-master-card').evaluateAll(es=>es.every(e=>e.dataset.productId.startsWith('progressive-item-7-'))));assert.equal(await page.locator('.shopping-shelf').count(),0);
  await page.evaluate(()=>scrollTo(0,420));await page.waitForTimeout(220);const selected=await geometry(page);check(selected,true);const active=selected.controls.find(c=>c.current==='true');assert.equal(active.background,'rgb(36, 36, 36)');assert.equal(active.color,'rgb(255, 255, 255)');await shot(page,'selected-'+width);
  await page.goBack();await settle(page);await page.waitForFunction(v=>Math.abs(scrollY-v)<2,before.y);assert(Math.abs(await track.evaluate(e=>e.scrollLeft)-before.x)<2);
  const restored=await geometry(page);
  await page.goto(base+'/products?node=1000&category=shop-progressive-leaf-7');await settle(page);assert((await page.locator('.category-shortcuts a[aria-current="true"]').getAttribute('href')).includes('category=shop-000-progressive-07'));assert.equal(await page.locator('.shopping-toolbar strong[aria-current="page"]').count(),1);assert(await page.locator('.catalog-master-card').evaluateAll(es=>es.every(e=>e.dataset.productId.startsWith('progressive-item-7-'))));
  let resized;
  if(width===390){await page.evaluate(()=>scrollTo(0,420));await page.setViewportSize({width:900,height:844});await page.waitForTimeout(250);const desktop=await geometry(page);check(desktop,true);await page.setViewportSize({width,height});await page.waitForTimeout(250);const mobile=await geometry(page);check(mobile,true);resized={desktop:desktop.header.height,mobile:mobile.header.height};assert.equal(resized.desktop,76);assert.equal(resized.mobile,120);}
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert(!network.some(n=>n.status>=400));results.push({width,result:'PASS',expanded,compact,selected,restored,before,focus,resized,errors,consoleErrors,network});writeFileSync(new URL('browser.json',out),JSON.stringify({results},null,2)+'\n');await ctx.close();console.log('PASS',width);
 }
 for(const locale of ['zh-TW','en-US','ja-JP']){
  const ctx=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'}),page=await ctx.newPage();await ctx.addInitScript(locale=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_disable_chat_websocket','true');},locale);
  await page.goto(base+'/products?node=1000&category=shop-progressive-leaf-7');await settle(page);await page.evaluate(()=>scrollTo(0,420));await page.waitForFunction(()=>document.querySelector('.catalog-dock').dataset.compact==='true');const g=await geometry(page);check(g,true);assert(g.controls.every(c=>c.transition==='0s'));assert.equal(await page.locator('.catalog-dock h1').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');await shot(page,'reduced-'+locale+'-360');results.push({locale,width:360,result:'PASS',reducedMotion:true,geometry:g});await ctx.close();console.log('PASS reduced',locale);
 }
 writeFileSync(new URL('browser.json',out),JSON.stringify({result:'PASS',results},null,2)+'\n');
}finally{await browser.close();}
