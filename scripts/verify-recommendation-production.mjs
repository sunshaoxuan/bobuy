import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const root=new URL('../',import.meta.url),out=new URL('docs/reports/evidence/recommendation-offers-production/',root);
mkdirSync(out,{recursive:true});
const origin='https://bobuy.cc',title='Costco 2026-10-25 周报（待审阅）';
const ssh=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41'];
const credentials=JSON.parse(execFileSync('ssh',[...ssh,'cat /etc/bobuy-admin.json'],{encoding:'utf8',windowsHide:true}));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),report={release:'20261026.1',origin,data:'One intended empty Costco review draft only; zero product imports or publication',checks:{},errors:[],failedApi:[]};
page.on('pageerror',error=>report.errors.push(error.message));
page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/api/')&&response.status()>=400&&!(response.status()===401&&url.pathname.startsWith('/api/auth/')))report.failedApi.push({path:url.pathname,status:response.status()});});
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function shot(name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),fullPage:true,animations:'disabled'});}
try{
 await page.goto(origin+'/');await page.waitForFunction(()=>!document.querySelector('.store-loading'));
 for(const path of ['/api/storefront/products','/api/storefront/trips','/api/storefront/recommendations']){const response=await context.request.get(origin+path);assert.equal(response.status(),200);assert(Array.isArray((await response.json()).data));}
 assert.equal(await page.getByText('请求失败，请稍后再试',{exact:true}).count(),0);
 report.checks.publicBusinessApisAndNoLoadError='PASS';await shot('public-desktop');
 const html=await (await context.request.get(origin+'/')).text();
 const asset=html.match(/src="(\/assets\/[^\"]+\.js)"/)[1];
 assert.equal(digest(await (await context.request.get(origin+asset)).body()),digest(readFileSync(new URL('frontend/dist'+asset,root))));
 report.checks.servedEntryBytesMatchCandidate='PASS';report.entryAsset=asset;
 await page.goto(origin+'/admin');await page.locator('#username').fill(credentials.username);await page.locator('#password').fill(credentials.password);await page.locator('button[type=submit]').click();
 await page.getByRole('link',{name:'好物推荐',exact:true}).first().waitFor();
 assert.equal(await page.getByRole('link',{name:'系统设置',exact:true}).count(),0);
 await page.getByRole('link',{name:'好物推荐',exact:true}).first().click();await page.getByRole('button',{name:/新建推荐/}).waitFor();
 const existing=page.locator('.rec-list-row').filter({hasText:title});
 if(await existing.count())await existing.first().click();else await page.getByRole('button',{name:/新建推荐/}).click();
 await page.locator('#rec-title').waitFor();report.draftId=new URL(page.url()).searchParams.get('post');
 await page.locator('#rec-title').fill(title);await page.locator('#rec-body').fill('来源：https://cds2.costcojapan.jp/cds/mail-images/upz/261025_kdwc/sun25d/pc_index.html\n\n待逐项录入与人工审阅；价格、编号、优惠和券日期以单品来源为准。本草稿未公开。');
 await page.getByRole('button',{name:/保存草稿/}).click();await page.getByText('已保存',{exact:true}).waitFor();
 await page.reload();await page.locator('#rec-title').waitFor();assert.equal(await page.locator('#rec-title').inputValue(),title);
 assert.equal(await page.locator('.rec-linked .rec-product').count(),0);assert(await page.getByRole('button',{name:/发表文章/}).isDisabled());
 await page.locator('#rec-batch').fill('[{"name":"Validation only","itemNumber":123,"imageUrl":"https://cds2.costcojapan.jp/cds/mail-images/not-imported.png"}]');
 await page.getByRole('button',{name:/校验并加入预览/}).click();await page.locator('.ant-alert-error').filter({hasText:'批量资料无效'}).waitFor();
 assert.equal(await page.locator('.rec-queue .rec-upload-row').count(),0);await page.locator('#rec-batch').fill('');
 report.checks.visibleEntryDraftSaveReloadAndValidationWithoutProductWrites='PASS';
 const response=await context.request.get(origin+'/api/merchant/recommendations/'+report.draftId);const detail=(await response.json()).data;
 assert.equal(detail.post.published,false);assert.equal(detail.items.length,0);
 report.draftUrl=origin+'/admin/recommendations?post='+report.draftId;
 await shot('admin-draft-desktop');await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('admin-draft-mobile');
 const cookies=await context.cookies();assert(cookies.some(cookie=>cookie.httpOnly&&cookie.secure&&cookie.name.includes('refresh')));
 report.checks.secureLoginAndMobile='PASS';
 const anonymous=await browser.newContext();const feed=await anonymous.request.get(origin+'/api/storefront/recommendations');assert.equal(feed.status(),200);assert.deepEqual((await feed.json()).data,[]);await anonymous.close();
 report.checks.draftNotPublic='PASS';assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedApi,[]);report.result='PASS';
}catch(error){report.failure=error.stack;report.result='FAIL';await shot('failure').catch(()=>{});throw error;}
finally{writeFileSync(new URL('browser.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
