import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='https://bobuy.cc',out=new URL('../docs/reports/evidence/gallery-follow-production/',import.meta.url);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),report={scope:'Read-only production APIs, actual customer UI and normal admin login entry; no credentials, content writes, orders or payments',checks:{},errors:[],writes:[],nonBusinessPosts:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method())){const path=new URL(r.url()).pathname;(path==='/cdn-cgi/rum'?report.nonBusinessPosts:report.writes).push({method:r.method(),path});}});
const digest=b=>createHash('sha256').update(b).digest('hex');
async function get(path){const r=await context.request.get(origin+path);assert.equal(r.status(),200,path);return (await r.json()).data;}
function project(value,template){if(Array.isArray(template)){assert.equal(value.length,template.length);return template.map((row,i)=>project(value[i],row));}if(template&&typeof template==='object')return Object.fromEntries(Object.keys(template).map(key=>[key,project(value[key],template[key])]));return value;}
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
try{
 const posts=await get('/api/storefront/recommendations'),products=await get('/api/storefront/products'),currencies=await get('/api/storefront/currencies');await get('/api/storefront/trips');
 const snapshot={posts,products,currencies};
 if(process.argv.includes('--before')){writeFileSync(new URL('public-before.json',out),JSON.stringify(snapshot,null,2)+'\n');console.log('PASS: read-only pre-release public content snapshot');}
 else{
  const before=JSON.parse(readFileSync(new URL('public-before.json',out),'utf8'));assert.deepEqual(project(snapshot,before),before);
  for(const [id,count]of [[1,122],[2,30]]){const entry=posts.find(p=>p.post.id===id);assert(entry?.post.published);assert.equal(entry.items.length,count);assert(entry.items.every(i=>!i.showSupplier));}
  report.checks.published152AllPreexistingPublicFieldsAndPurchaseStatePreserved='PASS';
  await page.goto(origin+'/recommendations/1');await page.locator('.rec-pin').nth(121).waitFor();await shot('customer-desktop');
  await page.setViewportSize({width:390,height:844});await shot('customer-mobile');
  await page.locator('.rec-pin .product-photo').first().click();await page.locator('.rec-product-detail').waitFor();await shot('customer-detail-mobile');report.checks.actualCustomerDesktopMobileAndDetail='PASS';
  await page.goto(origin+'/admin/stock-master');await page.locator('#username').waitFor();report.checks.normalVisibleAdminLoginEntry='PASS';
  const index=await context.request.get(origin+'/');assert.equal(digest(await index.body()),digest(readFileSync(new URL('../frontend/dist/index.html',import.meta.url))));
  const names=readdirSync(new URL('../frontend/dist/assets/',import.meta.url));
  for(const prefix of ['stock-master-','Recommendations-','PublicRecommendations-']){
   const name=names.find(n=>n.startsWith(prefix)&&n.endsWith('.js'));assert(name,prefix);const r=await context.request.get(origin+'/assets/'+name);assert.equal(r.status(),200);assert.equal(digest(await r.body()),digest(readFileSync(new URL('../frontend/dist/assets/'+name,import.meta.url))));
  }
  report.checks.acceptedMasterEditorAndCustomerAssetBytesServed='PASS';
  const protectedResponse=await context.request.get(origin+'/api/merchant/product-pricing/readonly-verification');assert([401,403].includes(protectedResponse.status()));report.checks.pricingEndpointRequiresAuthentication='PASS';
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.writes,[]);report.result='PASS';writeFileSync(new URL('public-browser.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }
}catch(error){report.result='FAIL';report.failure=error.stack;writeFileSync(new URL('public-browser.json',out),JSON.stringify(report,null,2)+'\n');throw error;}
finally{await browser.close();}
