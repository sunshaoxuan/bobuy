import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';
const out=new URL('../docs/reports/evidence/postgres18-storage/',import.meta.url);
const id=execFileSync('docker',['exec','bobuy-local-postgres-1','psql','-X','-U','bobuy','-d','bobuy','-qAt','-v','ON_ERROR_STOP=1','-c',"BEGIN READ ONLY; SELECT id FROM bb_recommendation_image WHERE access_scope='PUBLIC' ORDER BY id LIMIT 1; ROLLBACK;"],{encoding:'utf8'}).trim().split('\n').find(v=>/^[a-f0-9-]{36}$/.test(v));
assert(id,'An existing PUBLIC synthetic image is required');
const url='/api/storefront/recommendation-images/'+id;
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const result={scope:'Existing local fixture public bytes; browser-only gallery binding because stored local published fixtures have no galleries; no database/content writes or production replay; this checks image delivery rather than product/image matching',checks:{},errors:[],writes:[]};
page.on('pageerror',e=>result.errors.push(e.message));
page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(r.method()))result.writes.push(r.method()+' '+new URL(r.url()).pathname);});
// Bind an existing public image only in read responses seen by this browser.
// The image response itself always comes from the actual candidate backend.
await context.route('**/api/storefront/recommendations**',async route=>{
 const response=await route.fetch();const body=await response.json();
 const details=Array.isArray(body.data)?body.data:[body.data];
 for(const detail of details)if(detail?.items?.length)detail.items[0].gallery=[{url,sourceUrl:'https://example.invalid/synthetic-fixture',imageId:id}];
 await route.fulfill({response,json:body});
});
try{
 const response=await context.request.get(origin+url);assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/^image\/(png|jpeg)/);assert((await response.body()).length>0);result.checks.anonymousActualPublicBytes='PASS';
 await page.goto(origin+'/recommendations');
 const image=page.locator('.rec-pin .product-photo img').first();await image.waitFor();
 await page.waitForFunction(()=>{const i=document.querySelector('.rec-pin .product-photo img');return i?.complete&&i.naturalWidth>0;});
 assert.equal(await image.getAttribute('src'),url);result.checks.publicCardImageLoaded='PASS';
 for(const [name,size] of [['public-images-desktop',{width:1440,height:1000}],['public-images-mobile',{width:390,height:844}]]){
  await page.setViewportSize(size);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await image.scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});
 }
 result.checks.desktopAndMobileNoOverflow='PASS';assert.deepEqual(result.errors,[]);assert.deepEqual(result.writes,[]);
 result.result='PASS';
}catch(e){result.result='FAIL';result.failure=e.stack;throw e;}
finally{writeFileSync(new URL('public-browser.json',out),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));await browser.close();}
