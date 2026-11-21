import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('.',import.meta.url).pathname,browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),results=[];
for(const width of [390,1440,360]){
 const context=await browser.newContext({viewport:{width,height:width===1440?900:width===360?800:844},isMobile:width<768,hasTouch:width<768}),p=await context.newPage(),errors=[],requests=[];
 await p.addInitScript(()=>{localStorage.bobbuy_locale='zh-CN';localStorage.bobbuy_disable_chat_websocket='true';localStorage.bobbuy_store_navigation_mobile='collapsed';localStorage.bobbuy_store_navigation_desktop='collapsed';});
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(r.url().includes('/product-browse'))requests.push(new URL(r.url()).pathname+new URL(r.url()).search);});
 const snapshot=async name=>{await p.screenshot({path:out+`primary-${name}-${width}.png`});const state=await p.evaluate(()=>({y:scrollY,overflow:document.documentElement.scrollWidth>innerWidth,mounted:[...document.querySelectorAll('.compact-product-card')].map(x=>x.dataset.productId),rows:[...document.querySelectorAll('[data-window-row]')].map(x=>({row:x.dataset.windowRow,top:x.getBoundingClientRect().top,height:x.getBoundingClientRect().height})),headings:[...document.querySelectorAll('.shopping-section-heading')].slice(0,3).map(x=>({text:x.textContent,top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom})),top:parseFloat(getComputedStyle(document.querySelector('.public-product-catalog')).getPropertyValue('--category-section-top'))}));assert.equal(state.overflow,false);assert.equal(new Set(state.mounted).size,state.mounted.length);return state;};
 const goto=async category=>{await p.goto('http://127.0.0.1:5188/products?node=1000'+(category?'&category='+category:''),{waitUntil:'domcontentloaded'});await p.locator('.compact-product-card').first().waitFor();await p.waitForTimeout(250);};
 try{
 await goto('shop-000-progressive-01');const overview=await snapshot('overview-initial');assert.equal(await p.locator('.shopping-secondary-section').count(),2);const first=p.locator('.shopping-secondary-section').nth(0),second=p.locator('.shopping-secondary-section').nth(1);
 await first.evaluate(el=>scrollTo(0,el.getBoundingClientRect().top+scrollY+250));await p.waitForTimeout(400);const pinned=await snapshot('section-pinned');assert(Math.abs(pinned.headings[0].top-pinned.top)<2);
 await second.evaluate(el=>{const top=parseFloat(getComputedStyle(document.querySelector('.public-product-catalog')).getPropertyValue('--category-section-top'));scrollTo(0,el.getBoundingClientRect().top+scrollY-top-20);});await p.waitForTimeout(400);const push=await snapshot('section-push');
 await second.evaluate(el=>{const top=parseFloat(getComputedStyle(document.querySelector('.public-product-catalog')).getPropertyValue('--category-section-top'));scrollTo(0,el.getBoundingClientRect().top+scrollY-top+80);});await second.locator('.compact-product-card').first().waitFor();await p.waitForTimeout(250);const replaced=await snapshot('section-replaced');assert(Math.abs(replaced.headings[1].top-replaced.top)<2);assert(replaced.headings[0].bottom<=replaced.top+1);
 await first.evaluate(el=>scrollTo(0,el.getBoundingClientRect().top+scrollY+250));await first.locator('.compact-product-card').first().waitFor();await p.waitForTimeout(300);const reverse=await snapshot('section-reverse');assert(Math.abs(reverse.headings[0].top-reverse.top)<2);
 results.push({width,pass:true,overview,pinned,push,replaced,reverse,requests,errors});assert.deepEqual(errors,[]);console.log('PASS',width);
 }catch(e){results.push({width,pass:false,error:String(e),requests,errors});console.log('FAIL',width,String(e));await p.screenshot({path:out+`functional-failure-${width}.png`});}
 await context.close();writeFileSync(out+'functional-primary.json',JSON.stringify(results,null,2));
}
await browser.close();
