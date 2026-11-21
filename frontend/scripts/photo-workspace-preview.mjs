import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const out=process.env.PHOTO_PREVIEW||path.join(os.tmpdir(),'bobuy-photo-preview');
await fs.mkdir(out,{recursive:true});
const engine=process.env.PHOTO_ENGINE||'chromium';
const browser=await (engine==='webkit'?webkit.launch():chromium.launch({executablePath:process.env.PHOTO_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']}));
const png=await fs.readFile(new URL('../../docs/reports/evidence/product-photo-intake-20261120/synthetic-photo.png',import.meta.url));
const list=['NEEDS_INPUT','QUEUED','AI_INTAKE','FAILED','COMPLETED'].map((state,i)=>({id:'demo-'+i,state,revision:7,supplierId:'s1',market:'JP',photo:true,itemNumber:i===0?'123456':null,createdAt:new Date(Date.UTC(2026,10,21,8,i)).toISOString(),reviewReady:i===0,failureCode:i===0?'photo.confirm_required':i===3?'ai.pinned_endpoint':null}));
const name={'zh-CN':'北海道牛乳 · 200 毫升 × 12 瓶','zh-TW':'北海道牛乳 · 200 毫升 × 12 瓶','ja-JP':'北海道牛乳 200 mL × 12 本','en-US':'Hokkaido whole milk · 200 mL × 12 bottles'};
const history={id:'observation',productId:'p1',amount:1180,currency:'JPY',unit:'12 瓶',observedAt:'2026-11-20T08:00:00Z'};
const review={jobId:'demo-0',revision:7,supplierId:'s1',market:'JP',itemNumber:'123456',status:'MATCH',matches:[{id:'p1',version:2,name,specification:{},eligible:true}],history:[history],saved:null,photoFacts:{amount:1280,currency:'JPY',unit:'12 瓶',conditions:'',priceKind:'WAREHOUSE',productVisible:true}};
const network=[],errors=[],geometry=[],checks=[],locales=[];
const design=process.env.PHOTO_DESIGN==='1';
const settings=design?[[360,800],[390,844],[1280,800]]:[[390,844],[1280,800]];
for(const [width,height] of settings){
 const context=await browser.newContext({viewport:{width,height},acceptDownloads:true,hasTouch:width<768});
 let uploads=0,retries=0;
 const taskRows=list.map(job=>({...job}));
 if(design)taskRows.push({...list[0],id:'demo-new',itemNumber:'891021'});
 await context.addInitScript(({mockShare})=>{
  localStorage.setItem('bobbuy_access_token','synthetic-ui-only');
  localStorage.setItem('bobbuy_auth_user',JSON.stringify({id:1000,username:'demo',name:'BoBuy 测试商家',roles:['AGENT']}));
  if(!localStorage.getItem('bobbuy_locale'))localStorage.setItem('bobbuy_locale','zh-CN');
  if(mockShare){
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
   Object.defineProperty(navigator,'share',{configurable:true,value:async d=>{window.previewShared=d.files.map(f=>f.name);throw new DOMException('User cancelled','AbortError');}});
  }else{
   Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
  }
 },{mockShare:width!==1280});
 await context.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname,method=request.method();
  const root='/api/ai/costco-onboarding',photo='/api/product-photo-intake';
  let data=[];
  if(path==='/api/auth/me') data={id:1000,username:'demo',name:'BoBuy 测试商家',roles:['AGENT']};
  else if(path===photo) data=taskRows;
  else if(path===root+'/status') data={workerEnabled:true};
  else if(path===root+'/photo'&&method==='POST'){
   data={...list[1],id:'uploaded-'+(++uploads)};taskRows.push(data);
  } else if(path.startsWith(root+'/')) data=taskRows.find(x=>x.id===path.split('/').at(-1))||{};
  else if(path.endsWith('/retry')){
   retries++;data={...list[3],failureCode:null,state:'QUEUED',revision:8};taskRows[3]=data;
  } else if(path.endsWith('/photo')||path==='/api/demo-photo.png'){
   return route.fulfill({contentType:'image/png',body:png});
  } else if(path.endsWith('/confirm')) data={...history,id:'new-observation',amount:1280,inStock:true,priceChanged:true};
  else if(path.startsWith(photo+'/')) data=path.endsWith('demo-0')?review:path.endsWith('demo-new')?{
   ...review,jobId:'demo-new',itemNumber:'891021',status:'NEW',matches:[],history:[],
   candidate:{translatedNames:{'ja-JP':'テスト菓子','zh-CN':'测试米饼'},unknownFields:['packaging']},archiveDetails:null
  }:{...review,itemNumber:null,photoFacts:null,status:'IDENTITY_REQUIRED'};
  else if(path==='/api/mobile/suppliers') data=[{id:'s1',name:{'zh-CN':'Costco 日本','en-US':'Costco Japan','ja-JP':'コストコ日本'}}];
  else if(path==='/api/merchant/currencies') data=[{code:'JPY',minorUnit:0}];
  else if(path==='/api/mobile/products') data=[{displayName:name['zh-CN'],displayDescription:'',product:{id:'p1',visibilityStatus:'DRAFTER_ONLY',name,itemNumber:'123456',currency:'JPY',basePrice:1280,mediaGallery:[{type:'IMAGE',url:'/api/demo-photo.png'}]}}];
  if(path.includes('onboarding')||path.includes('photo-intake')) network.push({width,method,path,status:200});
  await route.fulfill({json:{status:'success',data}});
 });
 const page=await context.newPage();
 page.setDefaultTimeout(10000);
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('requestfailed',request=>{if(!request.failure()?.errorText.includes('ABORT'))errors.push(request.url()+' '+request.failure()?.errorText);});
 let tag='recovery-'+engine;
 if(design)tag='workspace';
 const shot=async (id,selector)=>{
  const area=page.locator(selector).first();
  await area.screenshot({path:out+'/'+tag+'-'+width+'-'+id+'-detail.png',animations:'disabled'});
  if(id!=='archive'&&id!=='queue')await page.locator('.product-photo-intake .ant-modal-wrap').evaluate(e=>{e.scrollTop=0;});
  else await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:out+'/'+tag+'-'+width+'-'+id+'.png',animations:'disabled'});
  geometry.push({width,id,...await area.evaluate(el=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,areaWidth:el.getBoundingClientRect().width,controls:[...el.querySelectorAll('button,a[download],input:not([type=file])')].filter(e=>e.getClientRects().length).map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {label:e.textContent?.trim()||e.getAttribute('aria-label')||e.getAttribute('placeholder'),width:r.width,height:r.height,y:r.y,minWidth:s.minWidth,minHeight:s.minHeight,radius:s.borderRadius,borderColor:s.borderColor,borderWidth:s.borderWidth,background:s.backgroundColor,shadow:s.boxShadow};})}))});
 };
 await page.goto('http://127.0.0.1:'+(process.env.PHOTO_PORT||5173)+'/admin/products');
 const camera=page.getByTestId('ai-quick-snap-button');
 await camera.waitFor().catch(async error=>{console.error(await page.locator('body').innerText(),errors);throw error;});
 await page.getByRole('button',{name:'照片队列',exact:true}).waitFor().catch(async error=>{console.error(await page.locator('body').innerText(),errors);throw error;});
 await page.locator('.photo-queue-summary-counts').waitFor();
 if(design)await shot('archive','.product-archive');
 await camera.click();
 await page.locator('input[capture]').setInputFiles({name:'synthetic-first.png',mimeType:'image/png',buffer:png});
 await page.getByRole('link',{name:'下载照片'}).waitFor();
 if(width!==1280){
  await page.getByRole('button',{name:'保存照片',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.previewShared),['synthetic-first.png']);
  assert.equal(await page.getByText('无法打开系统分享，请下载照片。').count(),0);
 }
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('link',{name:'下载照片'}).click();
 assert.equal((await downloadPromise).suggestedFilename(),'synthetic-first.png');
 await shot('capture','.product-photo-intake .ant-modal-content');
 const submit=page.locator('.product-photo-intake .ant-btn-primary').first();
 await submit.click();
 await page.waitForFunction(()=>document.querySelector('.product-photo-intake')?.textContent.includes('等待处理'));
 await page.locator('input[type=file]:not([capture])').setInputFiles({name:'synthetic-next.png',mimeType:'image/png',buffer:png});
 await page.getByRole('link',{name:'下载照片'}).waitFor();
 await submit.click();
 await page.waitForFunction(()=>document.querySelector('.product-photo-intake')?.textContent.includes('等待处理'));
 assert.equal(uploads,2);
 await page.locator('.product-photo-intake .ant-modal-close').click();
 await page.reload();
 const toggle=page.getByRole('button',{name:'照片队列',exact:true});
 await toggle.click();
 await page.locator('[data-photo-job="uploaded-2"]').waitFor();
 if(design){
  await page.locator('.photo-queue-thumbnail img').first().waitFor();
  await shot('queue','.photo-queue-summary');
 }
 await page.locator('[data-photo-job="demo-3"] button').click();
 await page.getByText(/桥地址未配置/).waitFor();
 await page.getByRole('button',{name:'用原图重新识别'}).click();
 await page.waitForFunction(()=>document.querySelector('.product-photo-intake')?.textContent.includes('等待处理'));
 assert.equal(retries,1);
 await page.locator('.product-photo-intake .ant-modal-close').click();
 await page.locator('[data-photo-job="demo-0"] button').click();
 await page.locator('input[value="1280"]').waitFor({state:'attached'});
 if(design){
  await shot('review','.product-photo-intake .ant-modal-content');
  await page.locator('.photo-proof-toggle').click();
  await page.getByAltText('私有现场照片').waitFor();
  await page.locator('.photo-proof-toggle').click();
  for(const checkbox of await page.locator('.product-photo-intake input[type=checkbox]').all()){
   if(await checkbox.isEnabled())await checkbox.check();
  }
  await page.locator('.photo-confirm-footer .ant-btn-primary').click();
  await page.getByText('现场参考价已更新',{exact:false}).waitFor();
  await shot('receipt','.product-photo-intake .ant-modal-content');
  await page.locator('.product-photo-intake .ant-modal-close').click();
  await page.locator('[data-photo-job="demo-new"] button').click();
  await page.getByRole('heading',{name:'测试米饼'}).waitFor();
  await shot('new','.product-photo-intake .ant-modal-content');
 }else{
  await page.getByText('这是服务器保存的版本。HEIC 上传时可能已转换。').waitFor();
  await shot('stored','.product-photo-intake .ant-modal-content');
 }
 checks.push({width,uploads,retries,review:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
 if(design&&width===390){
  for(const locale of ['zh-CN','zh-TW','ja-JP','en-US']){
   await page.evaluate(locale=>localStorage.setItem('bobbuy_locale',locale),locale);
   await page.reload();
   await page.locator('.photo-queue-summary-list [data-photo-job="demo-0"] button').click();
   await page.locator('.photo-review-overview h2').waitFor();
   await page.locator('.photo-workspace-dialog .ant-modal').evaluate(async el=>{
    await Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{})));
   });
   const result=await page.evaluate(()=>{
    const dialog=document.querySelector('.photo-workspace-dialog .ant-modal');
    const controls=document.querySelectorAll('.record-intake-actions button,.photo-review-proof button,.photo-confirm-footer button');
    return {lang:document.documentElement.lang,viewportWidth:innerWidth,documentWidth:document.documentElement.scrollWidth,modalWidth:dialog?.getBoundingClientRect().width,heights:[...controls].map(node=>node.getBoundingClientRect().height)};
   });
   assert.equal(result.lang,locale);
   assert.equal(result.documentWidth,width);
   assert(result.modalWidth<=width);
   assert(result.heights.every(height=>height>=43.99),JSON.stringify(result));
   locales.push(result);
  }
 }
 await context.close();
}
await browser.close();
await fs.writeFile(out+'/'+(design?'workspace':engine)+'-browser.json',JSON.stringify({engine,design,fixtures:'synthetic PNG and intercepted API, including share cancellation mock',checks,geometry,locales,network,errors},null,2));
assert.deepEqual(errors,[]);
