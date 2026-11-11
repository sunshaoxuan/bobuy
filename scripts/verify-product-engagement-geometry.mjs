import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=fileURLToPath(new URL('../docs/reports/evidence/product-engagement/',import.meta.url));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']}),report=[];
try{
 for(const width of [1440,768,320]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await context.newPage();
  for(const route of ['products','recommendations']){
   await page.goto('http://127.0.0.1:4173/'+route+'?node=98733001');await page.locator('.compact-product-card').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.product-popularity')].slice(0,2).every(e=>!e.textContent.includes('…')));
   const select=page.locator('.product-sort').first();
   const choose=async value=>{if(await select.inputValue()===value)return;const response=page.waitForResponse(r=>r.status()===200&&(new URL(r.url()).pathname.endsWith('/product-browse')||new URL(r.url()).pathname.endsWith('/recommendation-browse/items'))&&new URL(r.url()).searchParams.get('sort')===value);await select.selectOption(value);await response;};
   if(width===1440){for(const [sort,id] of [['price-desc','29'],['price-asc','00'],['rating-desc','00'],['rating-asc','02'],['heat-desc','01'],['heat-asc','02'],['default','00']]){await choose(sort);await page.waitForFunction(id=>document.querySelector('.compact-product-card')?.getAttribute('data-product-id')==='engagement-qa-'+id,id);}report.push({route,name:'all-sort-directions',width,check:'PASS: all seven options reorder complete-scope API results'});}
   if(width===320){await choose('price-desc');await select.screenshot({path:out+route+'-longest-sort-final-320.png',animations:'disabled'});await choose('default');await page.waitForFunction(()=>document.querySelector('.compact-product-card')?.getAttribute('data-product-id')==='engagement-qa-00');}
   await page.screenshot({path:out+route+'-final-'+width+'.png',fullPage:true,animations:'disabled'});
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+route+'-viewport-final-'+width+'.png',animations:'disabled'});
   for(const [name,locator] of [['sort',page.locator('.product-sort').first()],['heat',page.locator('.compact-product-card[data-product-id="engagement-qa-00"] .product-popularity').first()],['maximum-card',page.locator('.compact-product-card[data-product-id="engagement-qa-01"]').first()]]){
    await locator.evaluate(e=>{const r=e.getBoundingClientRect();window.scrollTo(0,window.scrollY+r.top-160);});await locator.screenshot({path:out+route+'-'+name+'-final-'+width+'.png',animations:'disabled'});
    const measured=await locator.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{bounds:{width:r.width,height:r.height},padding:[s.paddingTop,s.paddingRight,s.paddingBottom,s.paddingLeft].map(Number.parseFloat),border:[s.borderTopWidth,s.borderRightWidth,s.borderBottomWidth,s.borderLeftWidth].map(Number.parseFloat),text:e.textContent,font:s.font,roles:[...e.querySelectorAll('[role=radio]')].map(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height};}),overflow:e.scrollWidth>e.clientWidth,viewport:{width:innerWidth,height:innerHeight}};});
    assert(!measured.overflow);if(name==='sort')assert(measured.bounds.height>=44);report.push({route,name,width,file:route+'-'+name+'-final-'+width+'.png',...measured});
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===320){
    const exact='9,223,372,036,854,775,807';await page.locator('.compact-product-card[data-product-id="engagement-qa-01"] .product-popularity [tabindex="0"]').first().click();
    await page.getByRole('tooltip').filter({hasText:exact}).waitFor();assert.equal(await page.locator('.ant-drawer:visible').count(),0);
    const response=await page.request.get('http://127.0.0.1:4173/api/storefront/product-popularity/engagement-qa-01');assert.equal((await response.json()).data.clicks,'9223372036854775807');
    await page.screenshot({path:out+route+'-exact-count-'+width+'.png',animations:'disabled'});report.push({route,name:'exact-count-tooltip',width,check:'PASS: complete count visible, no detail opened or count mutation'});
   }
  }
  await context.close();
 }
 writeFileSync(out+'geometry.json',JSON.stringify(report,null,2));console.log('GEOMETRY_CAPTURE_PASS');
}finally{await browser.close();}
