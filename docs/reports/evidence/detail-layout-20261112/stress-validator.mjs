import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out='../docs/reports/evidence/detail-layout-20261112',row=JSON.parse(fs.readFileSync(out+'/source-occurrence.json','utf8')),b=await chromium.launch({channel:'chrome',headless:true}),results=[];
for(const scenario of ['unknown','zero','max']){
 const p=await b.newPage({viewport:{width:360,height:844}});await p.addInitScript(()=>localStorage.setItem('bobbuy_locale','en-US'));
 await p.route(`**/api/storefront/recommendations/${row.post.id}*`,async route=>{const response=await route.fetch(),data=await response.json(),item=data.data.items.find(i=>i.id===row.item.id);assert(item);item.referenceQuote=undefined;
  if(scenario==='unknown'){item.referencePrice=null;item.originalPrice=null;item.discountAmount=null;item.itemNumber='00001';}
  if(scenario==='zero'){item.referencePrice=0;item.originalPrice=null;item.discountAmount=null;item.currency='USD';}
  if(scenario==='max'){item.itemNumber='1234567890'.repeat(25);item.name='長い商品名'.repeat(40).slice(0,200);item.translations['en-US'].name='Maximum valid translated product name '.repeat(8).slice(0,200);item.packaging='Pack description with dimensions '.repeat(30).slice(0,1000);item.referencePrice=999999999998;item.originalPrice=999999999999;item.discountAmount=1;}
  await route.fulfill({json:data});});
 await p.goto(`http://127.0.0.1:5183/recommendations?topic=${row.post.id}&item=${row.item.id}`);const d=p.getByRole('dialog');await d.locator('h1').waitFor();await p.waitForFunction(()=>{const e=document.querySelector('.ant-drawer-content-wrapper'),t=e&&getComputedStyle(e).transform;return e&&(t==='none'||Math.abs(new DOMMatrixReadOnly(t).m41)<.01)&&!e.getAnimations().some(a=>a.playState==='running');});
 const body=d.locator('.ant-drawer-body');assert(await body.evaluate(e=>e.scrollWidth<=e.clientWidth));
 if(scenario==='unknown'){assert((await d.locator('.consumer-reference-price').textContent()).includes('Not stated'));assert.equal(await d.locator('.consumer-product-code').textContent(),'No.00001');}
 if(scenario==='zero'){assert.equal(await d.locator('.consumer-reference-price strong').textContent(),'0.00');assert((await d.locator('.consumer-reference-heading').textContent()).includes('USD'));}
 if(scenario==='max'){assert.equal(await d.locator('.consumer-reference-price strong').textContent(),'999,999,999,998');assert(await d.locator('.consumer-product-code').evaluate(e=>e.getBoundingClientRect().height<=28.1));}
 await d.locator('.consumer-detail-info>.ant-btn').scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/synthetic-${scenario}-360.png`});results.push({scenario,result:'PASS'});await p.close();
}fs.writeFileSync(out+'/synthetic-results.json',JSON.stringify({data:'synthetic; not production facts',results},null,2));await b.close();console.log('PASS unknown, zero/currency and maximum fields');
