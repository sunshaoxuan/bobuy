import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const root=new URL('../',import.meta.url),out=new URL('docs/reports/evidence/storefront-navigation-production/',root);mkdirSync(out,{recursive:true});
const dictionary=readFileSync(new URL('frontend/src/locales/zh-CN.ts',root),'utf8');
function t(key){const match=dictionary.match(new RegExp(`['"]${key.replaceAll('.','\\.')}['"]:\\s*(['"])(.*?)\\1`));assert(match,key);return match[2];}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await context.newPage();
const report={release:'20261026.3',scope:'Public production UI/API/static-byte verification only. No credentials, private draft reads, content writes, orders or payments.',checks:{},errors:[],failedApi:[],writes:[]};
page.on('pageerror',error=>report.errors.push(error.message));page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method()))report.writes.push(request.method()+' '+new URL(request.url()).pathname);});
page.on('response',response=>{const path=new URL(response.url()).pathname;if(path.startsWith('/api/')&&response.status()>=400)report.failedApi.push({path,status:response.status()});});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 for(const path of ['/api/storefront/products','/api/storefront/trips','/api/storefront/recommendations','/api/storefront/recommendation-nodes']){const response=await context.request.get('https://bobuy.cc'+path);assert.equal(response.status(),200);const data=(await response.json()).data;assert(Array.isArray(data));if(path==='/api/storefront/recommendations')assert(data.every(value=>![1,2].includes(value.post.id)));}
 await page.goto('https://bobuy.cc/recommendations');await page.locator('.rec-category-filters button').first().waitFor();assert(await page.locator('.browse-sidebar').isVisible());assert.equal(await page.locator('.browse-links a.active').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('public-desktop.png',out)),animations:'disabled'});
 const index=readFileSync(new URL('frontend/dist/index.html',root),'utf8'),served=await context.request.get('https://bobuy.cc/');assert.equal(hash(await served.body()),hash(Buffer.from(index)));
 const assets=readdirSync(new URL('frontend/dist/assets/',root));const selected=[...index.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match=>match[1]);
 for(const prefix of ['Recommendations-','PublicRecommendations-'])for(const name of assets.filter(value=>value.startsWith(prefix)&&value.endsWith('.js')))selected.push('/assets/'+name);
 for(const path of selected){const response=await context.request.get('https://bobuy.cc'+path);assert.equal(response.status(),200);assert.equal(hash(await response.body()),hash(readFileSync(new URL('frontend/dist'+path,root))));}
 report.checks.publicApiNavigationAndAcceptedStaticBytes='PASS';
 await page.setViewportSize({width:390,height:844});const search=await page.locator('.store-header .browse-search').boundingBox();assert(search.width>=340);await page.screenshot({path:fileURLToPath(new URL('public-mobile.png',out)),animations:'disabled'});
 await page.locator('.browse-menu-toggle').click();await page.locator('.browse-drawer .browse-links').waitFor();await page.screenshot({path:fileURLToPath(new URL('navigation-mobile.png',out)),animations:'disabled'});
 await page.locator('.browse-drawer a[href="/trips"]').click();await page.locator('.browse-drawer').waitFor({state:'hidden'});await page.getByRole('heading',{name:t('browse.bookable'),exact:true}).waitFor();
 await page.reload();await page.getByRole('heading',{name:t('browse.bookable'),exact:true}).waitFor();await page.goBack();await page.locator('.rec-public').waitFor();
 await page.goto('https://bobuy.cc/client/trips');await page.getByText(t('browse.signin_trips'),{exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 report.checks.mobileSearchDrawerRouteRefreshBackAndProtectedHistory='PASS';
 await page.goto('https://bobuy.cc/admin/recommendations?post=1');await page.locator('#username').waitFor();report.checks.adminNormalLoginEntry='PASS';
 report.privateProductionPreview='Pending parent verification through its existing authenticated normal UI; local populated shared preview already passed.';
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedApi,[]);assert.deepEqual(report.writes,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:fileURLToPath(new URL('failure.png',out)),animations:'disabled'}).catch(()=>{});throw error;}
finally{writeFileSync(new URL('browser.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
