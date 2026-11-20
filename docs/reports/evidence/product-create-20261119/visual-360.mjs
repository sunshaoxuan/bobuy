import {chromium} from '../../../../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173',out=fileURLToPath(new URL('.',import.meta.url));
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:360,height:800},deviceScaleFactor:1}),errors=[],network=[],views=[];
const auth=await ctx.request.post(base+'/api/auth/login',{data:{username:'agent',password:'agent-pass'}});assert.equal(auth.status(),200);const s=(await auth.json()).data;
await ctx.addInitScript(s=>{if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','zh-CN');localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));localStorage.setItem('bobbuy_disable_chat_websocket','true');},s);
const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/'))network.push({method:r.request().method(),path,status:r.status()});});
async function stable(){await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});}
async function measure(name){const result=await page.locator('.manual-product-create .ant-drawer-content').evaluate(el=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom};};
 const controls=[...el.querySelectorAll('button,input:not([type=radio]):not([type=checkbox]):not(.ant-select-selection-search-input),.ant-select-selector,.ant-radio-button-wrapper')].filter(e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0).map(e=>{const s=getComputedStyle(e);const range=document.createRange();range.selectNodeContents(e);return {label:e.getAttribute('aria-label')||e.id||e.textContent,rect:rect(e),font:s.font,lineHeight:s.lineHeight,padding:s.padding,minWidth:s.minWidth,minHeight:s.minHeight,borderRadius:s.borderRadius,borderWidth:s.borderWidth,borderColor:s.borderColor,background:s.backgroundColor,shadow:s.boxShadow,textRects:[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}))};});
 const buttons=[...el.querySelectorAll('.ant-drawer-extra button')].map(rect);return {viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,controls,saveButtonGap:buttons.length===2?buttons[1].left-buttons[0].right:null};
 });assert(!result.overflow);for(const c of result.controls)assert(c.rect.height>=44,name+' height '+c.label);assert(result.saveButtonGap>=8);views.push({name,...result});}
try{
 await page.goto(base+'/admin/products');await page.getByTestId('stock-master-add-row').waitFor();
 for(const locale of ['zh-CN','ja-JP']){
  await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await page.getByTestId('stock-master-add-row').click();const drawer=page.locator('.manual-product-create');await drawer.waitFor();
  const name=drawer.locator('.ant-form-item').filter({has:page.locator('label[for=nameL10n]')});await name.getByRole('button',{name:'ja-JP',exact:true}).click();await name.getByRole('textbox').fill('合成手動登録・長い日本語の商品名');
  await drawer.locator('.ant-drawer-body').evaluate(e=>e.scrollTop=0);await stable();await measure(locale+'-form');await page.screenshot({path:out+'new-'+locale+'-360.png'});await drawer.locator('.ant-drawer-header').screenshot({path:out+'new-'+locale+'-360-save.png'});
  const picker=drawer.locator('.category-tree-picker');await picker.scrollIntoViewIfNeeded();await picker.click();const popup=page.locator('.category-tree-picker-popup:visible');await popup.waitFor();await stable();
  await page.screenshot({path:out+'category-'+locale+'-360-open.png'});await popup.screenshot({path:out+'category-'+locale+'-360-options.png'});
  const option=popup.getByText(locale==='ja-JP'?'合成手動登録':'合成手动录入',{exact:true});await option.click();await drawer.locator('.category-tree-current-path').waitFor();await stable();await measure(locale+'-category');await page.screenshot({path:out+'category-'+locale+'-360.png'});await drawer.locator('.category-tree-picker-field').screenshot({path:out+'category-'+locale+'-360-field.png'});
  await drawer.locator('.ant-drawer-close').click();await drawer.waitFor({state:'hidden'});
 }
 assert.deepEqual(errors,[]);assert.equal(network.filter(r=>r.method!=='GET').length,0);assert.equal(network.filter(r=>r.status>=400).length,0);
 writeFileSync(out+'visual-360.json',JSON.stringify({result:'PASS',sourceApplicationCommit:'26453d633cbedbf1917f7c3baf61b2142ab73c12',viewport:'360x800; DPR1; original-size PNG crops',productWrites:0,errors,network,views},null,2)+'\n');console.log('VISUAL_360_PASS');
}finally{await browser.close();}
