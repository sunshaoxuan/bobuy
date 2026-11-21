import {webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const output=process.env.GALLERY_TEST_OUTPUT||path.join(os.tmpdir(),'bobuy-gallery-picker');
await fs.mkdir(output,{recursive:true});
const browser=await webkit.launch();
const png=await fs.readFile(new URL('../../docs/reports/evidence/product-photo-intake-20261120/synthetic-photo.png',import.meta.url));
const base='http://127.0.0.1:'+(process.env.GALLERY_TEST_PORT||5198);
const api='/api/merchant/product-catalog';
const official='https://example.org/official/synthetic-first';
const nextSource='https://example.org/official/synthetic-next';
const checks=[];
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390});
  await context.addInitScript(()=>{
   localStorage.setItem('bobbuy_locale','en-US');
   const originalFetch=window.fetch.bind(window);
   window.fetch=(input,options)=>{
    if(String(input).endsWith('/images')&&options?.body instanceof FormData){
     window.galleryUploadEvidence={source:options.body.get('sourceUrl'),verified:options.body.get('verified')};
    }
    return originalFetch(input,options);
   };
   localStorage.setItem('bobbuy_access_token','synthetic-browser-only');
   localStorage.setItem('bobbuy_auth_user',JSON.stringify({id:1000,username:'demo',name:'Demo',roles:['AGENT']}));
  });
  let saved={productId:'gallery-fixture',version:1,name:{'ja-JP':'Synthetic gallery product','en-US':'Synthetic gallery product'},description:{},itemNumber:'FIXTURE-001',specification:{},categoryIds:[],gallery:[],translationsReviewed:false};
  const uploads=[];
  const archive={total:1,rows:[{id:saved.productId,name:saved.name['en-US'],itemNumber:saved.itemNumber,mediaCount:0,catalogDriven:true}]};
  await context.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),method=request.method();
   const p=url.pathname;
   let data=[];
   if(p==='/api/auth/me')data={id:1000,username:'demo',name:'Demo',roles:['AGENT']};
   else if(p==='/api/merchant/product-archive')data=archive;
   else if(p.startsWith('/api/category-tree/products/'))data={productId:saved.productId,categoryNodeId:null};
   else if(p.endsWith('recommendation-taxonomy'))data={categories:[],suppliers:[]};
   else if(p===api+'/'+saved.productId)data={value:saved,canonical:true,sourceItemIds:[]};
   else if(p===api+'/preview')data=request.postDataJSON().rows.map(value=>({value,changes:[],warnings:[]}));
   else if(p===api&&method==='PUT'){
    const requestData=request.postDataJSON();
    assert.equal(requestData.reviewed,true);
    assert.equal(requestData.rows[0].version,saved.version);
    saved={...requestData.rows[0],version:saved.version+1};
    data=[{value:saved,canonical:true,sourceItemIds:[]}];
   }else if(p===api+'/'+saved.productId+'/images'){
    const sourceUrl=uploads.length?nextSource:official;
    data={type:'IMAGE',url:'/api/storefront/recommendation-images/fixture-'+(uploads.length+1),sourceUrl,title:{'en-US':'Fixture'},visible:true};
    uploads.push(data);
   }else if(p.startsWith('/api/storefront/recommendation-images/'))return route.fulfill({contentType:'image/png',body:png});
   await route.fulfill({json:{status:'success',data}});
  });
  const page=await context.newPage();
  page.setDefaultTimeout(8000);
  const errors=[],archiveInterruptions=[];
  const recordError=message=>{
   if(message.includes('/api/merchant/product-archive?page=')&&message.includes('due to access control checks'))
    archiveInterruptions.push(message);
   else errors.push(message);
  };
  page.on('pageerror',error=>recordError(error.message));
  page.on('console',message=>{if(message.type()==='error')recordError(message.text());});
  const open=async()=>{
   await page.locator('.record-title').filter({hasText:'Synthetic gallery product'}).click();
   const drawer=page.locator('.catalog-editor .ant-drawer-content');
   await drawer.getByRole('tab',{name:'Images & sources'}).click().catch(async error=>{console.error((await page.locator('body').innerText()).slice(-5000),errors);throw error;});
   return drawer;
  };
  const save=async drawer=>{
   await drawer.getByRole('checkbox',{name:/I reviewed the data, exact model/}).check();
   await Promise.all([page.waitForResponse(r=>r.request().method()==='PUT'&&new URL(r.url()).pathname===api&&r.ok()),
    drawer.getByRole('button',{name:'Confirm and save masters'}).click()]);
  };
  let chooserCount=0;
  page.on('filechooser',()=>chooserCount++);
  const choose=drawer=>Promise.all([page.waitForEvent('filechooser'),drawer.getByRole('button',{name:'Add images',exact:true}).click()]).then(([chooser])=>chooser);
  await page.goto(base+'/admin/products');
  let drawer=await open();
  await (await choose(drawer)).setFiles([]);
  assert.equal(chooserCount,1);
  await (await choose(drawer)).setFiles({name:'fixture-first.png',mimeType:'image/png',buffer:png});
  assert.equal(chooserCount,2);
  await expect(drawer.locator('canvas:not([hidden])')).toBeVisible();
  await expect(drawer.getByRole('button',{name:'Upload selected images'})).toBeDisabled();
  assert.equal(uploads.length,0);
  await drawer.getByLabel('Default official image source').fill(official);
  await save(drawer);
  assert.equal(saved.defaultImageSourceUrl,official);assert.equal(saved.gallery.length,0);
  await page.waitForLoadState('networkidle');await page.reload({waitUntil:'networkidle'});drawer=await open();
  await expect(drawer.getByLabel('Default official image source')).toHaveValue(official);
  await (await choose(drawer)).setFiles({name:'fixture-first.png',mimeType:'image/png',buffer:png});
  await drawer.getByRole('checkbox',{name:/I verified the exact item\/specification/}).check();
  await drawer.getByRole('button',{name:'Upload selected images'}).click();
  await expect(drawer.locator('.catalog-compact-cover img')).toBeVisible();
  assert.deepEqual(await page.evaluate(()=>window.galleryUploadEvidence),{source:official,verified:'true'});
  await save(drawer);
  await page.waitForLoadState('networkidle');await page.reload({waitUntil:'networkidle'});drawer=await open();
  await expect(drawer.locator('.catalog-compact-cover img')).toHaveAttribute('src',/fixture-1/);
  await expect(drawer.getByLabel('Official image sources',{exact:true})).toHaveValue(official);
  const extra=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');
   canvas.width=32;canvas.height=32;
   const context=canvas.getContext('2d');
   context.fillStyle='#54885a';context.fillRect(0,0,32,32);
   return canvas.toDataURL().split(',')[1];
  });
  await (await choose(drawer)).setFiles({name:'fixture-extra.png',mimeType:'image/png',buffer:Buffer.from(extra,'base64')});
  assert.equal(chooserCount,4);
  await drawer.getByLabel('Default official image source').fill(nextSource);
  await drawer.getByRole('checkbox',{name:/I verified the exact item\/specification/}).check();
  await drawer.getByRole('button',{name:'Upload selected images'}).click();
  await expect(drawer.locator('.catalog-filmstrip button')).toHaveCount(2);
  assert.deepEqual(await page.evaluate(()=>window.galleryUploadEvidence),{source:nextSource,verified:'true'});
  await save(drawer);
  assert.deepEqual(saved.gallery.map(image=>image.sourceUrl),[official,nextSource]);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(output,'gallery-'+width+'.png')});
  checks.push({width,chooserCount,uploads:uploads.length,defaultSource:saved.defaultImageSourceUrl,coverSource:saved.gallery[0].sourceUrl,archiveInterruptions,errors});
  await context.close();
 }
 await fs.writeFile(path.join(output,'gallery-webkit.json'),JSON.stringify(checks,null,2));
 console.log(JSON.stringify(checks));
}finally{await browser.close();}
