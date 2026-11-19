import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[],network=[],consoleErrors=[];
 await ctx.addInitScript(()=>{localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_disable_chat_websocket','true');});
 await page.route('**/api/storefront/category-icons',r=>r.fulfill({status:404,body:''}));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({path:new URL(r.url()).pathname,status:r.status()});});
 await page.goto('http://127.0.0.1:5175/products?node=1000',{waitUntil:'domcontentloaded'});
 await page.locator('.catalog-master-card').first().waitFor();await page.locator('.category-shortcuts img').first().evaluate(i=>i.decode());
 assert.equal(await page.locator('[data-shelf-category="shop-000-progressive-01"] .catalog-master-card').count(),8);assert.equal(await page.locator('.category-shortcuts a').count(),24);assert.deepEqual(errors,[]);
 assert.deepEqual(network.filter(n=>n.status>=400),[{path:'/api/storefront/category-icons',status:404}]);
 writeFileSync(new URL('hint-fallback.json',import.meta.url),JSON.stringify({result:'PASS',scenario:'Optional endpoint absent (old backend): overview supplies real icon and first eight cards',errors,consoleErrors,network},null,2)+'\n');await ctx.close();console.log('PASS missing hint endpoint');
}finally{await browser.close();}
