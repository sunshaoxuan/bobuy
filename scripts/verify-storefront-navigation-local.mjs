import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
const out=new URL('../docs/reports/evidence/storefront-navigation/',import.meta.url);mkdirSync(out,{recursive:true});
const dictionary=readFileSync(new URL('../frontend/src/locales/zh-CN.ts',import.meta.url),'utf8');
function t(key){const match=dictionary.match(new RegExp(`['"]${key.replaceAll('.','\\.')}['"]:\\s*(['"])(.*?)\\1`));assert(match,key);return match[2];}
const files=JSON.parse(readFileSync(new URL('../../navigation-fixtures/files.json',import.meta.url),'utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),origin='http://127.0.0.1:18080';
const report={scope:'Synthetic local normal UI only, six public official pictures; existing shared test containers. No production authentication, data access, publication or orders.',checks:{},errors:[]};let id=process.env.BOBUY_NAV_FIXTURE_POST,published=false;
page.on('pageerror',error=>report.errors.push(error.message));
async function shot(name){await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
try {
 await page.goto(origin+'/admin');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/recommendations"]').first().waitFor();
 if(id){await page.goto(origin+'/admin/recommendations?post='+id);await page.locator('#rec-title').waitFor();}else{await page.locator('a[href="/admin/recommendations"]').first().click();await page.locator('.rec-heading .ant-btn-primary').click();await page.locator('#rec-title').waitFor();id=new URL(page.url()).searchParams.get('post');}
 if(process.env.BOBUY_NAV_REGISTERED!=='1'){
 await page.locator('#rec-title').fill('[Synthetic] 图像优先 / おすすめを探す');await page.locator('#rec-body').fill('Local synthetic visual acceptance only. 日本語と中文の読みやすさ、自然な画像比率、分類、価格と期間を確認します。');
 const rows=files.map((file,index)=>({name:['Synthetic 新鲜好物','Synthetic 日常精选','Synthetic 料理灵感','Synthetic 家居选择','Synthetic 本周发现','Synthetic 轻松采买'][index],itemNumber:'NAV-TEST-'+String(index).padStart(3,'0'),fileName:basename(file),referencePrice:980+index*100,offerStart:index===0?'2026-10-27':undefined,offerEnd:index===1?'2026-10-25':index===2?undefined:'2026-11-22',priceUnit:index===3?'100g':'package',offerNotes:'Synthetic prices/dates; source picture used for visual testing only.'}));
 await page.locator('input[type=file]').setInputFiles(files);await page.locator('#rec-batch').fill(JSON.stringify(rows));await page.getByRole('button',{name:t('rec.batch_preview'),exact:true}).click();await page.getByRole('button',{name:new RegExp(t('rec.register_all'))}).click();
 await page.getByRole('button',{name:t('class.select_results').replace('{count}','6'),exact:true}).waitFor();
 await page.getByRole('button',{name:new RegExp(t('rec.save'))}).click();await page.getByText(t('rec.saved'),{exact:true}).waitFor();await page.reload();await page.locator('#rec-title').waitFor();
 assert.equal(await page.locator('.rec-catalog-link .ant-tag').count(),6);
 await page.getByRole('button',{name:new RegExp(t('rec.draft_preview'))}).click();await page.locator('.browse-preview .rec-pin').nth(5).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('.browse-preview .product-photo img')].slice(0,4).every(img=>img.complete&&img.naturalWidth>0));
 await page.locator('.browse-preview').evaluate(element=>window.scrollTo(0,element.getBoundingClientRect().top+scrollY-80));await shot('draft-preview-desktop');
 await page.setViewportSize({width:390,height:844});await page.locator('.browse-preview').evaluate(element=>window.scrollTo(0,element.getBoundingClientRect().top+scrollY-80));await noOverflow();await shot('draft-preview-mobile');
 report.checks.normalRegistrationCreatesPrivateLinkedProfilesAndSharedPreview='PASS';
 }else{report.checks.normalRegistrationCreatesPrivateLinkedProfilesAndSharedPreview='PASS (reused prior accepted registration/preview; no re-import)';}
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:new RegExp(t('rec.publish'))}).click();await page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).waitFor();published=true;
 await page.goto(origin+'/recommendations/'+id+'?node=1000');await page.locator('.rec-pin').nth(5).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.rec-pin .product-photo img')].slice(0,4).every(img=>img.complete&&img.naturalWidth>0));
 await noOverflow();await shot('customer-desktop-populated');assert.equal(await page.locator('.browse-links a.active').count(),1);assert.equal(await page.locator('.store-header .store-recommendations-link').count(),0);
 await page.locator('.store-header .browse-search input').fill('zzzz-no-such-fixture');await page.locator('.ant-empty').waitFor();await page.locator('.store-header .browse-search input').fill('');await page.locator('.rec-pin').nth(5).waitFor();
 await page.locator('.browse-sidebar .ant-select-selector').click();await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({hasText:t('browse.all_nodes')}).click();await page.locator('.rec-pin').nth(5).waitFor();await page.goBack();await page.locator('.rec-pin').nth(5).waitFor();await page.reload();await page.locator('.rec-pin').nth(5).waitFor();
 report.checks.desktopRealNodeSelectSearchBackRefreshAndCardLayout='PASS';
 await page.setViewportSize({width:390,height:844});await noOverflow();await shot('customer-mobile-populated');
 const menu=page.getByRole('button',{name:t('app.open_menu'),exact:true});await menu.click();await page.locator('.browse-drawer .browse-links').waitFor();await shot('mobile-navigation');
 await page.locator('.browse-drawer a[href="/trips?node=1000"]').click();await page.locator('.browse-drawer').waitFor({state:'hidden'});await noOverflow();await shot('mobile-trips');
 await menu.click();await page.locator('.browse-drawer a[href="/client/trips?node=1000"]').click();await page.locator('.browse-drawer').waitFor({state:'hidden'});await noOverflow();
 report.checks.mobileDrawerNavigationClosesAndNoOverflow='PASS';
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;await shot('failure').catch(()=>{});throw error;}
finally{
 if(id&&published){await page.goto(origin+'/admin/recommendations?post='+id);await page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).click();await page.getByRole('button',{name:new RegExp(t('rec.publish'))}).waitFor();report.syntheticPostWithdrawn=true;}
 report.postId=id;writeFileSync(new URL('local-browser.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();
}
