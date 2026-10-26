import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const root=new URL('../',import.meta.url),out=new URL('docs/reports/evidence/recommendation-classification-production/',root);mkdirSync(out,{recursive:true});
const ssh=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41'];
const credentials=JSON.parse(execFileSync('ssh',[...ssh,'cat /etc/bobuy-admin.json'],{encoding:'utf8',windowsHide:true}));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));const page=await context.newPage();
const report={release:'20261026.2',scope:'Read-only production UI/API/artifact verification. Never click create/save/assign/publish or modify real draft.',checks:{},errors:[],failedApi:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{const path=new URL(r.url()).pathname;if(path.startsWith('/api/')&&r.status()>=400&&!(r.status()===401&&path.startsWith('/api/auth/')))report.failedApi.push({path,status:r.status()});});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 await page.goto('https://bobuy.cc/');for(const path of ['/api/storefront/products','/api/storefront/trips','/api/storefront/recommendations']){const response=await context.request.get('https://bobuy.cc'+path);assert.equal(response.status(),200);assert(Array.isArray((await response.json()).data));}
 await page.goto('https://bobuy.cc/admin');await page.locator('#username').fill(credentials.username);await page.locator('#password').fill(credentials.password);await page.locator('button[type=submit]').click();await page.getByRole('link',{name:'好物推荐',exact:true}).first().waitFor();
 const detailResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/merchant/recommendations/1'&&r.request().method()==='GET');
 const optionsResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/merchant/recommendation-taxonomy'&&r.request().method()==='GET');
 await page.goto('https://bobuy.cc/admin/recommendations?post=1');const detail=(await (await detailResponse).json()).data;
 assert.equal(detail.items.length,122);assert.equal(detail.post.published,false);assert(detail.items.every(item=>Array.isArray(item.categoryIds)&&!item.showSupplier));
 assert.equal((await optionsResponse).status(),200);await page.getByRole('heading',{name:'分类与供应商',exact:true}).waitFor();
 await page.getByRole('button',{name:'选择全部结果（122）',exact:true}).waitFor();assert.equal(await page.getByRole('checkbox',{name:'向客户显示供应商',exact:true}).isChecked(),false);
 assert.equal(await page.getByRole('button',{name:'应用到已选商品',exact:true}).isDisabled(),true);
 report.checks.real122DraftOpenedWithoutMutationDefaultSupplierHidden='PASS';
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL('admin-'+width+'.png',out)),fullPage:true,animations:'disabled'});}
 const names=readdirSync(new URL('frontend/dist/assets/',root));for(const prefix of ['Recommendations-','PublicRecommendations-']){const name=names.find(value=>value.startsWith(prefix)&&value.endsWith('.js'));const response=await context.request.get('https://bobuy.cc/assets/'+name);assert.equal(response.status(),200);assert.equal(hash(await response.body()),hash(readFileSync(new URL('frontend/dist/assets/'+name,root))));}
 report.checks.acceptedAdminCustomerClassificationBytesAndMobile='PASS';
 await page.goto('https://bobuy.cc/recommendations');await page.getByText('暂无已发表文章',{exact:true}).waitFor();await page.getByRole('navigation',{name:'商品分类筛选',exact:true}).waitFor();
 assert.equal(await page.locator('.rec-category-filters button').count(),1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('customer-empty-mobile.png',out)),fullPage:true,animations:'disabled'});
 report.checks.draftNotPublishedAndAllFilterAlwaysPresent='PASS';assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedApi,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;await page.screenshot({path:fileURLToPath(new URL('failure.png',out)),fullPage:true}).catch(()=>{});throw error;}
finally{writeFileSync(new URL('browser.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
