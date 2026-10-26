import assert from 'node:assert/strict';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const origin='http://127.0.0.1:18080',id=process.env.BOBUY_NAV_FIXTURE_POST||'12';assert(/^\d+$/.test(id));
const out=new URL('../docs/reports/evidence/storefront-navigation/',import.meta.url);mkdirSync(out,{recursive:true});
const dictionary=readFileSync(new URL('../frontend/src/locales/zh-CN.ts',import.meta.url),'utf8');
function t(key){const match=dictionary.match(new RegExp(`['"]${key.replaceAll('.','\\.')}['"]:\\s*(['"])(.*?)\\1`));assert(match,key);return match[2];}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('bobbuy_locale','zh-CN'));
const page=await context.newPage(),report={scope:'Final scoped visual check using existing synthetic local fixture; no re-import or production access',postId:id,errors:[]};let published=false;
page.on('pageerror',error=>report.errors.push(error.message));
async function shot(name){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:fileURLToPath(new URL(name+'.png',out)),animations:'disabled'});}
try{
 await page.goto(origin+'/admin');await page.locator('#username').fill('agent');await page.locator('#password').fill('agent-pass');await page.locator('button[type=submit]').click();await page.locator('a[href="/admin/recommendations"]').first().waitFor();
 const response=page.waitForResponse(value=>new URL(value.url()).pathname==='/api/merchant/recommendations/'+id&&value.request().method()==='GET');await page.goto(origin+'/admin/recommendations?post='+id);const detail=(await (await response).json()).data;
 assert(detail.post.title.startsWith('[Synthetic]'));assert.equal(detail.items.length,6);assert.equal(detail.post.published,false);
 await page.getByRole('button',{name:new RegExp(t('rec.draft_preview'))}).click();await page.locator('.browse-preview .rec-pin').nth(5).waitFor();
 await page.locator('.browse-preview').evaluate(element=>scrollTo(0,element.getBoundingClientRect().top+scrollY-80));await shot('draft-preview-desktop-final');
 await page.setViewportSize({width:390,height:844});await page.locator('.browse-preview').evaluate(element=>scrollTo(0,element.getBoundingClientRect().top+scrollY-80));await shot('draft-preview-mobile-final');
 await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:new RegExp(t('rec.publish'))}).click();await page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).waitFor();published=true;
 await page.goto(origin+'/recommendations/'+id+'?node=1000');await page.locator('.rec-pin').nth(5).waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.rec-pin .product-photo img')].slice(0,4).every(img=>img.complete&&img.naturalWidth>0));await shot('customer-desktop-final');
 await page.setViewportSize({width:390,height:844});const search=await page.locator('.store-header .browse-search').boundingBox();assert(search.width>=340);await shot('customer-mobile-final');
 await page.locator('.rec-pin').first().evaluate(element=>scrollTo(0,element.getBoundingClientRect().top+scrollY-132));await shot('customer-mobile-cards-final');
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(error){report.result='FAIL';report.failure=error.stack;throw error;}
finally{if(published){await page.goto(origin+'/admin/recommendations?post='+id);await page.getByRole('button',{name:new RegExp(t('rec.withdraw'))}).click();await page.getByRole('button',{name:new RegExp(t('rec.publish'))}).waitFor();report.syntheticPostWithdrawn=true;}writeFileSync(new URL('final-visual.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
