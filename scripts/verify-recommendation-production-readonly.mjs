import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const root=new URL('../',import.meta.url),out=new URL('docs/reports/evidence/recommendation-offers-production/',root);
mkdirSync(out,{recursive:true});
const origin='https://bobuy.cc';
const ssh=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41'];
const credentials=JSON.parse(execFileSync('ssh',[...ssh,'cat /etc/bobuy-admin.json'],{encoding:'utf8',windowsHide:true}));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),report={release:'20261026.1',origin,data:'Read-only production business/UI verification; no draft or product creation/save/publication',checks:{},errors:[],failedApi:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/')&&response.status()>=400&&!(response.status()===401&&url.pathname.startsWith('/api/auth/')))report.failedApi.push({path:url.pathname,status:response.status()});});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function shot(name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true,animations:'disabled'});}
try{
 await page.goto(origin+'/');
 for(const path of ['/api/storefront/products','/api/storefront/trips','/api/storefront/recommendations']){
  const response=await context.request.get(origin+path);assert.equal(response.status(),200);assert(Array.isArray((await response.json()).data));
 }
 await page.locator('.store-header').waitFor();
 assert.equal(await page.getByText('请求失败，请稍后再试',{exact:true}).count(),0);
 report.checks.publicBusinessApisAndNoLoadError='PASS';await shot('public-desktop');
 const html=await (await context.request.get(origin+'/')).text();
 const asset=html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
 assert.equal(digest(await (await context.request.get(origin+asset)).body()),digest(readFileSync(new URL('frontend/dist'+asset,root))));
 report.checks.servedEntryBytesMatchCandidate='PASS';report.entryAsset=asset;
 // Verify the deployed editor/public offer chunks against the locally accepted
 // candidate bytes without invoking any create/save/import/publication action.
 const assets=await import('node:fs');
 const names=assets.readdirSync(new URL('frontend/dist/assets/',root));
 for(const prefix of ['Recommendations-','PublicRecommendations-']){
  const name=names.find(value=>value.startsWith(prefix)&&value.endsWith('.js'));assert(name);
  const response=await context.request.get(origin+'/assets/'+name);assert.equal(response.status(),200);
  assert.equal(digest(await response.body()),digest(readFileSync(new URL('frontend/dist/assets/'+name,root))));
 }
 report.checks.acceptedEditorAndCustomerOfferChunksServed='PASS';
 await page.goto(origin+'/admin');await page.locator('#username').fill(credentials.username);await page.locator('#password').fill(credentials.password);await page.locator('button[type=submit]').click();
 await page.getByRole('link',{name:'好物推荐',exact:true}).first().waitFor();
 assert.equal(await page.getByRole('link',{name:'系统设置',exact:true}).count(),0);
 const listResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/merchant/recommendations'&&response.request().method()==='GET');
 await page.getByRole('link',{name:'好物推荐',exact:true}).first().click();await page.getByRole('button',{name:/新建推荐/}).waitFor();
 const response=await listResponse;assert.equal(response.status(),200);assert.deepEqual((await response.json()).data,[]);
 assert.equal(await page.locator('.rec-list-row').count(),0);report.checks.normalLoginVisibleRecommendationEntryAndEmptyDraftList='PASS';
 await shot('admin-recommendations-desktop');await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('admin-recommendations-mobile');
 const cookies=await context.cookies();assert(cookies.some(cookie=>cookie.httpOnly&&cookie.secure&&cookie.name.includes('refresh')));report.checks.secureLoginAndMobile='PASS';
 await page.goto(origin+'/recommendations');await page.getByText('暂无已发表文章',{exact:true}).waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('public-recommendations-mobile');
 report.checks.publicRecommendationEmptyState='PASS';assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedApi,[]);report.result='PASS';
 report.productionDraftSave='NOT EXECUTED: automatic approval denied the draft-writing verifier; local synthetic save/reload evidence is preserved.';
}catch(error){report.failure=error.stack;report.result='FAIL';await shot('failure').catch(()=>{});throw error;}
finally{writeFileSync(new URL('browser-readonly.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
