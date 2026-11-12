import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const output=fileURLToPath(new URL('../docs/reports/evidence/product-engagement/',import.meta.url));mkdirSync(output,{recursive:true});
const origin='http://127.0.0.1:4173',id=process.env.QA_PRODUCT;
assert(id==='engagement-qa-00');
const report={origin,data:'isolated PostgreSQL synthetic products and accounts, real APIs',checks:{},screenshots:[],console:[],network:[],geometry:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);
const page=await context.newPage();
const assetTasks=[],assetPaths=new Set(),assets=[];
function observe(p){p.on('pageerror',e=>report.console.push(e.message));p.on('console',m=>{if(m.type()==='error')report.console.push(m.text()+' '+m.location().url);});p.on('response',r=>{const url=new URL(r.url());if(r.status()>=400)report.network.push({url:url.pathname,status:r.status()});if(r.status()===200&&url.origin===origin&&/\.(js|css)$/.test(url.pathname)&&!assetPaths.has(url.pathname)){assetPaths.add(url.pathname);assetTasks.push((async()=>{try{const body=await r.body(),file=fileURLToPath(new URL('../frontend/dist'+url.pathname,import.meta.url));const actual=createHash('sha256').update(body).digest('hex'),expected=createHash('sha256').update(readFileSync(file)).digest('hex');assets.push({path:url.pathname,sha256:actual,expected,result:actual===expected?'PASS':'FAIL'});}catch(error){assets.push({path:url.pathname,result:'FAIL',reason:error.message});}})());}});}
observe(page);
const card=(p,product=id)=>p.locator('.compact-product-card[data-product-id="'+product+'"]');
async function value(product=id){const response=await context.request.get(origin+'/api/storefront/product-popularity/'+product);assert.equal(response.status(),200);return (await response.json()).data.clicks;}
async function ready(p=page){await p.locator('.compact-product-card').first().waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('.product-popularity')].slice(0,4).every(e=>!e.textContent.includes('…')));}
async function shot(name,locator){await (locator??page).screenshot({path:output+name+'.png',fullPage:!locator,animations:'disabled'});report.screenshots.push(name+'.png');}
async function order(p,label){await p.locator('.product-sort').first().selectOption({label});await ready(p);}
async function noOverflow(p=page){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function stableModal(p=page){await p.waitForFunction(()=>{const e=document.querySelector('.product-review-dialog');return e&&getComputedStyle(e).transform==='none'&&!e.className.includes('zoom');});}
async function geometry(name){
 const data=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  return [...document.querySelectorAll('.product-sort,.product-popularity,.product-review-editor .ant-rate')].map(e=>{
   const css=getComputedStyle(e),outer=rect(e),inner={left:outer.x+parseFloat(css.borderLeftWidth)+parseFloat(css.paddingLeft),right:outer.right-parseFloat(css.borderRightWidth)-parseFloat(css.paddingRight),top:outer.y+parseFloat(css.borderTopWidth)+parseFloat(css.paddingTop),bottom:outer.bottom-parseFloat(css.borderBottomWidth)-parseFloat(css.paddingBottom)};
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');const glyphs=[];
   const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()){const node=walker.currentNode;if(!node.textContent.trim()||node.parentElement?.closest('svg'))continue;const range=document.createRange();range.selectNodeContents(node);const r=range.getBoundingClientRect(),style=getComputedStyle(node.parentElement);ctx.font=style.font;const m=ctx.measureText(node.textContent);const baseline=r.y+(r.height-(m.fontBoundingBoxAscent+m.fontBoundingBoxDescent))/2+m.fontBoundingBoxAscent;glyphs.push({text:node.textContent.trim(),x:r.x-m.actualBoundingBoxLeft,y:baseline-m.actualBoundingBoxAscent,width:m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent});}
   return{control:e.className,outer,inner,glyphs,hotzones:[...e.querySelectorAll('[role=radio]')].map(radio=>({...rect(radio),icons:[...radio.querySelectorAll('.ant-rate-star-second svg path')].map(path=>{const box=path.getBBox(),matrix=path.getScreenCTM(),a=new DOMPoint(box.x,box.y).matrixTransform(matrix),b=new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);return{x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};})}))};
  });
 });const modal=await page.locator('.product-review-dialog').count()?await page.locator('.product-review-dialog').boundingBox():null;report.geometry.push({name,viewport:page.viewportSize(),modal,data});
}
try{
 console.log('UI_STAGE login');
 let session;
 for(const [username,stars] of [['engagement-qa',5],['engagement-qa-second',4]]){
  const login=await context.request.post(origin+'/api/auth/login',{data:{username,password:process.env.QA_PASSWORD}});assert.equal(login.status(),200);session=(await login.json()).data;
  const mine=await context.request.get(origin+'/api/product-reviews/'+id+'/mine',{headers:{Authorization:'Bearer '+session.accessToken}});assert.equal(mine.status(),200);const prior=(await mine.json()).data;
  const reset=await context.request.put(origin+'/api/product-reviews/'+id+'/mine',{headers:{Authorization:'Bearer '+session.accessToken},data:{stars,comment:'合成验收',version:prior.version}});assert.equal(reset.status(),200);
 }
 await context.addInitScript(session=>{if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token',session.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',session.accessTokenExpiresAt);localStorage.setItem('bobbuy_auth_user',JSON.stringify(session.user));},session);
 await page.goto(origin+'/products?node=98733001');await ready();await noOverflow();
 console.log('UI_STAGE sorting');
 await order(page,'Price: high to low (same currency)');await page.waitForFunction(()=>document.querySelector('.compact-product-card')?.getAttribute('data-product-id')==='engagement-qa-29');
 await order(page,'Price: low to high (same currency)');await page.waitForFunction(()=>document.querySelector('.compact-product-card')?.getAttribute('data-product-id')==='engagement-qa-00');
 const before=BigInt(await value());await card(page).locator('.product-photo').click();await page.locator('.ant-drawer:visible').waitFor();await page.locator('.ant-drawer:visible .ant-drawer-close').click();await page.waitForFunction(expected=>document.querySelector('.compact-product-card[data-product-id="engagement-qa-00"] .product-popularity')?.textContent.replaceAll(',','').includes(expected),String(before+1n));
 const peer=await context.newPage();observe(peer);await peer.goto(origin+'/products?node=98733001');await ready(peer);
 const next=BigInt(await value());await card(page).locator('.product-name').click();await page.locator('.ant-drawer:visible .ant-drawer-close').click();
 await peer.waitForFunction(expected=>document.querySelector('.compact-product-card[data-product-id="engagement-qa-00"] .product-popularity')?.textContent.replaceAll(',','').includes(expected),String(next+1n));
 assert.equal(BigInt(await value()),next+1n);report.checks.repeatedClicksAndCrossTabHeat='PASS';
 console.log('UI_STAGE rating');
 await page.goto(origin+'/recommendations?node=98733001');await ready();
 await order(page,'Popularity: high to low');await card(page).first().waitFor();
 const buttons=card(page).locator('.review-stars-button');await buttons.first().click();await page.getByRole('button',{name:'Read or write reviews',exact:true}).click();
 const dialog=page.locator('.product-review-dialog');await dialog.waitFor();const stars=dialog.locator('.product-review-editor .ant-rate');await stars.waitFor();await stableModal();assert.equal(await dialog.locator('input[type=number]').count(),0);
 await shot('stars-before-hover',dialog);
 const fourth=stars.locator('.ant-rate-star').nth(3);const fourthBox=await fourth.boundingBox();await fourth.hover({position:{x:fourthBox.width*.25,y:fourthBox.height/2}});
 await page.waitForFunction(()=>document.querySelectorAll('.product-review-editor .ant-rate-star-full').length===3);assert.equal(await stars.locator('.ant-rate-star-half').count(),1);await shot('stars-hover-desktop',dialog);await geometry('stars-hover-desktop');
 const fifth=stars.locator('.ant-rate-star').nth(4);const box=await fifth.boundingBox();await fifth.click({position:{x:box.width*.25,y:box.height/2}});await dialog.getByRole('button',{name:'Save your review',exact:true}).click();await dialog.getByText('Your review was saved',{exact:true}).waitFor();
 const minePath=origin+'/api/product-reviews/'+id+'/mine',auth={Authorization:'Bearer '+session.accessToken};
 const mine=(await (await context.request.get(minePath,{headers:auth})).json()).data;
 const invalid=await context.request.put(minePath,{headers:auth,data:{stars:4.5,comment:'长'.repeat(2001),version:mine.version}});assert.equal(invalid.status(),400);
 const comment=dialog.getByRole('textbox',{name:'Your review (optional)'});await comment.fill('');await comment.focus();await page.keyboard.insertText('长'.repeat(2001));assert.equal((await comment.inputValue()).length,2000);
 console.log('UI_STAGE long_review');
 await dialog.getByRole('button',{name:'Save your review',exact:true}).click();await dialog.getByText('Your review was saved',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.review-comments article p')?.textContent?.length===2000);
 await page.setViewportSize({width:320,height:800});await stableModal();await noOverflow();
 const scrolled=await comment.evaluate(e=>({scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,resize:getComputedStyle(e).resize,scrollbarWidth:e.offsetWidth-e.clientWidth-parseFloat(getComputedStyle(e).borderLeftWidth)-parseFloat(getComputedStyle(e).borderRightWidth)}));assert(scrolled.scrollHeight>scrolled.clientHeight);assert.equal(scrolled.resize,'none');assert(scrolled.scrollbarWidth>=6);
 await comment.hover();await page.mouse.wheel(0,-100000);await page.waitForFunction(()=>document.querySelector('.product-review-editor textarea')?.scrollTop===0);
 assert.equal(await comment.evaluate(e=>e.clientHeight),72);assert.equal(await comment.evaluate(e=>getComputedStyle(e).lineHeight),'24px');
 await shot('review-textarea-max-320',comment);await shot('stars-long-text-320',dialog);await geometry('stars-long-text-320');assert(await dialog.locator('.ant-modal-close').isVisible());
 await comment.hover();await page.mouse.wheel(0,100000);await page.waitForFunction(()=>{const e=document.querySelector('.product-review-editor textarea');return e&&e.scrollTop===e.scrollHeight-e.clientHeight;});
 assert.equal(await comment.evaluate(e=>e.scrollTop%24),0);await shot('review-textarea-max-end-320',comment);await comment.hover();await page.mouse.wheel(0,-100000);await page.waitForFunction(()=>document.querySelector('.product-review-editor textarea')?.scrollTop===0);
 report.checks.reviewScrollViewport={before:scrolled,after:await comment.evaluate(e=>e.scrollTop),result:'PASS: clipped initial line was an intentional native scrolled viewport; top view retains whole glyphs'};
 const savedLong=(await (await context.request.get(minePath,{headers:auth})).json()).data;assert.equal(savedLong.comment.length,2000);
 await comment.fill('合成验收');await dialog.getByRole('button',{name:'Save your review',exact:true}).click();await dialog.getByText('Your review was saved',{exact:true}).waitFor();await page.setViewportSize({width:1440,height:1000});await dialog.locator('.ant-modal-close').click();
 console.log('UI_STAGE normal_review_restored');
 report.checks.maximumReviewAndOverLimitNegative='PASS: 2000 characters persisted, 2001 rejected, native max length enforced, 320px dialog remains usable';
 await page.waitForFunction(()=>[...document.querySelectorAll('.compact-product-card[data-product-id="engagement-qa-00"] .review-stars-button')].every(e=>e.textContent.includes('4.8 / 5')));
 await peer.waitForFunction(()=>document.querySelector('.compact-product-card[data-product-id="engagement-qa-00"] .review-stars-button')?.textContent.includes('4.8 / 5'));
 report.checks.hoverClickStarSaveAverageAndCrossTabRating='PASS';
 // Each public occurrence of the same product uses one authoritative heat identity.
 assert((await card(page).count())>=2);
 const duplicateBefore=BigInt(await value());await card(page).first().locator('.product-photo').click();await page.locator('.ant-drawer:visible .ant-drawer-close').click();
 await page.waitForFunction(expected=>[...document.querySelectorAll('.compact-product-card[data-product-id="engagement-qa-00"] .product-popularity')].every(e=>e.textContent.replaceAll(',','').includes(expected)),String(duplicateBefore+1n));
 report.checks.samePageDuplicateCards='PASS';
 await page.reload();await ready();await card(page).first().waitFor();assert.equal(BigInt(await value()),duplicateBefore+1n);report.checks.reloadPersistence='PASS';
 // Use the Chinese locale for the final review artifacts.
 console.log('UI_STAGE screenshots');
 await page.evaluate(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
 // Later navigations keep the same real login, but switch this page's locale after init.
 for(const viewport of [{width:1440,height:1000},{width:768,height:1024},{width:320,height:800}]){
  await page.setViewportSize(viewport);await page.reload();await page.evaluate(()=>{localStorage.setItem('bobbuy_locale','zh-CN');window.dispatchEvent(new StorageEvent('storage',{key:'bobbuy_locale',newValue:'zh-CN'}));});
  await ready();await noOverflow();await shot('recommendations-'+viewport.width);await shot('recommendation-card-'+viewport.width,page.locator('.compact-product-card').first());await geometry('recommendations-'+viewport.width);
  await page.goto(origin+'/products?node=98733001');await ready();await noOverflow();await shot('products-'+viewport.width);await shot('product-card-'+viewport.width,page.locator('.compact-product-card').first());await geometry('products-'+viewport.width);
  await page.goto(origin+'/recommendations?node=98733001');await ready();
 }
 report.checks.desktopTabletNarrowMobileNoHorizontalOverflow='PASS';
 await card(page).first().locator('.review-stars-button').click();await page.locator('.review-distribution .ant-btn').click();await page.locator('.product-review-editor .ant-rate').waitFor();await stableModal();await noOverflow();await shot('stars-mobile-320',page.locator('.product-review-dialog'));await geometry('stars-mobile-320');await page.locator('.product-review-dialog .ant-modal-close').click();
 const anonymous=await browser.newContext({viewport:{width:320,height:800}});const anonPage=await anonymous.newPage();observe(anonPage);await anonPage.goto(origin+'/products?node=98733001');await ready(anonPage);await card(anonPage).first().locator('.review-stars-button').click();await anonPage.locator('.review-distribution .ant-btn').click();await anonPage.locator('.product-review-dialog a[href="/login"]').waitFor();assert.equal(await anonPage.locator('.product-review-editor .ant-rate').count(),0);await anonymous.close();report.checks.anonymousRequiresSignIn='PASS';
 assert.deepEqual(report.console,[]);assert.deepEqual(report.network,[]);report.checks.consoleAndNetwork='PASS';
}catch(error){report.failure=error.stack;await page.screenshot({path:output+'failure.png',fullPage:true});throw error;}
finally{console.log('UI_STAGE asset_binding');await Promise.all(assetTasks);report.assets=assets;const validAssets=assets.length>0&&assets.every(asset=>asset.result==='PASS');report.checks.loadedAssetHashes=validAssets?'PASS':'FAIL';writeFileSync(output+'browser.json',JSON.stringify(report,null,2));await browser.close();assert(validAssets,'Loaded browser assets must match the built candidate');}
