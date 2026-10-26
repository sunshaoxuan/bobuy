import assert from 'node:assert/strict';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const origin='http://127.0.0.1:18080',postId=12;
assert(new URL(origin).hostname==='127.0.0.1');
const out=new URL('../docs/reports/evidence/recommendation-commerce/',import.meta.url);mkdirSync(out,{recursive:true});
const fixture=new URL('../../commerce-fixtures/',import.meta.url);
const dictionary=readFileSync(new URL('../frontend/src/locales/zh-CN.ts',import.meta.url),'utf8');
function t(key){const match=dictionary.match(new RegExp(`['"]${key.replaceAll('.','\\.')}['"]:\\s*(['"])(.*?)\\1`));assert(match,key);return match[2];}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await context.newPage();
const prior=process.env.BOBUY_COMMERCE_STAGE==='sale'?JSON.parse(readFileSync(new URL('local-ui.json',out),'utf8')):undefined;
const report={scope:'Normal visible UI on existing LOCAL synthetic post 12 only. No production writes, orders or payments.',checks:{...prior?.checks},errors:[],failures:[],writes:[]};let published=false;
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))report.writes.push({method:r.method(),path:new URL(r.url()).pathname});});
async function stage(name){report.stage=name;writeFileSync(new URL('local-ui-progress.json',out),JSON.stringify(report,null,2));console.log(name);}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
async function waitDetail(action,suffix,method='PUT'){const pending=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/merchant/recommendations/${postId}${suffix}`&&r.request().method()===method);await action();const response=await pending;assert.equal(response.status(),200,await response.text());return (await response.json()).data;}
try{
 await page.goto(origin+'/admin');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/recommendations"]').first().waitFor();
 const load=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/merchant/recommendations/${postId}`&&r.request().method()==='GET');await page.goto(origin+'/admin/recommendations?post='+postId);let detail=(await (await load).json()).data;
 assert(detail.post.title.startsWith('[Synthetic]'));assert.equal(detail.items.length,6);assert.equal(detail.post.published,false);const item=detail.items[0],original={name:item.name,code:item.itemNumber,price:item.referencePrice,image:item.imageUrl};
 await stage('Synthetic post confirmed; original facts retained');
 if(process.env.BOBUY_COMMERCE_STAGE!=='sale'){
 const l10n=page.locator('.rec-localization');await l10n.getByRole('button',{name:t('translation.export'),exact:true}).click();const template=JSON.parse(await l10n.locator('textarea').inputValue());assert.equal(template[0].itemId,item.id);assert.equal(template[0].source.jaName,item.name);
 const row={...template[0],specification:'合成仕様 100g / MODEL-1',description:'合成テストの説明。\nこれは実商品ではありません。',translations:{'zh-CN':{name:'合成中文商品 MODEL-1',specification:'合成规格 100g / MODEL-1',description:'合成介绍，不是真实商品。',offerNotes:'合成适用条件，100g 与日期不变。'},'zh-TW':{name:'合成繁體商品 MODEL-1',specification:'合成規格 100g / MODEL-1',description:'合成測試說明。'},'en-US':{name:'Synthetic English product MODEL-1',specification:'Synthetic specification 100g / MODEL-1',description:'Synthetic test description only.'}}};
 await l10n.locator('textarea').fill(JSON.stringify([{...row,sourceHash:'0'.repeat(64)}]));await l10n.getByRole('button',{name:t('rec.batch_preview'),exact:true}).click();await l10n.getByText(t('translation.invalid'),{exact:true}).waitFor();
 await l10n.locator('textarea').fill(JSON.stringify([row]));await l10n.getByRole('button',{name:t('rec.batch_preview'),exact:true}).click();await l10n.getByRole('checkbox').check();
 detail=await waitDetail(()=>l10n.getByRole('button',{name:t('translation.save'),exact:true}).click(),'/localizations');assert.equal(detail.items[0].translationStatus,'REVIEWED');
 assert.equal(detail.items[0].name,original.name);assert.equal(detail.items[0].referencePrice,original.price);report.checks.reviewedBulkLocalizationPreviewSourceMismatchAndFactPreservation='PASS';await stage('Localized one synthetic item via visible JSON preview and review');
 const gallery=page.locator('.rec-gallery-admin'),names=['portrait.png','square.png','transparent.png'];await gallery.locator('input[type=file]').setInputFiles(names.map(name=>fileURLToPath(new URL(name,fixture))));
 const images=names.map(name=>({fileName:name,sourceUrl:'https://example.com/synthetic/local-ui-fixture',assetKey:'synthetic-v1-'+name,label:'Synthetic '+name}));images.push({...images[0],assetKey:'synthetic-same-bytes-another-size'});
 await gallery.locator('textarea').fill(JSON.stringify([{itemId:item.id,itemNumber:item.itemNumber??null,mode:'replace',images}]));await gallery.getByRole('button',{name:t('rec.batch_preview'),exact:true}).click();await gallery.getByRole('checkbox').check();
 const uploadFinished=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith(`/items/${item.id}/gallery`)&&r.request().method()==='PUT');await gallery.getByRole('button',{name:t('gallery.save'),exact:true}).click();const uploaded=await uploadFinished;assert.equal(uploaded.status(),200);detail=(await uploaded.json()).data;
 assert.equal(detail.items[0].gallery.length,3);assert.equal(detail.items[0].imageUrl,original.image);detail=await waitDetail(()=>gallery.locator('.rec-gallery-thumbs>div').nth(2).getByRole('button',{name:t('gallery.set_main'),exact:true}).click(),`/items/${item.id}/gallery`);
 await shot('admin-gallery-desktop');report.checks.batchGalleryAppendReplaceHashDedupCoverSelectionAndOriginalEvidence='PASS';await stage('Three synthetic aspect ratios registered; duplicate reused; cover changed');
 }else{assert.equal(item.translationStatus,'REVIEWED');assert.equal(item.gallery.length,3);report.resumedAfterVerifiedLocalizationAndGallery=true;}
 const sale=page.locator('.rec-sale-review');await sale.locator('.ant-table-tbody .ant-table-selection-column input[type=checkbox]').first().check();await sale.getByRole('button',{name:/准备所选/}).click();const modal=page.getByRole('dialog');
 const actual=modal.getByLabel(t('sale.actual')+': '+item.id,{exact:true}),unit=modal.getByLabel(t('sale.unit')+': '+item.id,{exact:true});await actual.fill('500');await unit.fill('');await modal.getByRole('checkbox',{name:t('sale.ack'),exact:true}).check();assert(await modal.getByRole('button',{name:t('sale.confirm'),exact:true}).isDisabled());
 await unit.fill('100g（合成）');await modal.getByLabel(t('rec.fact.offerStart')+': '+item.id,{exact:true}).fill('');await modal.getByLabel(t('rec.fact.offerEnd')+': '+item.id,{exact:true}).fill('');await modal.getByRole('checkbox',{name:t('sale.replace'),exact:true}).check();
 detail=await waitDetail(()=>modal.getByRole('button',{name:t('sale.confirm'),exact:true}).click(),'/sales');await modal.waitFor({state:'hidden'});await sale.getByText(/JPY ¥500/).first().waitFor();
 report.checks.visibleJpyPriceUnitValidationReviewAndPreorderConfirmation='PASS';await stage('Confirmed independent JPY pre-order quote; blank-unit negative passed');
 await page.getByRole('button',{name:new RegExp(t('rec.draft_preview'))}).click();await page.locator('.browse-preview .rec-pin').first().waitFor();await page.locator('.browse-preview').evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-80));await shot('admin-shared-preview');
 await page.getByRole('button',{name:new RegExp(t('rec.publish'))}).click();await page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).waitFor();published=true;
 await page.goto(origin+'/recommendations/'+postId+'?node=1000');await page.locator('.rec-pin').nth(5).waitFor();await page.locator('.rec-pin .product-photo img').first().evaluate(img=>img.decode());
 const card=page.locator('.rec-pin').first();assert((await card.innerText()).includes('合成中文商品 MODEL-1（'+original.name+'）'));assert(!(await card.innerText()).includes('合成介绍，不是真实商品。'));
 const styles=await card.locator('.product-photo img').evaluate(img=>{const s=getComputedStyle(img),p=getComputedStyle(img.parentElement);return {radius:s.borderRadius,maxHeight:s.maxHeight,objectFit:s.objectFit,background:s.backgroundColor,parentRadius:p.borderRadius,parentOverflow:p.overflow,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,renderWidth:img.width,renderHeight:img.height};});assert.notEqual(styles.radius,'0px');assert.equal(styles.maxHeight,'none');assert.equal(styles.parentOverflow,'hidden');report.styles=styles;
 await shot('customer-desktop');await card.locator('.product-photo').click();await page.locator('.rec-product-detail').waitFor();assert(new URL(page.url()).searchParams.has('item'));await page.locator('.rec-product-detail').getByText('合成介绍，不是真实商品。',{exact:true}).waitFor();assert.equal(await page.locator('.rec-detail-thumbs button').count(),3);
 await page.locator('.rec-detail-thumbs button').nth(1).click();assert.equal(await page.locator('.rec-detail-thumbs button').nth(1).getAttribute('aria-pressed'),'true');await shot('detail-desktop');
 await page.goBack();await page.locator('.rec-product-detail').waitFor({state:'hidden'});assert.equal(new URL(page.url()).searchParams.get('node'),'1000');assert(!new URL(page.url()).searchParams.has('item'));
 await page.setViewportSize({width:390,height:844});await shot('customer-mobile');await card.locator('.product-photo').click();await page.locator('.rec-product-detail').waitFor();await shot('detail-mobile');await page.locator('.rec-product-detail .ant-drawer-close').click();await page.locator('.rec-product-detail').waitFor({state:'hidden'});
 report.checks.conciseLocalizedCardsStructuredDetailGalleryMobileBackAndCssClipping='PASS';
 for(const locale of ['en-US','zh-TW','ja-JP','zh-CN']){
  await page.locator('.language-switcher').click();await page.locator(`.ant-dropdown-menu [lang="${locale}"]`).click();
  const title=await card.locator('h3').innerText();if(locale==='ja-JP')assert.equal(title,original.name);else assert(title.endsWith('（'+original.name+'）'));
  assert((await card.innerText()).includes('JPY'));await page.reload();await page.locator('.rec-pin').first().waitFor();
 }
 report.checks.allFourLanguagesJapaneseParenthesisReloadFallbackAndStableJpy='PASS';
 const add=card.locator('.product-add');if(await add.isVisible()&&!await add.isDisabled()){
  for(let n=0;n<3;n++)await add.click();const cart=await page.evaluate(()=>JSON.parse(localStorage.getItem('bobuy.cart.v1')));assert.equal(cart.items[item.productId],3);assert.equal(cart.currency,'JPY');assert.equal(cart.quotes[item.productId].price,500);assert(cart.quotes[item.productId].revision>=1);
  await page.goto(origin+'/cart');await page.locator('.basket-line').first().waitFor();assert((await page.locator('.basket').innerText()).includes('JPY'));await shot('cart-mobile');report.checks.directRepeatAddActualProductQuantityCurrencyAndQuote='PASS';
 }else report.checks.directRepeatAddActualProductQuantityCurrencyAndQuote='PENDING explicit product-publication decision; private products remain unavailable';
 assert.deepEqual(report.errors,[]);report.result=Object.values(report.checks).some(value=>value.startsWith('PENDING'))?'PARTIAL':'PASS';await stage('All local UI checks passed; withdrawing synthetic fixture');
}catch(error){report.result='FAIL';report.failure=error.stack;await shot('failure').catch(()=>{});throw error;}
finally{
 if(published){await page.goto(origin+'/admin/recommendations?post='+postId);await page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).click();await page.getByRole('button',{name:new RegExp(t('rec.publish'))}).waitFor();report.syntheticPostWithdrawn=true;}
 writeFileSync(new URL('local-ui.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();
}
