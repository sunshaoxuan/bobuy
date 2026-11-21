import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from '@playwright/test';

const output=process.env.ARCHIVE_EVIDENCE;
const token=process.env.ARCHIVE_TEST_TOKEN;
assert(output&&token,'Run through the isolated archive integration test with an evidence directory');
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.ARCHIVE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
const archive='/api/merchant/product-archive', legacy='/api/mobile/products';
const fixtureJob={id:'archive-fixture-photo',state:'NEEDS_INPUT',revision:7,supplierId:'sup-1000',market:'JP',photo:true,
 itemNumber:'CODE-0519',failureCode:'photo.confirm_required',createdAt:'2026-11-21T09:00:00Z',reviewReady:true};
const valid=(data)=>({status:'success',data});

try {
 for(const width of [390,1280]){
  for(const mode of ['baseline','candidate']){
   const context=await browser.newContext({viewport:{width,height:width===390?844:800},reducedMotion:'reduce'});
   await context.addInitScript(({token})=>{
    localStorage.setItem('bobbuy_access_token',token);
    localStorage.setItem('bobbuy_auth_user',JSON.stringify({id:8180,username:'archive-test-merchant',name:'Fixture merchant',roles:['AGENT']}));
    localStorage.setItem('bobbuy_locale','en-US');
   },{token});
   const page=await context.newPage();
   page.setDefaultTimeout(30000);
   const port=mode==='baseline'?5178:5179;
   let epoch=performance.now();
   const requests=[],errors=[],httpErrors=[];
   page.on('request',request=>{
    const url=new URL(request.url());
    if(url.pathname.startsWith('/api/'))requests.push({path:url.pathname,query:url.search,at:Math.round(performance.now()-epoch)});
   });
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{
    const pathname=new URL(response.url()).pathname;
    if(pathname.startsWith('/api/')&&response.status()>=400)httpErrors.push([pathname,response.status()]);
   });
   // Candidate-only UI interactions use a synthetic photo receipt. Archive, search and details use the real test API.
   if(mode==='candidate'){
    await page.route('**/api/product-photo-intake**',route=>{
     const url=new URL(route.request().url());
     if(url.pathname=== '/api/product-photo-intake')return route.fulfill({json:valid([fixtureJob])});
     if(url.pathname.endsWith('/photo'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100"><rect width="120" height="100" fill="#e9eee4"/></svg>'});
     if(url.pathname.endsWith('/confirm'))return route.fulfill({json:valid({id:'synthetic-browser-receipt',productId:'archive-0519',inStock:true,amount:1299,currency:'JPY',unit:'pack',priceChanged:false,observedAt:'2026-11-21T09:00:00Z'})});
     return route.fulfill({json:valid({jobId:fixtureJob.id,revision:7,supplierId:'sup-1000',market:'JP',itemNumber:'CODE-0519',status:'MATCH',
      matches:[{id:'archive-0519',version:0,name:{'en-US':'Fixture product 0519'},specification:{},eligible:true}],history:[],saved:null,
      photoFacts:{amount:1299,currency:'JPY',unit:'pack',priceKind:'WAREHOUSE',productVisible:true}})});
    });
    await page.route('**/api/ai/costco-onboarding/archive-fixture-photo',route=>route.fulfill({json:valid(fixtureJob)}));
   }
   const listPath=mode==='baseline'?legacy:archive;
   const server=page.waitForResponse(response=>new URL(response.url()).pathname===listPath).catch(async error=>{
    console.error(mode,width,requests.map(request=>request.path),errors,(await page.locator('body').innerText()).slice(0,250));
    throw error;
   });
   epoch=performance.now();
   await page.goto('http://localhost:'+port+'/admin/products',{waitUntil:'domcontentloaded'});
   const response=await server;
   assert.equal(response.status(),200);
   const entries=(await response.json()).data;
   const bodyBytes=(await response.body()).length;
   const firstCard=page.locator('.product-record-pin').first();
   await firstCard.locator('.record-title').waitFor();
   const firstCardMs=Math.round(performance.now()-epoch);
   const requestsAtFirstCard=requests.length;
   const timing=response.request().timing();
   await page.waitForTimeout(1000);
   const apiRequestsOneSecondAfterCard=requests.length;
   const domFirstBatch=await page.locator('.product-record-pin').count();
   const rowCount=mode==='baseline'?entries.length:entries.rows.length;
   assert.equal(rowCount,mode==='baseline'?520:24);
   assert.equal(domFirstBatch,rowCount);
   await page.screenshot({path:path.join(output,mode+'-'+width+'.png'),animations:'disabled'});
   const css=mode==='candidate'?await page.locator('.record-page-nav').evaluate(nav=>({
    documentWidth:document.documentElement.scrollWidth,
    controls:[...nav.querySelectorAll('button')].map(el=>{
     const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
     return {height:rect.height,width:rect.width,minHeight:style.minHeight,minWidth:style.minWidth,borderRadius:style.borderRadius,borderColor:style.borderColor,borderWidth:style.borderWidth,background:style.backgroundColor,shadow:style.boxShadow};
    })
   })):null;
   if(css){
    assert(css.documentWidth<=width);
    assert(css.controls.every(control=>control.height>=44));
   }
   assert.deepEqual(errors,[]);
   assert.deepEqual(httpErrors,[]);
   const result={mode,width,rowCount,bodyBytes,domFirstBatch,firstCardMs,requestsAtFirstCard,apiRequestsOneSecondAfterCard,
    ttfbMs:Math.round(timing.responseStart-timing.requestStart),totalMs:Math.round(timing.responseEnd-timing.requestStart),css};
   if(mode==='candidate'){
    await page.locator('.record-page-nav').screenshot({path:path.join(output,'candidate-pagination-'+width+'.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByRole('heading',{name:'Fixture product 0024',exact:true}).waitFor();
    const listCalls=requests.filter(request=>request.path===archive).length;
    await page.getByText('Manage records',{exact:true}).click();
    await page.getByText(/CODE-0024$/).waitFor();
    assert.equal(requests.filter(request=>request.path===archive).length,listCalls);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(output,'candidate-management-'+width+'.png'),animations:'disabled'});
    await page.getByText('Image cards',{exact:true}).click();
    await page.getByRole('button',{name:'Previous',exact:true}).click();
    await page.getByRole('heading',{name:'Fixture product 0003',exact:true}).waitFor();
    await page.getByPlaceholder(/search.*SKU/i).fill('CODE-0519');
    await page.getByRole('heading',{name:'Fixture product 0519',exact:true}).waitFor();
    assert.equal(await page.locator('.product-record-pin').count(),1);
    await page.screenshot({path:path.join(output,'candidate-search-'+width+'.png'),animations:'disabled'});
    const detail=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/merchant/product-catalog/archive-0519');
    await page.goto('http://localhost:'+port+'/admin/products?product=archive-0519');
    assert.equal((await detail).status(),200);
    const drawer=page.locator('.catalog-editor .ant-drawer-close');
    await drawer.waitFor();
    await drawer.click();
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByRole('heading',{name:'Fixture product 0024',exact:true}).waitFor();
    await page.getByRole('button',{name:'Photo queue',exact:true}).click();
    await page.locator('[data-photo-job="archive-fixture-photo"] button').click();
    const modal=page.locator('.product-photo-intake');
    for(const name of [/I verified the supplier/,/I confirmed the amount/,/I confirm the product/]){
     await modal.getByRole('checkbox',{name}).check();
    }
    const reload=page.waitForResponse(r=>new URL(r.url()).pathname===archive);
    await modal.getByRole('button',{name:'Confirm and save observation'}).click();
    await modal.getByText('Saved. Reopen to verify.',{exact:true}).waitFor();
    const refreshed=await reload;
    assert.equal(refreshed.status(),200);
    assert.equal(new URL(refreshed.url()).searchParams.get('page'),'1');
    await page.getByRole('heading',{name:'Fixture product 0024',exact:true}).waitFor();
    assert.equal(requests.filter(request=>request.path===legacy).length,0);
    result.interactions={next:true,previous:true,managementSharedPage:true,globalSearch:true,detailDeepLink:true,photoConfirmationRefreshedPage:true,legacyListRequests:0};
    assert.deepEqual(errors,[]);
    assert.deepEqual(httpErrors,[]);
   }
   results.push(result);
   await fs.writeFile(path.join(output,'measurements.json'),JSON.stringify(results,null,2)+'\n');
   await context.close();
  }
 }
} finally {
 await browser.close();
}
