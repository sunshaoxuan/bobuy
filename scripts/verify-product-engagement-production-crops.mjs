import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=fileURLToPath(new URL('../docs/reports/evidence/product-engagement-production/',import.meta.url));
const report=JSON.parse(readFileSync(out+'real-pages.json','utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
try{
 const desktop=await browser.newPage({viewport:{width:1440,height:900}});await desktop.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));await desktop.goto('https://bobuy.cc/products');await desktop.locator('.compact-product-card').first().waitFor();
 await desktop.waitForFunction(()=>[...document.querySelectorAll('.compact-product-card')].slice(0,5).every(c=>[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)));
 const rows=[];for(let i=0;i<5;i++){
  const card=desktop.locator('.compact-product-card').nth(i);const proof=await card.evaluate(e=>({product:e.getAttribute('data-product-id'),ratingContainers:e.querySelectorAll('.product-rating').length,rateComponents:e.querySelectorAll('.ant-rate').length,starSlots:e.querySelectorAll('.ant-rate-star').length,svgRows:[...new Set([...e.querySelectorAll('.ant-rate svg')].map(s=>Math.round(s.getBoundingClientRect().y)))]}));
  assert.equal(proof.ratingContainers,1);assert.equal(proof.rateComponents,1);assert.equal(proof.starSlots,5);assert.equal(proof.svgRows.length,1);rows.push(proof);await card.screenshot({path:out+'production-desktop-card-'+(i+1)+'.png'});
 }
 report.desktopStarRows={result:'PASS',data:rows};await desktop.close();
 const ctx=await browser.newContext({viewport:{width:320,height:900}});await ctx.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await ctx.newPage();
 for(const route of ['products','recommendations']){
  await page.goto('https://bobuy.cc/'+route);const cards=page.locator('.compact-product-card');await cards.first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.product-popularity')].every(e=>!e.textContent.includes('…')));
  await cards.first().evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  await cards.first().locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await cards.first().screenshot({path:out+'production-real-card-'+route+'-320.png'});
  const heat=cards.first().locator('.product-popularity');await heat.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  const box=await heat.boundingBox();assert(box);assert(box.y+box.height<800);await heat.screenshot({path:out+'production-real-'+route+'-heat-320.png'});
  const view=report.views.find(v=>v.route===route&&v.width===320);view.controls.find(c=>c.name==='heat').box=box;
  const last=cards.last().locator('.product-popularity');await last.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
  const lastBox=await last.boundingBox();const nav=await page.locator('.browse-mobile-shortcuts').boundingBox();assert(lastBox&&nav);assert(lastBox.y+lastBox.height<=nav.y-3,{lastBox,nav});
  await cards.last().locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await cards.last().screenshot({path:out+'production-last-card-'+route+'-320.png'});await page.screenshot({path:out+'production-last-viewport-'+route+'-320.png'});view.lastCardHeatReachable={result:'PASS',heat:lastBox,navigation:nav,gap:nav.y-lastBox.y-lastBox.height};
 }
 writeFileSync(out+'real-pages.json',JSON.stringify(report,null,2));
}finally{await browser.close();}
console.log('MOBILE_CARD_CROPS_AND_LAST_HEAT_REACHABILITY_PASS');
