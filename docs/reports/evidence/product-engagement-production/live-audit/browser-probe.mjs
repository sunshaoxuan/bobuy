import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=process.cwd(),out=resolve(repo,'docs/reports/evidence/product-engagement-production/live-audit');
const {chromium}=await import(pathToFileURL(resolve(repo,'../../frontend/node_modules/playwright-core/index.mjs')).href);
const runtime=JSON.parse(readFileSync(resolve(out,'runtime-after-change.json'),'utf8'));
const expected=new Map(runtime.frontendFiles.split('\n').map(line=>{const [hash,path]=line.split(/\s+/);return[path.replace('/usr/share/nginx/html',''),hash];}));
const result={observedAt:new Date().toISOString(),frontend:runtime.containers['bobuy-frontend'],console:[],network:[],blockedWrites:[],suppressedTelemetry:0,assetMismatches:[],assets:{},views:[],requests:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const pending=[];
try{
 for(const width of [1440,360]){
  const ctx=await browser.newContext({viewport:{width,height:900}});
  await ctx.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
  await ctx.route('**/*',route=>{const method=route.request().method(),path=new URL(route.request().url()).pathname;if(method==='POST'&&path==='/cdn-cgi/rum'){result.suppressedTelemetry++;return route.fulfill({status:204,body:''});}if(!['GET','HEAD','OPTIONS'].includes(method)){result.blockedWrites.push({method,path});return route.abort();}return route.continue();});
  const page=await ctx.newPage();
  page.on('pageerror',error=>result.console.push(error.message));
  page.on('console',message=>{if(message.type()==='error')result.console.push(message.text());});
  page.on('request',request=>result.requests.push({method:request.method(),path:new URL(request.url()).pathname}));
  page.on('response',response=>{
   const path=new URL(response.url()).pathname;
   if(response.status()>=400)result.network.push({path,status:response.status()});
   if(/\.(js|css)$/.test(path))pending.push(response.body().then(body=>{const hash=createHash('sha256').update(body).digest('hex');if(hash!==expected.get(path))result.assetMismatches.push({path,actual:hash,expected:expected.get(path)??null});result.assets[path]=hash;}).catch(error=>result.assetMismatches.push({path,error:error.message})));
  });
  for(const route of ['products','recommendations']){
   await page.goto('https://bobuy.cc/'+route);
   const cards=page.locator('.compact-product-card');await cards.first().waitFor();
   const sort=page.locator('.product-sort').first();assert.equal(await sort.locator('option').count(),7);
   const sorts=[];
   for(const value of ['price-asc','price-desc','rating-asc','rating-desc','heat-asc','heat-desc','default']){
    if(await sort.inputValue()!==value){const response=page.waitForResponse(r=>r.status()===200&&r.url().includes('sort='+value)&&r.url().includes('browse'));await sort.selectOption(value);await response;}
    sorts.push(value);
   }
   await cards.first().locator('.product-popularity').waitFor({state:'visible'});
   await page.waitForFunction(()=>{const values=[...document.querySelectorAll('.product-popularity')];return values.length>0&&values.every(e=>!e.textContent.includes('…'));});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   const first=cards.first();assert.equal(await first.locator('.product-popularity').count(),1);assert.equal(await first.locator('.ant-rate-star').count(),5);
   await page.waitForFunction(()=>[...document.querySelectorAll('.compact-product-card')].slice(0,5).every(c=>[...c.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)));
   await page.screenshot({path:resolve(out,`${route}-${width}.png`)});
   result.views.push({route,width,cards:await cards.count(),sorts,heat:await first.locator('.product-popularity').innerText(),stars:5,noHorizontalOverflow:true});
  }
  await Promise.all(pending);await ctx.close();
 }
 assert.deepEqual(result.console,[]);assert.deepEqual(result.network,[]);assert.deepEqual(result.blockedWrites,[]);assert.deepEqual(result.assetMismatches,[]);
 result.result='PASS';
}finally{await browser.close();writeFileSync(resolve(out,'browser.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify({result:result.result,views:result.views,matchedAssets:Object.keys(result.assets).length,blockedBusinessWrites:result.blockedWrites.length,suppressedTelemetry:result.suppressedTelemetry,console:result.console,network:result.network}));
