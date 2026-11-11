import {chromium} from '@playwright/test';import fs from 'node:fs';import assert from 'node:assert/strict';
const out='../docs/reports/evidence/card-price-name-20261111';const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:390,height:1200}});
await page.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))failed.push(r.url());});
await page.goto('https://bobuy.cc/products');await page.locator('.compact-product-card').first().waitFor();await page.waitForTimeout(1500);
await page.screenshot({path:out+'/production-products-390.png'});
const data=await (await page.request.get('https://bobuy.cc/api/storefront/product-browse?locale=zh-CN')).json();assert.equal(data.status,'success');let discounts=0;
for(const item of data.data.items){if(item.reference&&item.reference.originalPrice>item.reference.amount){discounts++;assert(item.reference.itemId);assert(item.reference.postId);}}
assert(discounts>0);assert(await page.locator('.compact-card-discount del').count()>0);
const first=page.locator('.compact-product-card').first();await first.locator('.product-name').click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
fs.writeFileSync(out+'/production-catalog.json',JSON.stringify({result:'PASS',cards:data.data.items.length,sourceBoundDiscounts:discounts,errors,failed},null,2));await browser.close();console.log('PASS production catalog sources and interaction');
