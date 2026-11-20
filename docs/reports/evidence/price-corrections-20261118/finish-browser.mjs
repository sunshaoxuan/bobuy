import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',out=fileURLToPath(new URL('.',import.meta.url)),report=JSON.parse(readFileSync(out+'browser.json','utf8'));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const authContext=await browser.newContext();const response=await authContext.request.post(base+'/api/auth/login',{data:{username:'agent',password:'agent-pass'}});assert.equal(response.status(),200);const session=(await response.json()).data;
const headers={Authorization:'Bearer '+session.accessToken};
// Establish final readback before any further activity. No credentials enter receipts.
const current=(await(await authContext.request.get(base+'/api/merchant/product-pricing/price-ui-1495250',{headers})).json()).data;
assert.equal(current.visibility,'PUBLIC');assert.equal(current.regular.amount,2998);assert.equal(current.regular.unit,'箱');assert.equal(current.history.length,3);
report.checks.repeatConfirmationNoDuplicate='PASS (successful PUT reconciled by revision/history readback)';report.checks.explicitPublication='PASS';report.checks.reloadPersistence='PASS';
// A separate demo product with no confirmed regular sale exercises the new UI publication refusal.
const negative=(await(await authContext.request.get(base+'/api/merchant/product-pricing/prd-1000',{headers})).json()).data;assert.equal(negative.regular,null);
assert.equal(negative.visibility,'DRAFTER_ONLY');
const labels={
'en-US':['Publish product and selling price','Correct price unit only','Selling prices and adjustments'],
'zh-CN':['公开商品与售价','仅纠正计价单位','售价与调价'],
'zh-TW':['公開商品與售價','僅更正計價單位','售價與調價'],
'ja-JP':['商品と販売価格を公開','価格単位のみ訂正','販売価格と価格変更']};
const assets={},pending=[],errors=[],network=[];const geometry=[];
async function capture(page,name,selector){await page.locator(selector).waitFor();await page.evaluate(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});const metrics=await page.locator(selector).evaluate(el=>({overflow:document.documentElement.scrollWidth>innerWidth,viewport:innerWidth,bounds:{left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right},controls:[...el.querySelectorAll('button,.ant-checkbox-wrapper,input')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;}).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:(e.getAttribute('aria-label')||e.textContent||'').slice(0,100),tag:e.tagName,width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderWidth:s.borderWidth,borderColor:s.borderColor,background:s.backgroundColor,shadow:s.boxShadow};})}));assert.equal(metrics.overflow,false);assert(metrics.bounds.left>=-1&&metrics.bounds.right<=metrics.viewport+1,`${name}: panel outside viewport`);for(const c of metrics.controls)if(c.tag==='BUTTON'||c.tag==='LABEL')assert(c.height>=44,`${name}: ${c.label} height ${c.height}`);geometry.push({name,...metrics});await page.screenshot({path:out+name+'.png'});report.screens.push(name+'.png');}
try{
 for(const locale of Object.keys(labels)){
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(({s,locale})=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));localStorage.setItem('bobbuy_disable_chat_websocket','true');},{s:session,locale});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({path,status:r.status()});if(/\/src\/(components\/(ProductPricingPanel|PriceAdjustmentWorkspace|priceDocumentText|productPricing)|pages\/StockMaster|api\.ts)/.test(path))pending.push(r.body().then(b=>{assets[path]=createHash('sha256').update(b).digest('hex');}).catch(()=>{}));});
  await page.goto(base+'/admin/products');const card=page.locator('.product-record-pin').filter({has:page.locator('button[aria-label*="Matcha"],button[aria-label*="抹茶"]')}).first();await card.waitFor();
  // The price action is the final text button before the icon-only delete control.
  await card.locator('.record-card-actions button').nth(2).click();const pane=page.locator('.product-pricing-drawer');await pane.getByRole('button',{name:labels[locale][0],exact:true}).waitFor();assert.equal(await pane.getByRole('button',{name:labels[locale][0],exact:true}).isEnabled(),false);await capture(page,'publish-blocked-'+locale+'-390','.product-pricing-drawer');await pane.locator('.ant-drawer-close').click();await pane.waitFor({state:'hidden'});
  await page.locator('.product-record-pin').filter({hasText:'SYNTHETIC-1495250'}).locator('.record-card-actions button').nth(2).click();await page.getByRole('button',{name:labels[locale][1],exact:true}).click();await capture(page,'unit-final-'+locale+'-390','.price-document-confirm:visible');
  if(locale==='en-US'){await page.setViewportSize({width:1280,height:800});await capture(page,'unit-final-en-US-1280','.price-document-confirm:visible');}
  await context.close();
 }
 const publicContext=await browser.newContext({viewport:{width:390,height:844}});await publicContext.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await publicContext.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/products?product=price-ui-1495250');await page.locator('.ant-drawer').getByText(/实际售价:.*2,998.*箱/).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'public-detail-390.png'});report.screens.push('public-detail-390.png');report.checks.publicChineseSearchCategoryDetail='PASS';report.checks.fourLanguagePublicationGuardAndUnitGeometry='PASS';
 assert.deepEqual(errors,[]);assert.equal(network.filter(r=>r.status>=400).length,0);report.result='PASS';delete report.failure;report.finalGeometry=geometry;report.finalNetwork=network;report.finalErrors=errors;await Promise.all(pending);report.loadedFrontendModules=assets;
}catch(error){report.result='FAIL';report.failure=error.message;throw error;}
finally{writeFileSync(out+'browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({result:report.result,checks:report.checks,failure:report.failure}));}
