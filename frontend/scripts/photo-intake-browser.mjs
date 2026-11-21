import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out=new URL('../../docs/reports/evidence/product-photo-intake-20261120/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const evidence={scriptSha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),console:[],network:[],geometry:[],results:[],fixture:'Synthetic persisted photo suggestions; real UI/API/Postgres; not live AI recognition'};
const token=process.env.PHOTO_TEST_TOKEN,job=process.env.PHOTO_TEST_JOB,newJob=process.env.PHOTO_TEST_NEW_JOB;
const context=await browser.newContext({viewport:{width:1280,height:800}});
await context.addInitScript(({token})=>{localStorage.setItem('bobbuy_access_token',token);localStorage.setItem('bobbuy_auth_user',JSON.stringify({id:1000,username:'agent',name:'Synthetic agent',roles:['AGENT']}));if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','en-US');},{token});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('console',m=>evidence.console.push({type:m.type(),text:m.text()}));page.on('requestfailed',r=>evidence.network.push({path:r.url().replace(/\?.*/,''),error:r.failure()?.errorText}));page.on('pageerror',e=>evidence.console.push({type:'pageerror',text:e.message}));page.on('response',r=>{if(r.url().includes('/api/'))evidence.network.push({path:new URL(r.url()).pathname,status:r.status(),method:r.request().method()});});
async function screenshot(name){await page.locator('.product-photo-intake .ant-modal-wrap').evaluate(e=>{e.scrollTop=0;});await page.locator('.product-photo-intake .ant-modal-body').evaluate(e=>{e.scrollTop=0;});await page.screenshot({path:new URL(name+'-full.png',out).pathname,fullPage:true});const modal=page.locator('.product-photo-intake .ant-modal-content');if(await modal.count()){await modal.screenshot({path:new URL(name+'-modal.png',out).pathname});const body=page.locator('.product-photo-intake .ant-modal-body');await body.evaluate(e=>{e.scrollTop=e.scrollHeight;});await modal.screenshot({path:new URL(name+'-actions.png',out).pathname});await body.evaluate(e=>{e.scrollTop=0;});}}
async function geometry(name){evidence.geometry.push({name,...await page.evaluate(()=>{const modal=document.querySelector('.product-photo-intake .ant-modal-content');const controls=[...(modal?.querySelectorAll('button,input:not([type=file]),.ant-select-selector,.ant-checkbox-wrapper')||[])].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent?.trim()||e.closest('label')?.textContent?.trim(),x:r.x,y:r.y,width:r.width,height:r.height,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,shadow:s.boxShadow,visible:r.width>0&&r.height>0};});return {viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,modalWidth:modal?.getBoundingClientRect().width,controls};})});}
async function openJob(id){await page.locator(`[data-photo-job="${id}"]`).getByRole('button',{name:'Open photo task'}).click();await page.locator('.product-photo-intake .photo-evidence').waitFor();}
if(process.env.PHOTO_BROWSER_EXTRA==='queue'){
 const folder=new URL('issue-189/',out);
 await fs.mkdir(folder,{recursive:true});
 const modal=page.locator('.product-photo-intake .ant-modal-content');
 const library=modal.locator('input[type=file][multiple]');
 const camera=modal.locator('input[capture=environment]');
 const upload=modal.getByRole('button',{name:'Choose a photo or file',exact:true});
 const failed=process.env.PHOTO_TEST_FAILED_JOB;
 const submitted=[];
 // The background archive shows seeded images. Keep these two unrelated fixtures local.
 for(const url of [
  'https://cdn.bobbuy.example/products/matcha-kit.png',
  'https://images.costco-static.com/ImageDelivery/imageService*'
 ]){
  await page.route(url,route=>route.fulfill({contentType:'image/png',body:Buffer.from(
   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTioAAAAASUVORK5CYII=','base64')}));
 }
 evidence.fixture+='; unrelated seeded archive images use local placeholders';
 try{
  await page.goto('http://127.0.0.1:5173/admin/products');
  const entry=page.getByTestId('ai-quick-snap-button').filter({visible:true});
  await entry.click();
  await upload.waitFor();
  await modal.locator(".ant-select:not(.ant-select-loading)").first().waitFor();
  if(!await upload.isEnabled()){
   await modal.getByLabel('Select supplier',{exact:true}).click();
   await page.locator('.ant-select-item-option').first().click();
  }
  const fixture=async(color)=>Buffer.from(await page.evaluate(async color=>{
   const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;
   const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,40,40);
   return Array.from(new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve))).arrayBuffer()));
  },color));
  const file=async(name,color)=>({name,mimeType:'image/png',buffer:await fixture(color)});
  const made=(count)=>new Promise(resolve=>{
   const receive=async response=>{
    if(response.request().method()!=='POST'||!response.url().endsWith('/api/ai/costco-onboarding/photo'))return;
    assert.equal(response.status(),200);
    const row=(await response.json()).data;
    assert.equal(row.state,'QUEUED');
    submitted.push(row.id);
    if(submitted.length===count){page.off('response',receive);resolve();}
   };
   page.on('response',receive);
  });
  const done=Promise.race([made(3),page.waitForTimeout(24000).then(()=>{throw new Error("Timed out waiting for three queue responses");})]);
  await library.setInputFiles([await file('first.png','#d85b15'),await file('second.png','#196765')]);
  assert(await upload.isEnabled());
  await camera.setInputFiles(await file('rear-camera.png','#164bc4'));
  await done;
  for(const state of ['Queued','Recognizing','Awaiting confirmation','Saved','Failed · retry available']){
   await modal.getByText(state,{exact:true}).first().waitFor();
  }
  for(const [width,height] of [[390,844],[767,844],[1280,800]]){
   await page.setViewportSize({width,height});
   await modal.locator('.photo-queue ul').evaluate(list=>{list.scrollTop=0;});
   await modal.locator('.photo-queue-thumbnail img').first().waitFor();
   await geometry('queue-'+width);
   const g=evidence.geometry.at(-1);
   assert(g.documentWidth<=width);
   assert(g.controls.filter(row=>row.visible&&row.tag==='BUTTON').every(row=>row.height>=44));
   assert(await modal.locator('.photo-queue ul').evaluate(list=>list.scrollWidth<=list.clientWidth));
   assert(await upload.isEnabled());
   if(width!==767){
    await modal.screenshot({path:new URL(width+'-queue.png',folder).pathname});
    await modal.locator(`[data-photo-job="${job}"]`).scrollIntoViewIfNeeded();
    await modal.screenshot({path:new URL(width+'-queue-states.png',folder).pathname});
   }
  }
  await page.reload();
  await page.getByTestId('ai-quick-snap-button').filter({visible:true}).click();
  for(const id of submitted) await modal.locator(`[data-photo-job="${id}"]`).waitFor();
  const retryResponse=page.waitForResponse(r=>r.url().endsWith('/'+failed+'/retry'));
  const failedRow=modal.locator(`[data-photo-job="${failed}"]`);
  await failedRow.getByRole('button',{name:'Retry recognition with this photo'}).click();
  assert.equal((await retryResponse).status(),200);
  await failedRow.getByText('Queued',{exact:true}).waitFor();
  await modal.locator(`[data-photo-job="${job}"]`).getByRole('button',{name:'Open photo task'}).click();
  await modal.getByText(/Confirm and save observation/).waitFor();
  assert(await upload.isEnabled());
  for(const locale of ['zh-CN','zh-TW','ja-JP']){
   await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);
   await page.reload();
   await page.setViewportSize({width:390,height:844});
   await page.getByTestId('ai-quick-snap-button').filter({visible:true}).click();
   await modal.locator('.photo-queue li').first().waitFor();
   await geometry('queue-'+locale);
   assert(await modal.locator('.photo-queue ul').evaluate(list=>list.scrollWidth<=list.clientWidth));
   assert.equal(await page.locator('html').getAttribute('lang'),locale);
   assert(evidence.geometry.at(-1).documentWidth<=390);
  }
  assert.equal(evidence.console.filter(e=>e.type==='pageerror'||e.type==='error').length,0);
  assert.equal(evidence.network.filter(e=>e.path.includes('/product-photo-intake')&&e.status>=400).length,0);
  assert.equal(evidence.network.filter(e=>e.method==='POST'&&e.path==='/api/ai/costco-onboarding/photo').length,3);
  evidence.results.push('Real Spring API and isolated PostgreSQL: multi-select and continuous capture input, three independent queued responses, reload, all five states, private thumbnails, retry without another multipart request, independent confirmation entry, four locales, 390/767/1280 layouts.');
 }finally{
  await fs.writeFile(new URL('browser.json',folder),JSON.stringify(evidence,null,2));
  await browser.close();
 }
 process.exit(0);
}
if(process.env.PHOTO_BROWSER_EXTRA==='locales'){
 try{
  await page.goto('http://127.0.0.1:5173/admin/products');
  for(const locale of ['en-US','zh-CN','zh-TW','ja-JP']){
   await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await page.setViewportSize({width:390,height:844});
   await page.locator(`[data-photo-job="${job}"] button`).click();await page.locator('.photo-evidence').waitFor();await page.locator('.product-photo-intake input[value="999"]').waitFor();
   assert.equal(await page.locator('html').getAttribute('lang'),locale);
   await screenshot('390-review-'+locale);await geometry('390-review-'+locale);
   const labels=page.locator('.product-photo-intake .ant-checkbox-wrapper');
   for(let i=0;i<await labels.count();i++){await labels.nth(i).scrollIntoViewIfNeeded();await labels.nth(i).screenshot({path:new URL('glyph-'+locale+'-check-'+i+'.png',out).pathname});}
   const buttons=page.locator('.product-photo-intake .ant-btn');
   for(let i=0;i<await buttons.count();i++){await buttons.nth(i).scrollIntoViewIfNeeded();await buttons.nth(i).screenshot({path:new URL('glyph-'+locale+'-action-'+i+'.png',out).pathname});}
   evidence.results.push({locale,title:await page.locator('.product-photo-intake .ant-modal-title').innerText(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
   await page.locator('.product-photo-intake .ant-modal-close').click();
  }
 }finally{await fs.writeFile(new URL('browser-locales.json',out),JSON.stringify(evidence,null,2));await browser.close();}process.exit(0);
}
if(process.env.PHOTO_BROWSER_EXTRA==='media'){
 try{
  await page.goto('http://127.0.0.1:5173/admin/products');await openJob(job);await page.getByAltText('Source-verified catalog image',{exact:true}).waitFor();await page.getByText('Retrieved sources (verify alongside the photo)',{exact:true}).click();
  for(const width of [1280,390]){await page.setViewportSize({width,height:width===1280?800:844});await screenshot(width+'-official-source');await geometry(width+'-official-source');}
  const modal=page.locator('.product-photo-intake');await modal.getByRole('checkbox',{name:/I verified the source and usage rights/}).check();await modal.getByRole('checkbox',{name:/I verified the supplier, market/}).check();await modal.getByRole('checkbox',{name:/I confirmed the amount, currency/}).check();
  await page.getByRole('button',{name:'Create private product and save observation',exact:true}).click();await page.getByText('Saved. Reopen to verify.',{exact:true}).waitFor();await screenshot('390-official-source-saved');evidence.results.push('Verified catalog image private preview, source link, explicit opt-in and real private product creation');
 }finally{await fs.writeFile(new URL('browser-media.json',out),JSON.stringify(evidence,null,2));await browser.close();}process.exit(0);
}
if(['1','ai'].includes(process.env.PHOTO_BROWSER_EXTRA)){
 try{
  if(process.env.PHOTO_BROWSER_EXTRA!=='ai'){
  await page.goto('http://127.0.0.1:5173/admin/products');await openJob(job);await page.getByRole('button',{name:'Open product details',exact:true}).click();await page.locator('.photo-history summary').click();await page.getByText(/Available on site/).waitFor();await page.screenshot({path:new URL('1280-archive-history.png',out).pathname,fullPage:true});evidence.results.push('Real archive history displays supplier, market, amount and availability');await page.locator('.catalog-editor .ant-drawer-close').click();
  for(const locale of ['en-US','zh-CN','zh-TW','ja-JP']){await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await page.setViewportSize({width:390,height:844});await page.locator(`[data-photo-job="${newJob}"] button`).click();await page.locator('.photo-evidence').waitFor();await page.locator('.product-photo-intake input[value="999"]').waitFor();await screenshot('390-review-'+locale);await geometry('390-review-'+locale);
   await page.locator('.product-photo-intake .ant-modal-close').click();}
  }else{await page.goto('http://127.0.0.1:5173/admin/products');}
  await page.evaluate(()=>localStorage.setItem('bobbuy_locale','en-US'));await page.reload();await page.getByTestId('ai-quick-snap-button').click();
  const response=await context.request.get(`http://127.0.0.1:5173/api/product-photo-intake/${job}/photo`,{headers:{Authorization:'Bearer '+token}});const bytes=await response.body();await page.locator('input[type=file]:not([capture])').setInputFiles({name:'synthetic-photo.png',mimeType:'image/png',buffer:bytes});await page.getByAltText('Private on-site photo evidence').waitFor();
  for(const [i,name] of ['Take a photo','Choose a photo or file','Identify and find','Close'].entries()){const button=page.getByRole('button',{name,exact:true}).last();await button.scrollIntoViewIfNeeded();await button.focus();assert(await button.evaluate(e=>e===document.activeElement));await button.screenshot({path:new URL('glyph-button-'+i+'.png',out).pathname});}
  await screenshot('390-selection-final');await geometry('390-selection-final');await page.setViewportSize({width:1280,height:800});await screenshot('1280-selection-final');await geometry('1280-selection-final');await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Identify and find',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.product-photo-intake')?.textContent?.includes('ai.pinned_endpoint')||document.querySelector('.product-photo-intake')?.textContent?.includes('configured')||document.querySelector('.product-photo-intake')?.textContent?.includes('More information needed'),{},{timeout:20000});await screenshot('390-ai-unconfigured');evidence.results.push('Real photo queued and original preserved; gateway unconfigured, live AI acceptance incomplete');
 }finally{await fs.writeFile(new URL(process.env.PHOTO_BROWSER_EXTRA==='ai'?'browser-ai.json':'browser-extra.json',out),JSON.stringify(evidence,null,2));await browser.close();}
 process.exit(0);
}
try{
 await page.goto('http://127.0.0.1:5173/admin/products');await page.getByTestId('ai-quick-snap-button').waitFor();
 await page.getByTestId('ai-quick-snap-button').click();await page.getByRole('button',{name:'Choose a photo or file',exact:true}).waitFor();
 const photoResponse=await context.request.get(`http://127.0.0.1:5173/api/product-photo-intake/${job}/photo`,{headers:{Authorization:'Bearer '+token}});assert.equal(photoResponse.status(),200);const photo=await photoResponse.body();await fs.writeFile(new URL('synthetic-photo.png',out),photo);
 const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Choose a photo or file',exact:true}).click();await (await chooserPromise).setFiles({name:'synthetic-photo.png',mimeType:'image/png',buffer:photo});await page.getByAltText('Private on-site photo evidence').waitFor();
 assert.equal(await page.locator('input[capture=environment]').count(),1);assert.equal(await page.locator('input[type=file]:not([capture])').count(),1);
 await screenshot('1280-selection');await geometry('1280-selection');await page.getByRole('button',{name:'Close',exact:true}).last().click();evidence.results.push('Desktop native file chooser event; photo preview; cancellation before enqueue');
 await openJob(job);await page.locator('.product-photo-intake input[value="999"]').waitFor();
 for(const width of [1280,390,360,767]){await page.setViewportSize({width,height:width===1280?800:844});await screenshot(width+'-match');await geometry(width+'-match');}
 const checks=page.locator('.product-photo-intake .ant-checkbox-wrapper');assert.equal(await checks.nth(2).locator('input').isChecked(),false);await checks.nth(0).click();await checks.nth(1).click();await checks.nth(2).click();
 await page.getByRole('button',{name:'Confirm and save observation',exact:true}).click();await page.getByText('Saved. Reopen to verify.',{exact:true}).waitFor();await screenshot('767-saved');
 const result=await context.request.get(`http://127.0.0.1:5173/api/product-photo-intake/${job}`,{headers:{Authorization:'Bearer '+token}});const data=(await result.json()).data;assert.equal(data.saved.amount,999);assert.equal(data.saved.inStock,true);evidence.results.push('Matched archive: real confirmation POST and GET readback saved 999 JPY and availability');
 await page.getByRole('button',{name:'Close',exact:true}).last().click();await page.reload();await openJob(job);await page.getByText('Saved. Reopen to verify.',{exact:true}).waitFor();await page.getByRole('button',{name:'Open product details',exact:true}).click();await page.locator('.photo-history summary').click();await page.getByText(/Available on site/).waitFor();await page.screenshot({path:new URL('767-archive-history.png',out).pathname,fullPage:true});await page.locator('.catalog-editor .ant-drawer-close').click();evidence.results.push('Reload and reopen durable saved observation; archive history displays scoped availability');
 await openJob(newJob);await page.getByText('Review new private product',{exact:true}).waitFor();await page.setViewportSize({width:390,height:844});await screenshot('390-create');await geometry('390-create');
 const newChecks=page.locator('.product-photo-intake .ant-checkbox-wrapper');await newChecks.nth(0).click();await newChecks.nth(1).click();await newChecks.nth(2).click();await page.getByRole('button',{name:'Create private product and save observation',exact:true}).click();await page.getByText('Saved. Reopen to verify.',{exact:true}).waitFor();await screenshot('390-created');evidence.results.push('Private new archive: actual create/observation transaction via UI');await page.getByRole('button',{name:'Close',exact:true}).last().click();
 for(const locale of ['zh-CN','zh-TW','ja-JP']){await page.evaluate(l=>localStorage.setItem('bobbuy_locale',l),locale);await page.reload();await page.locator(`[data-photo-job="${job}"] button`).click();await page.locator('.photo-evidence').waitFor();await screenshot('390-'+locale);await geometry('390-'+locale);await page.locator('.product-photo-intake .ant-modal-close').click();}
 await page.evaluate(()=>localStorage.setItem('bobbuy_locale','en-US'));await page.reload();await page.getByTestId('ai-quick-snap-button').click();await page.locator('input[type=file]:not([capture])').setInputFiles({name:'synthetic-photo.png',mimeType:'image/png',buffer:photo});await page.getByAltText('Private on-site photo evidence').waitFor();await page.getByRole('button',{name:'Identify and find',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.product-photo-intake')?.textContent?.includes('ai.pinned_endpoint')||document.querySelector('.product-photo-intake')?.textContent?.includes('configured')||document.querySelector('.product-photo-intake')?.textContent?.includes('More information needed'),{},{timeout:20000});await screenshot('390-ai-unconfigured');evidence.results.push('Actual photo request attempted against current gateway; environment unconfigured, not a successful live AI recognition');
 assert.equal(evidence.console.filter(e=>e.type==='pageerror').length,0);assert(evidence.geometry.every(g=>g.documentWidth<=g.viewport.width));
}finally{await fs.writeFile(new URL('browser.json',out),JSON.stringify(evidence,null,2));await browser.close();}
