import assert from 'node:assert/strict';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const out=new URL('../docs/reports/evidence/storefront-navigation/',import.meta.url);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),page=await browser.newPage({viewport:{width:390,height:844}});
const report={scope:'Narrow local mobile search/font polish; no content writes',errors:[]};page.on('pageerror',error=>report.errors.push(error.message));
try{
 for(let attempt=0;attempt<40;attempt++){try{if((await fetch('http://127.0.0.1:18080/api/storefront/trips')).status===200)break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 await page.goto('http://127.0.0.1:18080/trips?node=1000');await page.locator('.browse-trip-card').waitFor();
 const box=await page.locator('.store-header .browse-search').boundingBox();assert(box.width>=340);
 report.font=await page.locator('.storefront').evaluate(element=>getComputedStyle(element).fontFamily);assert(report.font.includes('Segoe UI'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:fileURLToPath(new URL('mobile-trips-polished.png',out)),animations:'disabled'});
 await page.locator('.browse-menu-toggle').click();await page.locator('.browse-drawer .browse-links').waitFor();
 report.brandColor=await page.locator('.browse-drawer .browse-brand').evaluate(element=>getComputedStyle(element).color);assert.equal(report.brandColor,'rgb(35, 35, 35)');
 await page.screenshot({path:fileURLToPath(new URL('mobile-navigation-polished.png',out)),animations:'disabled'});
 assert.deepEqual(report.errors,[]);report.result='PASS';
}finally{writeFileSync(new URL('polish.json',out),JSON.stringify(report,null,2)+'\n');await browser.close();}
