import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const out=fileURLToPath(new URL('.',import.meta.url)),base='http://127.0.0.1:5173';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext(),errors=[],network=[],geometry=[],screens=[],checks={},modules={};
const login=await ctx.request.post(base+'/api/auth/login',{data:{username:'agent',password:'agent-pass'}});assert.equal(login.status(),200);const session=(await login.json()).data;
const headers={Authorization:'Bearer '+session.accessToken,'Accept-Language':'en-US'};
await ctx.addInitScript(s=>{if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));localStorage.setItem('bobbuy_disable_chat_websocket','true');},session);
async function get(path){const r=await ctx.request.get(base+path,{headers});assert.equal(r.status(),200,path);return(await r.json()).data;}
const page=await ctx.newPage(),pending=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({method:r.request().method(),path,status:r.status()});if(r.status()>=200&&r.status()<300&&(path.includes('/src/pages/StockMaster')||path.includes('/src/pages/productRecords.css')))pending.push(r.body().then(b=>modules[path]=createHash('sha256').update(b).digest('hex')));});
async function shot(name,target='.manual-product-create .ant-drawer-content'){
 await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const g=await page.locator(target).evaluate(el=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...el.querySelectorAll('button,input:not([type=radio]):not([type=checkbox]):not(.ant-select-selection-search-input),.ant-select-selector,.ant-radio-button-wrapper')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute('aria-label')||e.id||e.textContent,width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,shadow:s.boxShadow};})}));assert(!g.overflow);if(target.startsWith('.manual-product-create'))for(const c of g.controls)assert(c.height>=44,name+' control: '+c.label);geometry.push({name,...g});await page.screenshot({path:out+name+'.png'});screens.push(name+'.png');
}
try{
 if(!process.argv.includes('--visual-only')){
 const x={requestId:randomUUID(),name:{'ja-JP':'合成再試行'},itemNumber:'SYNTHETIC-RETRY-'+randomUUID().slice(0,8),categoryNodeId:'家电数码'};
 const bad=await ctx.request.post(base+'/api/mobile/products',{headers,data:x});assert.equal(bad.status(),400);
 const anon=await browser.newContext();assert.equal((await anon.request.post(base+'/api/mobile/products',{data:x})).status(),401);await anon.close();
 x.categoryNodeId=null;const responses=await Promise.all([1,2].map(()=>ctx.request.post(base+'/api/mobile/products',{headers,data:x})));for(const r of responses)assert.equal(r.status(),200);const a=(await responses[0].json()).data.product,b=(await responses[1].json()).data.product;assert.equal(a.id,b.id);assert.equal(a.visibilityStatus,'DRAFTER_ONLY');assert.equal(a.categoryId,null);
 assert.equal((await get('/api/category-tree/products/'+a.id)).categoryNodeId,null);checks.realPgRollbackRetryConcurrent={result:'PASS',id:a.id};
 assert.equal((await ctx.request.post(base+'/api/mobile/products',{headers,data:{...x,requestId:randomUUID()}})).status(),400);
 const id=JSON.parse(readFileSync(out+'browser.json','utf8')).checks.createdId;
 const anonymous=await browser.newContext();assert.deepEqual((await(await anonymous.request.get(base+'/api/storefront/product-sales?productIds='+id)).json()).data,[]);
 let sheet=await get('/api/merchant/product-pricing/'+id);
 if(!sheet.regular){const regular=await ctx.request.put(base+'/api/merchant/product-pricing/'+id+'/regular',{headers,data:{amount:2998,currency:'JPY',unit:'box',revision:0,replaceExisting:false,enabled:true,confirmed:true,reason:'Synthetic manual creation acceptance'}});assert.equal(regular.status(),200,await regular.text());}
 sheet=await get('/api/merchant/product-pricing/'+id);assert.equal(sheet.regular.amount,2998);assert.equal(sheet.visibility,'DRAFTER_ONLY');assert.deepEqual((await(await anonymous.request.get(base+'/api/storefront/product-sales?productIds='+id)).json()).data,[]);
 // Existing explicit product publication route; no new purchase authorization rules.
 const published=await ctx.request.patch(base+'/api/mobile/products/'+id,{headers,data:{visibilityStatus:'PUBLIC'}});assert.equal(published.status(),200);
 const publicPrices=(await(await anonymous.request.get(base+'/api/storefront/product-sales?productIds='+id)).json()).data;assert.equal(publicPrices.length,1);checks.existingPriceAndPublication={result:'PASS',id,price:{amount:publicPrices[0].price,currency:publicPrices[0].currency,unit:publicPrices[0].saleUnit}};await anonymous.close();
 writeFileSync(out+'integration.json',JSON.stringify({runtime:'PostgreSQL 18.6 with V46, real HTTP; only synthetic products',checks},null,2)+'\n');
 }
 await page.goto(base+'/admin/products');await page.getByTestId('stock-master-add-row').waitFor();
 for(const locale of ['en-US','ja-JP','zh-CN','zh-TW']){
  await page.evaluate(locale=>localStorage.setItem('bobbuy_locale',locale),locale);await page.reload();await page.getByTestId('stock-master-add-row').click();await page.locator('.manual-product-create').waitFor();
  for(const width of [1280,390]){await page.setViewportSize({width,height:width===390?844:800});await page.locator('.manual-product-create .ant-drawer-body').evaluate(el=>el.scrollTop=0);await shot('new-'+locale+'-'+width);}
  await page.locator('.manual-product-create .ant-drawer-close').click();await page.locator('.manual-product-create').waitFor({state:'hidden'});
 }
 const existingId=JSON.parse(readFileSync(out+'browser.json','utf8')).checks.createdId;await page.evaluate(()=>localStorage.setItem('bobbuy_locale','en-US'));await page.goto(base+'/admin/products?product='+existingId);await page.locator('.catalog-editor .ant-drawer-content').waitFor();for(const width of [1280,390]){await page.setViewportSize({width,height:width===390?844:800});await shot('saved-editor-'+width,'.catalog-editor .ant-drawer-content');}
 assert.deepEqual(errors,[]);assert.equal(network.filter(x=>x.path.startsWith('/api/ai/')&&x.method!=='GET').length,0);assert.equal(network.filter(x=>x.status>=400).length,0);
 await Promise.all(pending);writeFileSync(out+'visual.json',JSON.stringify({result:'PASS',errors,network,geometry,screens,loadedFrontendModules:modules},null,2)+'\n');console.log('MANUAL_CREATE_FINISH_PASS');
}finally{await browser.close();}
