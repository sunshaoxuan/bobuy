import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '../node_modules/playwright-core/index.mjs';
import { measureMerchantControls } from './measure-merchant.mjs';

const origin = process.env.BOBUY_VERIFY_ORIGIN || 'http://127.0.0.1:18080';
const production = origin === 'https://bobuy.cc';
assert(production || origin === 'http://127.0.0.1:18080');
const output = new URL(`../../docs/reports/evidence/PLAN60/${production ? 'production' : 'local'}/`, import.meta.url);
mkdirSync(output, { recursive: true });
const credentials = production ? JSON.parse(execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', 'C:/workspace/Secure/sunsxaws.pem', 'root@185.184.223.41', 'cat /etc/bobuy-admin.json'], { encoding: 'utf8' })) : { username: 'agent', password: 'agent-pass' };
const languages = [
  ['zh-CN', '简体中文', '宝宝败'], ['en-US', 'English', 'BoBuy'],
  ['ja-JP', '日本語', 'ボボバイ'], ['zh-TW', '繁體中文', '寶寶敗'],
];
const browser = await chromium.launch({ executablePath: process.env.BOBUY_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = { origin, data: production ? 'Existing empty production catalog; no business writes' : 'Local seeded test catalog', views: [] };
const screenshot = async (page, name, locator) => locator ? locator.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), animations:'disabled' }) : page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), fullPage: !name.startsWith('menu-'), animations:'disabled' });
const settle = async page => {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('.ant-skeleton'));
};
async function selectLanguage(page, locale, name, brand) {
  await page.locator('.language-switcher:visible').click();
  await page.getByRole('menuitem').filter({ hasText: name }).click();
  await page.locator('.ant-dropdown:visible').waitFor({state:'hidden'});
  await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
  assert.equal(await page.title(), brand);
  assert.equal(await page.evaluate(() => localStorage.getItem('bobbuy_locale')), locale);
}
async function layout(page, width) {
  return page.evaluate(width => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
    const main = rect('.merchant-content'), header = rect('.merchant-header');
    const columns = getComputedStyle(document.querySelector('.trip-form-grid')).gridTemplateColumns.split(' ').length;
    return { main, header, columns, valid:Math.abs(main.y-header.height) < 1 && (width < 768 ? main.x === 0 && columns === 1 : main.x === 232 && columns === 2), overflow:document.documentElement.scrollWidth > innerWidth };
  }, width);
}
try {
  for (const [width,height] of [[360,800],[390,844],[768,1024],[1440,1000]]) {
    const context = await browser.newContext({ viewport:{width,height} });
    const page = await context.newPage();
    const errors = [], network = [], headers = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if(message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if(response.status() >= 400) network.push({status:response.status(),path:new URL(response.url()).pathname}); });
    page.on('request', request => { if(new URL(request.url()).pathname === '/api/trips') headers.push(request.headers()['accept-language']); });
    const view = {width,height,errors,network,languages:[]}; report.views.push(view);
    await page.goto(origin); await settle(page);
    if(!production) {
      await page.locator('.product-add').first().click();
      await page.locator('.quantity-sheet .ant-btn-primary').click();
      await page.locator('.quantity-sheet').waitFor({state:'hidden'});
    }
    const cart = await page.evaluate(() => localStorage.getItem('bobuy.cart.v1'));
    for(const [locale,name,brand] of languages) {
      await selectLanguage(page,locale,name,brand);
      assert((await page.locator('.store-brand').innerText()).includes(brand));
      assert.equal(await page.evaluate(() => localStorage.getItem('bobuy.cart.v1')),cart);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await screenshot(page,`store-${width}-${locale}`);
    }
    await page.goto(origin + '/admin'); await settle(page);
    view.loginControls = await page.evaluate(measureMerchantControls);
    await screenshot(page,`login-${width}`);
    await page.locator('input[autocomplete="username"]').fill(credentials.username);
    await page.locator('input[autocomplete="current-password"]').fill(credentials.password);
    await page.locator('.merchant-login-main button[type="submit"]').click();
    await page.locator('.merchant-shell').waitFor(); await settle(page);
    for(const [locale,name,brand] of languages) {
      await selectLanguage(page,locale,name,brand);
      await page.goto(origin + '/admin/dashboard'); await settle(page);
      if(width < 768) {
        await page.locator('.merchant-menu-toggle').click();
        await page.locator('.merchant-drawer').waitFor();
        await page.locator('.ant-drawer-content-wrapper:visible').evaluate(async element => { await Promise.all(element.getAnimations({subtree:true}).map(animation => animation.finished)); });
        await page.locator('.merchant-drawer a[href="/admin/trips"]').hover();
        assert.equal(Math.round((await page.locator('.merchant-drawer').boundingBox()).x),0,'Drawer screenshot must show the fully opened panel');
        assert((await page.locator('.merchant-drawer .merchant-brand').innerText()).includes(brand));
        await screenshot(page,`menu-${width}-${locale}`);
        await page.locator('.merchant-drawer a[href="/admin/trips"]').click();
      } else await page.locator('.merchant-sidebar a[href="/admin/trips"]').click();
      await page.getByTestId('trips-title').waitFor(); await settle(page);
      assert.equal(headers.at(-1),locale);
      await page.locator('#origin').fill('Tokyo');
      await selectLanguage(page,'en-US','English','BoBuy');
      await selectLanguage(page,locale,name,brand);
      assert.equal(await page.locator('#origin').inputValue(),'Tokyo');
      await page.evaluate(() => scrollTo(0,0));
      const geometry = await layout(page,width);
      assert(geometry.valid,JSON.stringify(geometry)); assert(!geometry.overflow);
      if(width === 390 && locale === 'zh-CN') {
        const bad = await page.addStyleTag({content:'.merchant-content { margin-top:500px !important; }'});
        assert(!(await layout(page,width)).valid);
        await bad.evaluate(element => element.remove());
      }
      await screenshot(page,`trips-${width}-${locale}`);
      await screenshot(page,`header-${width}-${locale}`,page.locator('.merchant-header'));
      await screenshot(page,`form-${width}-${locale}`,page.locator('.trip-editor'));
      const controls = await page.evaluate(measureMerchantControls);
      if(width < 768 && !production) {
        const table=page.locator('.trip-list-section .ant-table-content');
        await table.evaluate(element => { element.scrollLeft=element.scrollWidth; });
        const action=page.locator('.trip-list-section .ant-select-selector').first();
        const bounds=await action.boundingBox();
        assert(bounds.x>=0 && bounds.x+bounds.width<=width,'Mobile trip status action must be reachable by table scrolling');
        await screenshot(page,`table-end-${width}-${locale}`,page.locator('.trip-list-section'));
        await table.evaluate(element=>{element.scrollLeft=0;});
      }
      await page.locator('#departDate').click();
      await page.locator('.ant-picker-dropdown:visible').waitFor();
      const calendar = await page.locator('.ant-picker-dropdown:visible').innerText();
      await screenshot(page,`calendar-${width}-${locale}`);
      await page.keyboard.press('Escape');
      view.languages.push({locale,geometry,calendar,controls});
      if(width === 1440 || width === 360) {
        for(const path of ['dashboard','orders','order-desk','procurement','picking','stock-master','suppliers','customers']) {
          await page.goto(origin + `/admin/${path}`); await settle(page);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${path} overflow ${locale}`);
          await screenshot(page,`${path}-${width}-${locale}`);
        }
      }
    }
    await page.reload(); await settle(page);
    await page.locator('.merchant-shell').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang),'zh-TW');
    if(width < 768) {
      await page.locator('.merchant-menu-toggle').click();
      await page.locator('.merchant-drawer .merchant-identity button').click();
    } else await page.locator('.merchant-header-logout').click();
    await page.locator('.merchant-login-main').waitFor(); await settle(page);
    view.logout='PASS';
    assert.deepEqual(errors,[]);
    assert.deepEqual(network,[]);
    await context.close();
    console.log(`Verified ${production ? 'production' : 'local'} ${width}: four languages, cart, navigation, form, calendar, reload`);
  }
  report.functional = 'PASS';
} finally {
  await browser.close();
  writeFileSync(new URL('browser-report.json',output),JSON.stringify(report,null,2));
}
