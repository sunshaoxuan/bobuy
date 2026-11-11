import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out='../docs/reports/evidence/card-price-name-20261111',base=process.argv[2]??'http://127.0.0.1:5181',label=process.argv[3]??'candidate';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
for(const width of [360,390,462,1440])for(const locale of ['zh-CN','ja-JP','en-US','zh-TW']){
 const page=await browser.newPage({viewport:{width,height:1200},deviceScaleFactor:1}),errors=[],failures=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\/api\//.test(r.url()))failures.push({status:r.status(),url:r.url()});});
 await page.addInitScript(l=>localStorage.setItem('bobbuy_locale',l),locale);
 await page.goto(base+'/recommendations');await page.locator('.compact-product-card').first().waitFor();await page.waitForTimeout(1200);
 const cards=page.locator('.compact-product-card');
 const data=await cards.evaluateAll(els=>els.slice(0,2).map(el=>{const box=s=>{const n=el.querySelector(s);return n?{...n.getBoundingClientRect().toJSON(),text:n.textContent,display:getComputedStyle(n).display,font:getComputedStyle(n).font,color:getComputedStyle(n).color}:null;};return {card:el.getBoundingClientRect().toJSON(),name:box('.product-name'),heading:box('h3'),native:box('.compact-card-native-name'),code:box('.rec-pin-code'),rating:box('.product-rating'),price:box('.card-money'),original:box('del'),discount:box('.compact-card-reduction')};}));
 assert.equal(data.length,2);assert(Math.abs(data[0].code.y-data[1].code.y)<1);assert(Math.abs(data[0].price.y-data[1].price.y)<1);
 if(locale==='ja-JP')assert.equal(data[0].native,null);else {assert(Math.abs(data[0].native.y-data[0].heading.bottom)<1);assert.equal(data[0].native.height,18);assert(data[0].native.text.includes('クランチー'));assert(!data[0].heading.text.includes('クランチー'));const style=await cards.first().locator('.compact-card-native-name').evaluate(e=>({whiteSpace:getComputedStyle(e).whiteSpace,overflow:getComputedStyle(e).textOverflow}));assert.deepEqual(style,{whiteSpace:'nowrap',overflow:'ellipsis'});}
 assert(data[0].original.text.includes('1,998'));assert(data[0].discount.text.includes('400'));assert(data[1].discount.text.includes('590'));assert.equal(data[0].discount.color,'rgb(180, 35, 24)');assert(data[0].name.height>=44);
 await page.screenshot({path:`${out}/${label}-${locale}-${width}.png`});
 const a=data[0].card,b=data[1].card;await page.screenshot({path:`${out}/${label}-${locale}-${width}-cards.png`,clip:{x:a.x,y:a.y,width:b.right-a.x,height:Math.max(a.height,b.height)}});
 if(width===390&&locale==='zh-CN'){
  await cards.first().locator('.product-name').click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  await cards.first().locator('.review-stars-button').click();await page.locator('.review-distribution').waitFor();await page.keyboard.press('Escape');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);results.push({width,locale,data,errors,failures});await page.close();
}
fs.writeFileSync(`${out}/${label}-matrix.json`,JSON.stringify(results,null,2));await browser.close();console.log('PASS '+results.length+' viewport/language cases');
