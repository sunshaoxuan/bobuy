import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),out=new URL('.',import.meta.url).pathname,results=existsSync(out+'media-edges.json')?JSON.parse(readFileSync(out+'media-edges.json','utf8')):[];
for(const width of (process.env.EDGE_DIAGNOSTIC?[390]:[360,390,1440]))for(const scenario of (process.env.EDGE_DIAGNOSTIC?['slow-first-promote']:['slow-first-promote','failed-first','close-switch'])){
 if(results.some(r=>r.width===width&&r.scenario===scenario&&r.pass)||width===360&&scenario!=='slow-first-promote')continue;
 const c=await browser.newContext({viewport:{width,height:width===360?800:width===390?844:900},isMobile:width<400,hasTouch:width<400}),p=await c.newPage(),events=[],errors=[];
 await c.addInitScript(()=>{localStorage.bobbuy_locale='zh-CN';localStorage.bobbuy_disable_chat_websocket='true';localStorage.bobbuy_store_navigation_mobile='collapsed';localStorage.bobbuy_store_navigation_desktop='collapsed';});
 await p.route('**/product-popularity/*/click',r=>r.fulfill({json:{data:{clicks:'0'}}}));
 p.on('request',r=>{if(r.url().includes('/detail-perf-fixture-'))events.push({url:new URL(r.url()).pathname,at:Date.now()});});p.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>release=r);let blocked=false;
 await p.route('**/recommendation-images/detail-perf-fixture-1',async r=>{blocked=true;if(scenario==='failed-first')await r.fulfill({status:404,body:'synthetic failure'});else {await gate;await r.continue();}});
 await p.goto('http://127.0.0.1:5187/products?node=1000&category=shop-progressive-leaf-1&product=progressive-item-1-1',{waitUntil:'domcontentloaded'});
 await p.locator('.consumer-detail-info h1').waitFor();await p.waitForFunction(()=>document.querySelector('.rec-gallery-navigation')?.textContent.includes('1 / 4'));
 const info=await p.locator('.consumer-detail-info h1').boundingBox();assert(info&&info.y< (width===360?800:width===390?844:900));
 if(scenario==='slow-first-promote'){
  assert(blocked);assert.equal(events.filter(e=>!e.url.endsWith('-1')).length,0);await p.screenshot({path:out+`candidate-media-pending-${width}.png`});const rect=await p.locator('.rec-detail-gallery').boundingBox();if(rect)await p.screenshot({path:out+`candidate-media-pending-${width}-detail.png`,clip:rect});
  await p.locator('.rec-detail-thumbs button').nth(3).click();await p.waitForFunction(()=>{const i=document.querySelector('.rec-gallery-slide[aria-hidden=false] img');return i?.getAttribute('src')?.endsWith('-4')&&i.complete&&i.naturalWidth>0;});
  assert(events.findIndex(e=>e.url.endsWith('-4'))<events.findIndex(e=>e.url.endsWith('-2'))||!events.some(e=>e.url.endsWith('-2')));
  await p.locator('.rec-gallery-inline').click();await p.locator('.rec-gallery-fullscreen .ant-modal-content').waitFor();await p.locator('.rec-gallery-stage[data-ready=true]').waitFor();await p.keyboard.press('ArrowLeft');console.log('Album after left',await p.locator('.rec-gallery-tools').innerText());await p.waitForFunction(()=>document.querySelector('.rec-gallery-tools')?.textContent.includes('3 / 4'));await p.keyboard.press('Escape');
  release();await p.screenshot({path:out+`candidate-media-promote-${width}.png`});
 }else if(scenario==='failed-first'){
  await p.locator('.rec-detail-thumbs button').nth(1).click();await p.waitForFunction(()=>{const i=document.querySelector('.rec-gallery-slide[aria-hidden=false] img');return i?.getAttribute('src')?.endsWith('-2')&&i.complete&&i.naturalWidth>0;});
  await p.screenshot({path:out+`candidate-media-failure-${width}.png`});
 }else{
  await p.locator('.ant-drawer-close').click();release();await p.locator('.ant-drawer-content').waitFor({state:'hidden'});
  await p.locator('[data-product-id="progressive-item-1-10"] .product-name').click();await p.waitForFunction(()=>document.querySelector('.consumer-product-code')?.textContent.includes('1-10'));
  assert.equal(await p.locator('.rec-gallery-navigation').innerText(),'‹\n1 / 1\n›');
 }
 const geometry=await p.locator('.rec-detail-thumbs button').evaluateAll(xs=>xs.map(x=>{const r=x.getBoundingClientRect();return {width:r.width,height:r.height};}));assert(geometry.every(r=>r.width>=44&&r.height>=44));assert.equal(errors.length,0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 results.push({width,scenario,events,errors,geometry,textVisibleWithFirstPending:!!info,pass:true});writeFileSync(out+'media-edges.json',JSON.stringify(results,null,2));await c.close();
}
await browser.close();console.log(JSON.stringify(results.map(({events,...r})=>r),null,2));
