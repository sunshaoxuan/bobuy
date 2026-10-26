import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const origin='http://127.0.0.1:18080';
const output=new URL('../docs/reports/evidence/recommendation-offers/',import.meta.url);
mkdirSync(output,{recursive:true});
const report={origin,data:'Synthetic fixtures entered through visible UI only; no production data',checks:{},errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage();
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
let id;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfRoAAAAASUVORK5CYII=','base64');
const rows=[
 {name:'Synthetic meat per 100g',itemNumber:'00123',referencePrice:400,originalPrice:500,discountAmount:100,priceUnit:'100g',offerStart:'2026-10-26',offerEnd:'2026-11-22'},
 {name:'Synthetic unknown facts'},
 {name:'Synthetic end only',itemNumber:'END',offerEnd:'2026-11-01'},
 {name:'Synthetic start only',itemNumber:'START',offerStart:'2027-01-01'},
 {name:'Synthetic expired',itemNumber:'OLD',referencePrice:200,offerEnd:'2026-10-25'},
 {name:'Synthetic coupon exception',itemNumber:'COUPON',referencePrice:900,couponStart:'2026-10-20',couponEnd:'2026-10-25',offerStart:'2026-11-01',offerEnd:'2026-11-08',offerNotes:'Coupon issue and redemption are separate; this item has its own dates.'}
].map((row,index)=>({...row,fileName:`synthetic-${index}.png`}));
async function shot(name,locator=page){await locator.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:locator===page,animations:'disabled'});}
async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function addRows(values){
 await page.locator('input[type=file]').setInputFiles(values.map(value=>({name:value.fileName,mimeType:'image/png',buffer:png})));
 await page.locator('#rec-batch').fill(JSON.stringify(values));
 await page.getByRole('button',{name:/校验并加入预览/}).click();
 await page.getByText('已加入待审预览；尚未保存或公开，请逐项核对后登记。',{exact:true}).waitFor();
}
try {
 await page.goto(origin+'/admin');
 await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');
 await page.locator('button[type=submit]').click();await page.waitForURL('**/admin/users');
 await page.getByRole('link',{name:/好物推荐/}).first().click();
 await page.getByRole('button',{name:/新建推荐/}).click();
 await page.waitForURL('**/admin/recommendations?post=*');id=new URL(page.url()).searchParams.get('post');
 await page.locator('#rec-title').fill('[Synthetic acceptance] Costco offer facts');
 await page.locator('#rec-body').fill('Synthetic UI acceptance only. Not actual Costco products or prices.');
 await page.locator('#rec-batch').fill(JSON.stringify([{...rows[0],itemNumber:123}]));
 await page.getByRole('button',{name:/校验并加入预览/}).click();
 await page.locator('.ant-alert-error').filter({hasText:'批量资料无效'}).waitFor();
 assert.equal(await page.locator('.rec-queue .rec-upload-row').count(),0);
 report.checks.invalidNumericCodeRejectedBeforeSave='PASS';
 await addRows(rows);
 assert.equal(await page.locator('.rec-linked .rec-product').count(),0);
 await noOverflow();await shot('queue-desktop',page.locator('.rec-uploads'));
 await page.getByRole('button',{name:/登记全部/}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.rec-linked .rec-product').length===6);
 await page.locator('.rec-upload-status').filter({hasText:'推荐资料已登记'}).first().waitFor();
 await page.getByRole('button',{name:/客户效果预览/}).click();
 assert((await page.locator('.rec-draft-preview').innerText()).includes('来源未注明'));
 await shot('draft-preview',page.locator('.rec-draft-preview'));
 report.checks.previewRegisterOptionalFacts='PASS';
 // Exact source code + image retry reuses its saved row instead of creating stock.
 await addRows([rows[0]]);await page.getByRole('button',{name:/登记全部/}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.rec-upload-status')].every(element=>!element.textContent.includes('待登记')));
 assert.equal(await page.locator('.rec-linked .rec-product').count(),6);
 report.checks.exactDedup='PASS';
 const first=page.locator('.rec-linked .rec-product').first();
 await first.getByRole('button',{name:/编辑商品资料: Synthetic meat per 100g/}).click();
 await first.getByLabel('优惠 / 兑换结束日',{exact:true}).fill('2026-10-01');
 await first.getByRole('button',{name:/保存商品资料/}).click();
 await page.locator('.ant-alert-error').filter({hasText:'检查价格与日期'}).waitFor();
 await first.getByLabel('优惠 / 兑换结束日',{exact:true}).fill('2026-11-21');
 await first.getByRole('button',{name:/保存商品资料/}).click();
 await first.getByRole('button',{name:/保存商品资料/}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:/保存草稿/}).click();
 await page.getByText('已保存',{exact:true}).waitFor();
 await page.reload();await page.locator('#rec-title').waitFor();
 assert((await page.locator('.rec-linked').innerText()).includes('2026-11-21'));
 report.checks.editValidationCorrectionPersistence='PASS';
 await page.setViewportSize({width:390,height:844});await noOverflow();await shot('editor-mobile');
 await page.getByRole('button',{name:/发表文章/}).click();
 await page.getByRole('button',{name:/撤回编辑/}).waitFor();
 await page.goto(origin+'/recommendations/'+id);
 await page.locator('.rec-public-products .rec-pin').nth(5).waitFor();await noOverflow();
 const text=await page.locator('.rec-public-products').innerText();
 for(const expected of ['00123','100g','500 JPY','400 JPY','2026-11-21','来源未注明期间','截至 2026-11-01','自 2027-01-01','优惠期间已结束','券发放期间','2026-10-20','2026-11-08']) assert(text.includes(expected),expected);
 await shot('customer-mobile');report.checks.customerSingleEndedUnknownExpiredUpcomingExceptionAndCouponMobile='PASS';
 await page.setViewportSize({width:1440,height:1000});await noOverflow();await shot('customer-desktop');
 await page.goto(origin+'/admin/recommendations?post='+id);
 await page.getByRole('button',{name:/撤回编辑/}).click();await page.getByRole('button',{name:/发表文章/}).waitFor();
 report.checks.fixtureWithdrawn='PASS';
 report.result=report.errors.length?'FAIL':'PASS';
} catch(error){report.failure=error.stack;report.result='FAIL';await shot('failure').catch(()=>{});throw error;}
finally{report.postId=id;writeFileSync(new URL('ui.json',output),JSON.stringify(report,null,2)+'\n');await browser.close();}
