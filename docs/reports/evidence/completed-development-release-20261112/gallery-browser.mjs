import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),out=resolve(root,'docs/reports/evidence/completed-development-release-20261112');
const {chromium}=await import(pathToFileURL(resolve(root,'frontend/node_modules/playwright-core/index.mjs')).href);
const credentials=JSON.parse(readFileSync(resolve(root,'.task-tmp/completed-release/qa/credentials.json'),'utf8'));
const origin=process.env.BOBBUY_GALLERY_ORIGIN??'http://127.0.0.1:5197';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
const result={origin,mode:process.argv[2]??'smoke',console:[],network:[],requests:[],checks:[],uploadRequests:[]};
let phase='initial';
try{
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const response=await ctx.request.post(origin+'/api/auth/login',{data:{username:credentials.users[0],password:credentials.password}});
 assert.equal(response.status(),200,'Normal QA account login');
 const session=(await response.json()).data;assert(session.accessToken&&session.user);
 await ctx.addInitScript(s=>{
  localStorage.setItem('bobbuy_locale','en-US');localStorage.setItem('bobbuy_access_token',s.accessToken);localStorage.setItem('bobbuy_auth_user',JSON.stringify(s.user));
  if(s.accessTokenExpiresAt)localStorage.setItem('bobbuy_access_token_expires_at',s.accessTokenExpiresAt);
 },session);
 await ctx.addInitScript(()=>{
  window.__galleryPickerTrace=[];
  window.__galleryPreparedUploads=[];
  const nativeFetch=window.fetch;
  window.fetch=async function(input,init){
   let observed;
   if(init?.body instanceof FormData&&/product-catalog\/[^/]+\/images$/.test(String(input))){
    const file=init.body.get('file');
    if(file instanceof File){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());observed={filename:file.name,mime:file.type,bytes:file.size,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')};window.__galleryPreparedUploads.push(observed);}
   }
   const response=await nativeFetch.call(this,input,init);
   if(observed){observed.status=response.status;const body=await response.clone().json().catch(()=>null);observed.serverSha256=body?.data?.sha256??null;}
   return response;
  };
  const original=HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click=function(){if(this.type==='file')window.__galleryPickerTrace.push({action:'native-input-click',disabled:this.disabled,connected:this.isConnected,active:navigator.userActivation.isActive});return original.call(this);};
  document.addEventListener('click',event=>{const target=event.target.closest?.('.catalog-upload-group button');if(target)window.__galleryPickerTrace.push({action:'upload-button-click',trusted:event.isTrusted,active:navigator.userActivation.isActive});},true);
 });
 const page=await ctx.newPage();
 page.on('pageerror',error=>result.console.push(error.message));
 page.on('console',message=>{if(['warning','error'].includes(message.type()))(result.consoleMessages??=[]).push({phase,type:message.type(),text:message.text()});});
 page.on('response',response=>{if(response.status()>=400)result.network.push({phase,path:new URL(response.url()).pathname,status:response.status()});});
 page.on('request',request=>result.requests.push({method:request.method(),path:new URL(request.url()).pathname}));
 page.on('request',request=>{
  if(request.method()==='POST'&&/product-catalog\/[^/]+\/images$/.test(new URL(request.url()).pathname)){
   result.uploadRequests.push({phase});
  }
 });
 await page.goto(origin+'/admin/products');
 await page.locator('.product-catalog-actions .ant-select').first().waitFor();
 await page.locator('.product-catalog-actions .ant-select').first().click();
 await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({hasText:'Gallery upload QA 1'}).click();
 const drawer=page.locator('.ant-drawer-content-wrapper:visible [role=dialog]');
 await drawer.getByRole('tab',{name:'Images & sources',exact:true}).click();
 const group=drawer.locator('.catalog-upload-group');await group.waitFor();
 const uploadButton=group.locator('button').filter({hasText:'Select verified official image files'});
 result.editor={groupCount:await group.count(),buttons:await group.locator('button').allTextContents(),inputs:await group.locator('input').evaluateAll(values=>values.map(v=>({type:v.type,label:v.getAttribute('aria-label')}))),text:(await group.innerText()).slice(0,1500)};
 await page.screenshot({path:resolve(out,'gallery-smoke-1440.png')});
 result.checks.push('Real Core login and private master editor opened');
 if(result.mode!=='smoke'){
  const imageDir=resolve(root,'.task-tmp/completed-release/images');
  const apiHeaders={Authorization:'Bearer '+session.accessToken};
  const profile=async id=>{const response=await ctx.request.get(origin+'/api/merchant/product-catalog/'+id,{headers:apiHeaders});assert.equal(response.status(),200);return(await response.json()).data.value;};
  const before=await profile('qa-gallery-1');assert.equal(before.gallery.length,0,'Start with empty owned QA master');
  const prepare=async source=>{await group.getByRole('textbox').fill(source??'https://www.costco.co.jp/p/77839');const checkbox=group.getByRole('checkbox');if(!await checkbox.isChecked())await checkbox.check();};
  const choose=async files=>{
   result.pickerBefore=await group.evaluate(node=>({inputs:[...node.querySelectorAll('input')].map(input=>({type:input.type,disabled:input.disabled,effectivelyDisabled:input.matches(':disabled'),checked:input.checked,value:input.type==='file'?'':input.value})),buttons:[...node.querySelectorAll('button')].map(button=>({text:button.textContent,disabled:button.disabled,type:button.type}))}));
   await page.screenshot({path:resolve(out,'gallery-picker-before.png')});
   result.pickerHit=await uploadButton.evaluate(button=>{const box=button.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return{box:{x:box.x,y:box.y,width:box.width,height:box.height},effectivelyDisabled:button.matches(':disabled'),hit:hit?{tag:hit.tagName,classes:hit.className}:null};});
   let selected;
   try{[selected]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),uploadButton.click({timeout:5000})]);}
   catch(error){result.pickerTrace=await page.evaluate(()=>window.__galleryPickerTrace);result.pickerError=error.message;throw error;}
   await selected.setFiles(files);
  };
  const waitFinished=async()=>{await page.waitForFunction(()=>{const node=document.querySelector('.catalog-upload-group input[type=file]');return node&&node.value==='';});await page.waitForFunction(()=>{const node=document.querySelector('.catalog-upload-feedback');return node&&!node.textContent.includes('Uploading');});};
  const statuses=group.getByRole('list',{name:'Image upload status'});
  const syncUploads=async()=>{const values=await page.evaluate(()=>window.__galleryPreparedUploads);assert.equal(values.length,result.uploadRequests.length);result.uploadRequests=result.uploadRequests.map((value,index)=>({...value,...values[index]}));for(const item of result.uploadRequests)if(item.status===200)assert.equal(item.sha256,item.serverSha256);};
  phase='real-duplicate-upload';await prepare();await choose([resolve(imageDir,'one.png'),resolve(imageDir,'same-bytes.png')]);
  await statuses.getByText('same-bytes.png',{exact:true}).waitFor();await waitFinished();
  await syncUploads();
  assert.equal(result.uploadRequests.length,1);assert((await statuses.innerText()).includes('Reused'));
  assert.equal((await profile('qa-gallery-1')).gallery.length,0);
  const firstAsset=await drawer.locator('.catalog-filmstrip button').count();assert.equal(firstAsset,1);
  result.checks.push('Native filechooser, actual PNG POST, duplicate-byte reuse, cleared picker and no automatic master save');
  phase='controlled-middle-failure';let uploaded=0;
  await page.route('**/api/merchant/product-catalog/qa-gallery-1/images',async route=>{if(++uploaded===2)return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({success:false,message:'gallery.invalid'})});return route.continue();});
  const longName='verified-image-'+ '最長ファイル名'.repeat(30)+'.png';
  await prepare();await choose([{name:'two.png',mimeType:'image/png',buffer:readFileSync(resolve(imageDir,'two.png'))},{name:'failed-three.png',mimeType:'image/png',buffer:readFileSync(resolve(imageDir,'three.png'))},{name:longName,mimeType:'image/png',buffer:readFileSync(resolve(imageDir,'four.png'))}]);
  await statuses.locator('.catalog-upload-filename').filter({hasText:longName}).waitFor();await waitFinished();
  await syncUploads();
  assert.equal(uploaded,2);assert.equal(await drawer.locator('.catalog-filmstrip button').count(),2);
  assert((await statuses.innerText()).includes('Pending'));assert((await statuses.innerText()).includes('Failed'));
  assert.equal((await profile('qa-gallery-1')).gallery.length,0);
  await page.unroute('**/api/merchant/product-catalog/qa-gallery-1/images');
  result.checks.push('Actual first success retained after controlled middle HTTP failure; remaining file stays unsent; no partial save');
  result.geometry=[];
  for(const width of [1440,768,320]){
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(350);
   await uploadButton.scrollIntoViewIfNeeded();
   await page.screenshot({path:resolve(out,'gallery-upload-controls-'+width+'.png')});
   result.geometry.push({width,uploadButton:await uploadButton.boundingBox(),saveButton:await drawer.locator('.catalog-review-bar').getByRole('button',{name:'Confirm and save masters',exact:true}).boundingBox()});
   await statuses.locator('.catalog-upload-filename').filter({hasText:longName}).scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'gallery-partial-status-'+width+'.png')});
   (result.visualControls??=[]).push({width,screenshot:'gallery-partial-status-'+width+'.png',controls:await drawer.locator('.catalog-upload-feedback .ant-tag,.catalog-upload-feedback summary,.catalog-upload-group>.ant-btn,.catalog-review-bar>.ant-btn').evaluateAll(nodes=>nodes.map(node=>{const rect=node.getBoundingClientRect(),style=getComputedStyle(node);const range=document.createRange();range.selectNodeContents(node);const glyphRegion=range.getBoundingClientRect();return {role:node.tagName==='SUMMARY'?'disclosure':node.classList.contains('ant-tag')?'status':'action',text:node.textContent,rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},textRegion:{x:glyphRegion.x,y:glyphRegion.y,width:glyphRegion.width,height:glyphRegion.height},color:style.color,background:style.backgroundColor,border:style.borderColor};}))});
   const details=statuses.locator('li').last().locator('details');await details.locator('summary').click();await details.locator('.catalog-upload-record').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,'gallery-expanded-details-'+width+'.png')});await details.locator('summary').click();
   if(width===320){
    result.mobileClipProof=await drawer.evaluate(node=>{const nav=node.querySelector('.catalog-main-tabs>.ant-tabs-nav').getBoundingClientRect();return {stickyTabBottom:nav.bottom,files:[...node.querySelectorAll('.catalog-upload-feedback li')].map(row=>({name:row.querySelector('.catalog-upload-filename').textContent,rowTop:row.getBoundingClientRect().top,filenameTop:row.querySelector('.catalog-upload-filename').getBoundingClientRect().top}))};});
    await drawer.evaluate(node=>{const row=node.querySelectorAll('.catalog-upload-feedback li')[2],body=node.querySelector('.ant-drawer-body'),nav=node.querySelector('.catalog-main-tabs>.ant-tabs-nav');body.scrollTop+=row.getBoundingClientRect().top-nav.getBoundingClientRect().bottom-12;});await page.waitForTimeout(250);await page.screenshot({path:resolve(out,'gallery-mobile-full-card-proof.png')});
   }
   assert.equal(await drawer.evaluate(e=>e.scrollWidth>e.clientWidth),false);
  }
  phase='controlled-save-failure';await page.setViewportSize({width:1440,height:1000});
  await page.route('**/api/merchant/product-catalog',route=>route.request().method()==='PUT'?route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({success:false,message:'master.conflict'})}):route.continue());
  const review=drawer.locator('.catalog-review-bar').getByRole('checkbox');await review.check();
  const save=drawer.locator('.catalog-review-bar').getByRole('button',{name:'Confirm and save masters',exact:true});
  const rejectedSave=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/merchant/product-catalog'&&response.status()===409);await save.click();await rejectedSave;
  await page.waitForFunction(()=>!document.querySelector('.catalog-review-bar .ant-btn-loading'));
  assert.equal((await profile('qa-gallery-1')).gallery.length,0);assert.equal(await drawer.locator('.catalog-filmstrip button').count(),2);
  await page.unroute('**/api/merchant/product-catalog');
  phase='real-save';const savedResponse=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/merchant/product-catalog'&&response.status()===200);await save.click();await savedResponse;
  const after=await profile('qa-gallery-1');assert.equal(after.gallery.length,2);assert(after.version>before.version);
  for(const key of Object.keys(before))if(!['gallery','version'].includes(key))assert.deepEqual(after[key],before[key],key);
  result.masterReadback={beforeVersion:before.version,afterVersion:after.version,assets:after.gallery.map(asset=>({url:asset.url,sha256:asset.sha256})),otherFieldsPreserved:true};
  result.checks.push('Save failure keeps uploaded draft; explicit retry persists gallery with original other master fields');
  await page.reload();await page.locator('.product-catalog-actions .ant-select').first().click();await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({hasText:'Gallery upload QA 1'}).click();await drawer.getByRole('tab',{name:'Images & sources',exact:true}).click();
  assert.equal(await drawer.locator('.catalog-filmstrip button').count(),2);result.checks.push('Saved master reopened through real HTTP after a complete page reload');
  result.preReloadUploadRequests=[...result.uploadRequests];result.uploadRequests=[];
  phase='converted-webp';await prepare();await choose([resolve(imageDir,'converted-fixture.webp')]);await statuses.getByText('converted-fixture.webp',{exact:true}).waitFor();await waitFinished();await syncUploads();
  const webp=result.uploadRequests.at(-1);assert.equal(webp.filename,'converted-fixture.png');
  const convertedSave=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/merchant/product-catalog'&&response.status()===200);await review.check();await save.click();await convertedSave;
  const final=await profile('qa-gallery-1');assert.equal(final.gallery.length,3);assert(final.gallery.some(asset=>asset.sha256===webp.sha256));
  result.checks.push('Real Chrome WebP-to-PNG conversion sends prepared filename and exact SHA, then persists through normal save');
  const other=await browser.newContext();const login2=await other.request.post(origin+'/api/auth/login',{data:{username:credentials.users[1],password:credentials.password}});assert.equal(login2.status(),200);const token2=(await login2.json()).data.accessToken;
  const denied=await other.request.get(origin+'/api/merchant/product-catalog/qa-gallery-1',{headers:{Authorization:'Bearer '+token2}});assert([403,404].includes(denied.status()));
  const forbiddenUpload=await other.request.post(origin+'/api/merchant/product-catalog/qa-gallery-1/images',{headers:{Authorization:'Bearer '+token2},multipart:{file:{name:'forbidden.png',mimeType:'image/png',buffer:readFileSync(resolve(imageDir,'one.png'))},sourceUrl:'https://www.costco.co.jp/p/77839',label:'QA forbidden owner',verified:'true'}});assert([403,404].includes(forbiddenUpload.status()));
  await other.close();result.checks.push('Second authenticated agent cannot read or upload to first agent private master');
  assert.deepEqual(result.console,[]);
  assert(result.network.every(value=>(value.phase==='controlled-middle-failure'&&value.status===400)||(value.phase==='controlled-save-failure'&&value.status===409)));
 }
 result.result='PASS';
 await ctx.close();
}finally{await browser.close();writeFileSync(resolve(out,'gallery-'+result.mode+'.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({result:result.result,editor:result.editor,network:result.network,console:result.console}));
