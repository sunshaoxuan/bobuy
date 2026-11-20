import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out=new URL('.',import.meta.url),base='http://127.0.0.1:5176',browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),rows=[];
async function capture(page,name,compact){
 await page.waitForFunction(()=>document.querySelector('.catalog-master-card')&&document.querySelector('.public-product-catalog').getAttribute('aria-busy')==='false');await page.evaluate(()=>document.fonts.ready);await page.locator('.category-shortcuts img').first().evaluate(i=>i.decode());await page.evaluate(y=>scrollTo(0,y),compact?420:0);await page.waitForTimeout(220);
 const g=await page.evaluate(()=>{const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,width:r.width,background:getComputedStyle(e).backgroundColor};};return {header:rect('.store-header'),dock:rect('.catalog-dock'),surface:rect('.catalog-dock-surface'),image:rect('.category-shortcuts img'),overflow:document.documentElement.scrollWidth>innerWidth,compact:document.querySelector('.catalog-dock').dataset.compact};});
 assert(!g.overflow);assert.equal(g.compact,String(compact));assert.equal(g.header.background,'rgb(255, 255, 255)');assert(g.dock.top>=g.header.bottom-1);assert.equal(g.dock.height,156);assert.equal(g.image.width,compact?36:48);
 await page.screenshot({path:new URL(name+'.png',out).pathname});await page.locator('.catalog-dock-surface').screenshot({path:new URL(name+'-navigation.png',out).pathname});rows.push({name,result:'PASS',geometry:g});
}
try{
 for(const [width,height] of [[1920,900],[390,844],[360,800],[1280,800]]){
  const ctx=await browser.newContext({viewport:{width,height}}),page=await ctx.newPage();await ctx.addInitScript(()=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');});
  await page.goto(base+'/products?node=1000');await capture(page,'expanded-'+width,false);
  if(width!==1280){await capture(page,'compact-'+width,true);await page.goto(base+'/products?node=1000&category=shop-000-progressive-07');await capture(page,'selected-'+width,true);}
  await ctx.close();console.log('PASS final visual',width);
 }
 for(const locale of ['zh-TW','en-US','ja-JP']){
  const ctx=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'}),page=await ctx.newPage();await ctx.addInitScript(l=>{localStorage.setItem('bobbuy_locale',l);localStorage.setItem('bobbuy_disable_chat_websocket','true');},locale);await page.goto(base+'/products?node=1000&category=shop-progressive-leaf-7');await capture(page,'reduced-'+locale+'-360',true);await ctx.close();
 }
 writeFileSync(new URL('visual.json',out),JSON.stringify({result:'PASS',reason:'Only products header opacity changed after functional PASS; geometry/screenshots refreshed without repeating gesture/history/business checks',rows},null,2)+'\n');
}finally{await browser.close();}
