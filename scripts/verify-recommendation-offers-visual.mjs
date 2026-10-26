import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const output=new URL('../docs/reports/evidence/recommendation-offers/',import.meta.url);
const id=JSON.parse(readFileSync(new URL('ui.json',output),'utf8')).postId;
assert(/^\d+$/.test(id));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),report={scope:'Only final offer-card display changed; reuse earlier full workflow receipt',postId:id,checks:{},errors:[]};
page.on('pageerror',error=>report.errors.push(error.message));
try {
 await page.goto('http://127.0.0.1:18080/admin/recommendations?post='+id);
 await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();
 await page.waitForURL('**/admin/users');await page.goto('http://127.0.0.1:18080/admin/recommendations?post='+id);
 assert.equal(await page.locator('#rec-title').inputValue(),'[Synthetic acceptance] Costco offer facts');
 await page.getByRole('button',{name:/发表文章/}).click();await page.getByRole('button',{name:/撤回编辑/}).waitFor();
 await page.goto('http://127.0.0.1:18080/recommendations/'+id);
 await page.locator('.rec-pin').nth(5).waitFor();
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.waitForFunction(()=>[...document.querySelectorAll('.rec-pin')].every(card=>card.getBoundingClientRect().height>0));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const checks=await page.locator('.rec-pin').evaluateAll(cards=>cards.map(card=>{
   const info=card.querySelector('.rec-offer-info'),tile=card.querySelector('.product-tile');
   return {outsideImageOverlay:!tile.contains(info),notClipped:info.getBoundingClientRect().bottom<=card.getBoundingClientRect().bottom,topBelowPhoto:info.getBoundingClientRect().top>=tile.getBoundingClientRect().bottom,text:info.innerText};
  }));
  for(const check of checks)assert(check.outsideImageOverlay&&check.notClipped&&check.topBelowPhoto,JSON.stringify(check));
  assert(checks[0].text.includes('100g')&&checks[0].text.includes('2026-11-21'));
  assert(checks[5].text.includes('券发放期间')&&checks[5].text.includes('2026-11-08'));
  report.checks[String(width)]=checks;
  await page.screenshot({path:fileURLToPath(new URL('customer-'+(width===390?'mobile':'desktop')+'.png',output)),fullPage:true,animations:'disabled'});
  if(width===390){
   await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
   assert(await page.locator('.rec-pin').last().evaluate(card=>card.getBoundingClientRect().bottom<=document.querySelector('.store-bottom').getBoundingClientRect().top));
   await page.screenshot({path:fileURLToPath(new URL('customer-mobile-bottom.png',output)),animations:'disabled'});
  }
 }
 report.result=report.errors.length?'FAIL':'PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}
finally {
 try{await page.goto('http://127.0.0.1:18080/admin/recommendations?post='+id);await page.getByRole('button',{name:/撤回编辑/}).click();await page.getByRole('button',{name:/发表文章/}).waitFor();report.fixtureWithdrawn=true;}catch(error){report.cleanupError=error.message;}
 writeFileSync(new URL('visual.json',output),JSON.stringify(report,null,2)+'\n');await browser.close();
}
