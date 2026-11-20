import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:800}});
const auth=await context.request.post(base+'/api/auth/login',{data:{username:'agent',password:'agent-pass'}});assert.equal(auth.status(),200);
const session=(await auth.json()).data,headers={Authorization:'Bearer '+session.accessToken,'Accept-Language':'en-US'};
await context.addInitScript(s=>{localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));localStorage.setItem('bobbuy_disable_chat_websocket','true');},session);
const page=await context.newPage(),errors=[],network=[],geometry=[],screens=[],checks={};
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({method:r.request().method(),path,status:r.status()});});
async function data(path){const r=await context.request.get(base+path,{headers});assert.equal(r.status(),200,path);return(await r.json()).data;}
async function shot(name){await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const info=await page.locator('.ant-drawer-content:visible').last().evaluate(el=>({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,controls:[...el.querySelectorAll('button,input,.ant-select-selector')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {label:e.getAttribute('aria-label')||e.getAttribute('id')||e.textContent,width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,border:s.borderWidth,borderColor:s.borderColor,background:s.backgroundColor,shadow:s.boxShadow};})}));assert(!info.overflow);geometry.push({name,...info});await page.screenshot({path:out+name+'.png'});screens.push(name+'.png');}
try{
 await page.goto(base+'/admin/products');await page.getByTestId('stock-master-add-row').waitFor();await page.getByTestId('stock-master-add-row').click();
 const drawer=page.locator('.manual-product-create');await drawer.waitFor();
 if(process.argv.includes('--inspect')){await shot('initial');console.log((await drawer.innerText()).slice(0,2400));process.exitCode=0;}
 else {
 const form=drawer.locator('form');const name=form.locator('.ant-form-item').filter({has:page.locator('label[for="nameL10n"]')});
 for(const [locale,text] of [['zh-CN','合成手动商品'],['ja-JP','合成手入力商品'],['en-US','Synthetic manual product']]){await name.getByRole('button',{name:locale,exact:true}).click();await name.getByRole('textbox').fill(text);}
 const sku='SYNTHETIC-MANUAL-'+randomUUID().slice(0,8);await form.locator('#sku').fill(sku);await form.locator('#brand').fill('Synthetic brand');
 await drawer.getByRole('combobox',{name:'Product category path'}).click();await page.getByText('Synthetic manual entry',{exact:true}).click();
 for(const field of ['specificationL10n','descriptionL10n']){const section=form.locator('.ant-form-item').filter({has:page.locator('label[for="'+field+'"]')});for(const [locale,text] of [['zh-CN',field==='specificationL10n'?'2件':'中文说明'],['ja-JP',field==='specificationL10n'?'2個':'日本語説明'],['en-US',field==='specificationL10n'?'2 pieces':'English description']]){await section.getByRole('button',{name:locale,exact:true}).click();await section.getByRole('textbox').fill(text);}}
 await form.locator('#dynamicAttributes_netContent').fill('1L');await form.locator('#dynamicAttributes_packSize').fill('2');
 await drawer.locator('.ant-drawer-body').evaluate(e=>e.scrollTop=0);await shot('filled-1280');await page.setViewportSize({width:390,height:844});await drawer.locator('.ant-drawer-body').evaluate(e=>e.scrollTop=0);await shot('filled-390');await form.locator('label[for=categoryNodeId]').scrollIntoViewIfNeeded();await shot('category-390');
 if(process.argv.includes('--form-only')){assert.deepEqual(errors,[]);assert.equal(network.filter(x=>x.path.startsWith('/api/ai/')&&x.method!=='GET').length,0);writeFileSync(out+'form-final.json',JSON.stringify({result:'PASS',writes:0,errors,network,geometry,screens},null,2)+'\n');console.log('MANUAL_CREATE_FORM_FINAL_PASS');await browser.close();process.exit(0);}
 let product;
 if(process.argv.includes('--resume')){const rows=await data('/api/mobile/products');const existing=rows.filter(x=>x.product.itemNumber?.startsWith('SYNTHETIC-MANUAL-'));assert.equal(existing.length,1);product=existing[0].product;await drawer.getByRole('button',{name:'Cancel',exact:true}).click();checks.resumedOriginalCreation=true;}else{
 const response=page.waitForResponse(r=>r.url().endsWith('/api/mobile/products')&&r.request().method()==='POST');await drawer.getByRole('button',{name:'Save & Close',exact:true}).click();const saved=await response;assert.equal(saved.status(),200,await saved.text());product=(await saved.json()).data.product;}checks.createdId=product.id;checks.itemNumber=product.itemNumber;
 await drawer.waitFor({state:'hidden'});await page.reload();await page.getByTestId('stock-master-add-row').waitFor();
 const read=(await data('/api/mobile/products/'+product.id)).product;assert.equal(read.visibilityStatus,'DRAFTER_ONLY');assert.equal(read.categoryId,null);assert.equal(read.name['ja-JP'],'合成手入力商品');assert.equal(read.description['en-US'],'English description');assert.equal(read.catalogData.specification['zh-CN'],'2件');assert.equal(read.attributes.netContent,'1L');assert.deepEqual(read.catalogData.categoryIds,[]);
 checks.persistedAfterRefresh='PASS';assert.equal((await data('/api/category-tree/products/'+product.id)).categoryNodeId,'manual-ui-leaf');
 const profile=await data('/api/merchant/product-catalog/'+product.id);if(profile.value.brand!=='Synthetic edited brand'){profile.value.brand='Synthetic edited brand';const edit=await context.request.put(base+'/api/merchant/product-catalog',{headers,data:{rows:[profile.value],reviewed:true}});assert.equal(edit.status(),200,await edit.text());}assert.equal((await data('/api/mobile/products/'+product.id)).product.brand,'Synthetic edited brand');checks.editExistingCatalog='PASS';
 assert.equal(network.filter(x=>x.path.startsWith('/api/ai/')&&x.method!=='GET').length,0);assert.deepEqual(errors,[]);checks.noAI='PASS: no AI mutation or translation; existing read-only worker/job polling retained';
 writeFileSync(out+'browser.json',JSON.stringify({runtime:'Spring Boot + PostgreSQL 18.6 V1..V46 + Vite + Chromium; synthetic only',checks,errors,network,geometry,screens},null,2)+'\n');console.log('MANUAL_CREATE_BROWSER_PASS');
 }
}finally{await browser.close();}
