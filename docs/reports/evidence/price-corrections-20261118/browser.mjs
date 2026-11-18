import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const base='http://127.0.0.1:5173',product='price-ui-1495250';
assert.equal(new URL(base).hostname,'127.0.0.1');
const out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:800}});
// Public demo fixture identity only. Session credentials stay in memory and are never written to evidence.
const auth=await context.request.post(base+'/api/auth/login',{data:{username:'agent',password:'agent-pass'}});assert.equal(auth.status(),200);
const session=(await auth.json()).data;
await context.addInitScript(s=>{localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));localStorage.setItem('bobbuy_disable_chat_websocket','true');},session);
const page=await context.newPage();
const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))network.push({method:r.request().method(),path:new URL(r.url()).pathname,status:r.status()});});
await page.goto(base+'/admin/products');await page.getByText('Synthetic coconut water 1L × 9',{exact:true}).first().waitFor();
if(process.argv.includes('--inspect')){console.log(JSON.stringify({buttons:await page.getByRole('button').allTextContents(),names:await page.locator('button[aria-label]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),text:(await page.locator('body').innerText()).slice(-4000)}));await page.screenshot({path:out+'initial.png'});await browser.close();process.exit();}
const previous=process.argv.includes('--resume')?JSON.parse(readFileSync(out+'browser.json','utf8')):{};
const report={runtime:'real Spring Boot/H2 memory + Vite; synthetic fixture only',baseCommit:'dcbfbbb',checks:previous.checks??{},screens:previous.screens??[],geometry:previous.geometry??[],errors,network};
async function data(path){const r=await context.request.get(base+path,{headers:{Authorization:'Bearer '+session.accessToken}});assert.equal(r.status(),200,path);return (await r.json()).data;}
async function sheet(){return data('/api/merchant/product-pricing/'+product);}
async function shot(name,target='.product-pricing-drawer'){
 await page.locator(target+':visible').first().waitFor({state:'visible'});await page.waitForTimeout(250);
 const info=await page.locator(target+':visible').first().evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth,controls:[...el.querySelectorAll('button,input,.ant-checkbox-wrapper')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {text:(e.getAttribute('aria-label')||e.textContent||'').slice(0,90),width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,shadow:s.boxShadow};})}));
 report.geometry.push({name,...info});assert.equal(info.overflow,false,name+' horizontal overflow');await page.screenshot({path:out+name+'.png'});report.screens.push(name+'.png');
}
async function both(name,target){for(const viewport of [{width:1280,height:800},{width:390,height:844}]){await page.setViewportSize(viewport);await shot(name+'-'+viewport.width,target);}await page.setViewportSize({width:1280,height:800});}
try{
 const initial=await sheet();assert.equal(initial.effective.amount,2998);
 if(!report.checks.repeatConfirmationNoDuplicate&&previous.network?.some(r=>r.method==='PUT'&&r.path.endsWith('/regular')&&r.status===200)){assert.equal(initial.history.length,3);assert.equal(initial.regular.revision,3);report.checks.repeatConfirmationNoDuplicate='PASS (readback reconciled after listener race)';}

 if(!report.checks.privatePriceNotDisclosed){assert.equal(initial.visibility,'DRAFTER_ONLY');
 const anon=await browser.newContext();const price=await anon.request.get(base+'/api/storefront/product-sales?productIds='+product);assert.deepEqual((await price.json()).data,[]);await anon.close();report.checks.privatePriceNotDisclosed='PASS';}
 await page.locator('.product-record-pin').filter({hasText:'SYNTHETIC-1495250'}).getByRole('button',{name:'Selling prices and adjustments',exact:true}).click();if(initial.visibility==='DRAFTER_ONLY')await page.getByText(/The confirmed price is internal/).waitFor();
 let modal,current;
 if(!report.checks.cancelDuplicateAndReadBack){
 await page.locator('.price-document-record').filter({hasText:'PC-SYNTHETIC-SECOND'}).getByRole('button',{name:'Cancel document',exact:true}).click();
 modal=page.getByRole('dialog',{name:'Cancel document',exact:true});await modal.getByText(/Current resolved price after cancellation/).waitFor();await both('cancel-preview','.price-document-confirm');
 await modal.getByLabel('Cancellation reason (required)').fill('Synthetic duplicate regular confirmation withdrawn');await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'OK',exact:true}).click();await modal.waitFor({state:'hidden'});
 current=await sheet();assert.equal(current.effective.amount,2998);assert.equal(current.regular.amount,2998);assert.equal(current.history.find(r=>r.value.documentNumber==='PC-SYNTHETIC-SECOND').state,'CANCELLED');report.checks.cancelDuplicateAndReadBack='PASS';}
 if(!report.checks.unitCorrectionRetainsHistory){
 await page.getByRole('button',{name:'Correct price unit only',exact:true}).click();modal=page.getByRole('dialog',{name:'Correct price unit only',exact:true});await modal.getByLabel('Correct price unit',{exact:true}).fill('箱');await modal.getByLabel('Unit correction reason (required)').fill('Synthetic carton unit corrected; amount and currency unchanged');await modal.getByRole('checkbox').check();await both('unit-correction','.price-document-confirm');await modal.getByRole('button',{name:'OK',exact:true}).click();await modal.waitFor({state:'hidden'});
 current=await sheet();assert.equal(current.regular.unit,'箱');assert.equal(current.effective.amount,2998);assert(current.history.some(r=>r.value.evidence.unitCorrectionOf));report.checks.unitCorrectionRetainsHistory='PASS';}
 const count=(await sheet()).history.length;
 if(!report.checks.repeatConfirmationNoDuplicate){
 await page.getByText('Set regular selling price',{exact:true}).click();await page.getByLabel('Regular price change reason (required)').fill('Synthetic repeat confirmation without business changes');await page.getByRole('checkbox',{name:'I reviewed the products, prices, period and reason',exact:true}).check();await Promise.all([page.waitForResponse(r=>r.url().endsWith('/regular')&&r.request().method()==='PUT'),page.getByRole('button',{name:'Confirm regular price',exact:true}).click()]);assert.equal((await sheet()).history.length,count);report.checks.repeatConfirmationNoDuplicate='PASS';}
 if(!report.checks.explicitPublication){
 await page.getByRole('button',{name:'Publish product and selling price',exact:true}).click();modal=page.getByRole('dialog',{name:'Publish product and selling price',exact:true});await both('publish-confirmation','.price-document-confirm');await modal.getByRole('checkbox').check();await modal.getByRole('button',{name:'OK',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal((await sheet()).visibility,'PUBLIC');report.checks.explicitPublication='PASS';}
 await page.reload();await page.locator('.product-record-pin').filter({hasText:'SYNTHETIC-1495250'}).getByRole('button',{name:'Selling prices and adjustments',exact:true}).click();current=await sheet();assert.equal(current.regular.unit,'箱');assert.equal(current.visibility,'PUBLIC');report.checks.reloadPersistence='PASS';
 const customer=await browser.newContext({viewport:{width:1280,height:800}});await customer.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const pub=await customer.newPage();pub.on('pageerror',e=>errors.push(e.message));
 const sales=await customer.request.get(base+'/api/storefront/product-sales?productIds='+product);const quote=(await sales.json()).data;assert.equal(quote[0].price,2998);assert.equal(quote[0].saleUnit,'箱');
 const result=await customer.request.get(base+'/api/storefront/product-browse?query='+encodeURIComponent('合成椰子水')+'&locale=zh-CN');const browse=(await result.json()).data;assert.equal(browse.items.length,1);assert.equal(browse.items[0].productId,product);const category=browse.items[0].categories[0]?.id;
 report.public={quote:{price:quote[0].price,unit:quote[0].saleUnit},matched:browse.matchedTotal,category};
 for(const width of [1280,390]){await pub.setViewportSize({width,height:width===390?844:800});for(const [kind,query] of [['search','query='+encodeURIComponent('合成椰子水')],['category','category='+encodeURIComponent(category??'')]]){await pub.goto(base+'/products?'+query);await pub.getByText('2,998',{exact:true}).first().waitFor();assert.equal(await pub.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const file=`public-${kind}-${width}.png`;await pub.screenshot({path:out+file});report.screens.push(file);}}
 await pub.goto(base+'/products?product='+product);await pub.locator('.ant-drawer').getByText(/实际售价:.*2,998.*箱/).waitFor();await pub.screenshot({path:out+'public-detail-390.png'});report.screens.push('public-detail-390.png');report.checks.publicChineseSearchCategoryDetail='PASS';await customer.close();
 assert.deepEqual(errors,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.message;await page.screenshot({path:out+'failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync(out+'browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({result:report.result,checks:report.checks,failure:report.failure}));}
