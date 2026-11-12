import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=fileURLToPath(new URL('../docs/reports/evidence/product-engagement-production/',import.meta.url));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
const result={origin:'https://bobuy.cc',data:'real public production catalog after temporary QA fixtures removed',console:[],network:[],views:[]};
try{
 for(const width of [1440,768,320]){
  const ctx=await browser.newContext({viewport:{width,height:900}});await ctx.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await ctx.newPage();
  page.on('pageerror',e=>result.console.push(e.message));page.on('console',m=>{if(m.type()==='error')result.console.push(m.text());});page.on('response',r=>{if(r.status()>=400)result.network.push({path:new URL(r.url()).pathname,status:r.status()});});
  for(const route of ['products','recommendations']){
   await page.goto('https://bobuy.cc/'+route);const cards=page.locator('.compact-product-card');await cards.first().waitFor();
   await page.waitForFunction(()=>[...document.querySelectorAll('.product-popularity')].every(e=>!e.textContent.includes('…')));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.getByText('【发布验收临时商品】',{exact:false}).count(),0);
   const sort=page.locator('.product-sort').first();assert.equal(await sort.locator('option').count(),7);
   const priceOrders=[];
   for(const value of ['price-asc','price-desc','rating-asc','rating-desc','heat-asc','heat-desc','default']){
    if(await sort.inputValue()===value)continue;
    const response=page.waitForResponse(r=>r.status()===200&&r.url().includes('sort='+value)&&/browse/.test(r.url()));await sort.selectOption(value);await response;
    if(value.startsWith('price')){
     await page.waitForTimeout(1000);
     const prices=await cards.evaluateAll(elements=>elements.map(e=>{const money=e.querySelector('.compact-card-price .card-money');return money?{currency:money.querySelector('small').getAttribute('title'),amount:Number(money.querySelector('strong').textContent.replaceAll(',',''))}:null;}));
     const last=new Map();let unknown=false;for(const price of prices){if(!price){unknown=true;continue;}assert.equal(unknown,false,'A known displayed price appeared after an unknown price');assert(Number.isFinite(price.amount));if(last.has(price.currency)){const prior=last.get(price.currency);assert(value==='price-asc'?price.amount>=prior:price.amount<=prior,{route,width,value,prices});}last.set(price.currency,price.amount);}
     priceOrders.push({direction:value,values:prices,result:'PASS'});
    }
   }
   await page.waitForFunction(()=>[...document.querySelectorAll('.compact-product-card')].slice(0,5).every(c=>[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)));await page.screenshot({path:out+'production-real-'+route+'-'+width+'.png'});
   const card=cards.first();await card.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await card.screenshot({path:out+'production-real-card-'+route+'-'+width+'.png'});
   const controls=[];
   for(const [name,locator] of [['sort',sort],['heat',card.locator('.product-popularity')]]){
    await locator.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const box=await locator.boundingBox();assert(box);if(name==='sort')assert(box.height>=44);
    const file='production-real-'+route+'-'+name+'-'+width+'.png';await locator.screenshot({path:out+file});controls.push({name,box,file});
   }
   result.views.push({route,width,cards:await cards.count(),allSevenSortOptions:'PASS',displayedPriceOrder:priceOrders,noHorizontalOverflow:'PASS',controls});
  }
  await ctx.close();
 }
 assert.deepEqual(result.console,[]);assert.deepEqual(result.network,[]);result.result='PASS';
}finally{writeFileSync(out+'real-pages.json',JSON.stringify(result,null,2));await browser.close();}
console.log('REAL_PRODUCTION_CATALOG_ACCEPTANCE_PASS');
