import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';

const production=process.env.BOBUY_VERIFY_ORIGIN==='https://bobuy.cc';
const origin=production?'https://bobuy.cc':'http://127.0.0.1:18080';
const output=new URL(`../../docs/reports/evidence/PLAN60/${production?'production':'local'}/`,import.meta.url);
mkdirSync(output,{recursive:true});
const credentials=production?JSON.parse(execFileSync('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','cat /etc/bobuy-admin.json'],{encoding:'utf8'})):{username:'agent',password:'agent-pass'};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
try {
  for(const width of [360,390]) {
    const context=await browser.newContext({viewport:{width,height:844}});
    const page=await context.newPage();
    await page.goto(origin+'/admin');
    await page.locator('#username').fill(credentials.username);
    await page.locator('#password').fill(credentials.password);
    await page.locator('button[type="submit"]').click();
    await page.locator('.merchant-menu-toggle').waitFor();
    await page.goto(origin+'/admin/trips'); await page.waitForLoadState('networkidle');
    await page.locator('.merchant-menu-toggle').click();
    await page.locator('.merchant-drawer a[href="/admin/trips"]').hover();
    assert.equal(await page.locator('.merchant-drawer .ant-menu-item-selected a').getAttribute('href'),'/admin/trips');
    await page.screenshot({path:fileURLToPath(new URL(`menu-active-${width}.png`,output)),animations:'disabled'});
    await page.locator('.merchant-drawer .ant-drawer-close').click();
    await page.locator('.merchant-drawer').waitFor({state:'hidden'});
    const selectors=['.trip-editor .ant-select-selector',...(!production?['.trip-list-section .ant-select-selector']:[])];
    for(const [index,selector] of selectors.entries()) {
      if(index) await page.locator('.trip-list-section .ant-table-content').evaluate(element=>{element.scrollLeft=element.scrollWidth;});
      await page.locator(selector).first().click();
      const popup=page.locator('.ant-select-dropdown:visible');
      await popup.waitFor();
      await popup.locator('.ant-select-item-option').last().hover();
      const bounds=await popup.boundingBox();
      assert(bounds.x>=0 && bounds.x+bounds.width<=width && bounds.y>=0 && bounds.y+bounds.height<=844,JSON.stringify(bounds));
      await page.screenshot({path:fileURLToPath(new URL(`status-open-${width}-${index}.png`,output)),animations:'disabled'});
      results.push({width,target:index?'table status':'form status',bounds,options:await popup.innerText()});
      await page.keyboard.press('Escape');
      await popup.waitFor({state:'hidden'});
    }
    await context.close();
  }
  writeFileSync(new URL('overlay-report.json',output),JSON.stringify({status:'PASS',results},null,2));
  console.log('PASS: mobile active navigation and status overlays remain inside the viewport');
} finally { await browser.close(); }
