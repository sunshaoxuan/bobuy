import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from '../node_modules/playwright-core/index.mjs';
import { measureMerchantControls } from './measure-merchant.mjs';

const origin = process.env.BOBUY_VERIFY_ORIGIN || 'http://127.0.0.1:18080';
const production = origin === 'https://bobuy.cc';
assert(production || origin === 'http://127.0.0.1:18080');
const output = new URL(`../../docs/reports/evidence/PLAN61/${production ? 'production' : 'local'}/`, import.meta.url);
mkdirSync(output, {recursive:true});
const credentials = production ? JSON.parse(execFileSync('ssh', ['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','cat /etc/bobuy-admin.json'], {encoding:'utf8'})) : {username:'agent',password:'agent-pass'};
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const report = {origin, data:production ? 'Existing production accounts; read-only UI and browser-only long-name fixture' : 'Local seeded catalog; temporary QA accounts', views:[], geometryFailures:[]};
const prefix = `qa61_${Date.now()}`;
const snap = (page, name, locator) => locator ? locator.screenshot({path:fileURLToPath(new URL(name+'.png',output)),animations:'disabled'}) : page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:!name.startsWith('create-') && !name.startsWith('edit-'),animations:'disabled'});
const selectors = '.accounts-heading button,.accounts-toolbar .ant-input-affix-wrapper,.accounts-toolbar .ant-select-selector,.accounts-table button,.account-editor .ant-drawer-close,.account-editor .ant-input-affix-wrapper,.account-editor input.ant-input:not([type=password]),.account-editor .accounts-types label,.account-editor .accounts-footer button,.account-editor .ant-switch,.account-form .accounts-types label';
async function controls(page, view, name) {
  const values = await page.evaluate(measureMerchantControls, selectors);
  view.controls.push({name,values});
  for (const c of values) {
    const key = `${view.width}/${view.locale}/${name}/${c.name}`;
    if(c.hitArea.height<43.99) report.geometryFailures.push(`${key}: hit area height ${c.hitArea.height}`);
    if(c.glyph) {
      if(Object.values(c.margins).some(n=>n<2.99)) report.geometryFailures.push(`${key}: glyph margin ${JSON.stringify(c.margins)}`);
      const tolerance=Math.min(2,c.glyph.height*.1)+.01;
      if(Math.abs(c.centerError.y)>tolerance) report.geometryFailures.push(`${key}: vertical center ${c.centerError.y}`);
      if(c.alignment==='center' && Math.abs(c.centerError.x)>tolerance) report.geometryFailures.push(`${key}: horizontal center ${c.centerError.x}`);
    }
  }
}
async function editor(page) {
  await page.locator('.accounts-heading button').click();
  await page.locator('.account-editor').evaluate(async e=>Promise.all(e.closest('.ant-drawer-content-wrapper').getAnimations({subtree:true}).map(a=>a.finished)));
}
try {
  const api = await browser.newContext();
  assert.equal((await api.request.get(origin+'/api/admin/users')).status(),401);
  const session=await (await api.request.post(origin+'/api/auth/login',{data:credentials})).json();
  assert(session.data.user.platformAdmin);
  const headers={Authorization:`Bearer ${session.data.accessToken}`};
  const accounts=await (await api.request.get(origin+'/api/admin/users',{headers})).json();
  assert(accounts.data.every(a=>Array.isArray(a.roles) && !('passwordHash' in a)));
  if(!production) {
    for(const roles of [['CUSTOMER'],['AGENT'],['CUSTOMER','AGENT']]) {
      const username=prefix+'_'+roles.length+'_'+roles[0].toLowerCase();
      const response=await api.request.post(origin+'/api/admin/users',{headers,data:{username,name:'用户管理验收 Customer Merchant テスト客戶'.repeat(2),email:username+'@example.test',password:'qa-local-6100',roles,enabled:true,platformAdmin:true}});
      assert.equal(response.status(),200);
      const account=(await response.json()).data;assert(!account.platformAdmin);assert.deepEqual([...account.roles].sort(),[...roles].sort());
      const login=await (await api.request.post(origin+'/api/auth/login',{data:{username,password:'qa-local-6100'}})).json();
      assert.equal((await api.request.get(origin+'/api/admin/users',{headers:{Authorization:`Bearer ${login.data.accessToken}`}})).status(),403);
    }
    const registered=await api.request.post(origin+'/api/auth/register-account',{data:{account:{username:prefix+'_register',password:'qa-local-6100',email:prefix+'@example.test'},roles:['CUSTOMER','AGENT'],platformAdmin:true}});
    assert.equal(registered.status(),200);assert(!((await registered.json()).data.user.platformAdmin));
    const checkout=await api.request.post(origin+'/api/auth/register',{data:{username:prefix+'_checkout',password:'qa-local-6100',email:prefix+'_checkout@example.test',roles:['AGENT'],platformAdmin:true}});
    assert.equal(checkout.status(),200);assert.deepEqual((await checkout.json()).data.user.roles,['CUSTOMER']);
    report.api='PASS: real PostgreSQL creation, registration type injection, login and non-admin denial';
  } else {
    for(const path of ['/api/auth/register','/api/auth/register-account','/api/auth/email/resend']) assert.equal((await api.request.post(origin+path,{data:{}})).status(),503);
    report.api='PASS: anonymous denial, existing admin, DTO and both registration gates';
  }
  await api.close();
  for(const [width,height] of [[360,800],[390,844],[768,1024],[1440,1000]]) {
    for(const locale of ['zh-CN','en-US','ja-JP','zh-TW']) {
      const context=await browser.newContext({viewport:{width,height}});
      const page=await context.newPage();
      const view={width,height,locale,errors:[],network:[],controls:[]};report.views.push(view);
      page.on('pageerror',e=>view.errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')view.errors.push(m.text());});
      page.on('response',r=>{if(r.status()>=400)view.network.push({path:new URL(r.url()).pathname,status:r.status()});});
      page.on('requestfailed',r=>{if(!r.url().includes('/cdn-cgi/rum'))view.network.push({path:r.url(),failure:r.failure()?.errorText});});
      await page.addInitScript(({locale,session})=>{localStorage.setItem('bobbuy_locale',locale);localStorage.setItem('bobbuy_auth_user',JSON.stringify(session.user));localStorage.setItem('bobbuy_access_token',session.accessToken);localStorage.setItem('bobbuy_access_token_expires_at',session.accessTokenExpiresAt);},{locale,session:session.data});
      await page.goto(origin+'/admin/users',{waitUntil:'networkidle'});
      await page.locator('.accounts-table .ant-table-row').first().waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(width<768) assert(await page.locator('.accounts-table').evaluate(e=>e.querySelector('table').getBoundingClientRect().right<=innerWidth-15));
      await snap(page,`users-${width}-${locale}`);await controls(page,view,'directory');
      if(width===390 && locale==='zh-CN') {
        const search=page.locator('.accounts-toolbar input.ant-input');
        await search.fill('no_such_account_6100');
        await page.locator('.accounts-table .ant-empty').waitFor();
        await snap(page,'empty-search-390');await search.fill('');
        await page.locator('.accounts-table .ant-table-row').first().waitFor();
        await page.locator('.accounts-toolbar .ant-select').click();
        await page.locator('.ant-select-item-option[title="商家"]').click();
        await page.waitForFunction(()=>document.querySelector('.accounts-toolbar .ant-select-selection-item')?.textContent==='商家');
        await snap(page,'merchant-filter-390');
        await page.locator('.accounts-toolbar .ant-select').click();
        await page.locator('.ant-select-item-option').first().click();
        report.searchAndFilter='PASS: empty search and merchant type filter';
      }
      await editor(page);await snap(page,`create-${width}-${locale}`);await controls(page,view,'create');
      if(width===390 && locale==='zh-CN')await snap(page,'roles-original',page.locator('.account-editor .accounts-types'));
      assert.equal(await page.locator('.account-editor input[type=checkbox]').count(),2);
      await page.locator('.account-editor .ant-drawer-close').click();
      await page.locator('.account-editor').waitFor({state:'hidden'});
      await page.locator('.accounts-table button').first().click();
      await page.locator('.account-editor #username').waitFor();
      await page.locator('.account-editor').evaluate(async e=>Promise.all(e.closest('.ant-drawer-content-wrapper').getAnimations({subtree:true}).map(a=>a.finished)));
      assert.equal(await page.locator('.account-editor #password').inputValue(),'');
      await page.locator('.account-editor #name').fill('Customer 商家兼客户 ユーザー 繁體中文'.repeat(3).slice(0,100));
      await snap(page,`edit-${width}-${locale}`);await controls(page,view,'edit');
      if(!production && width===390 && locale==='zh-CN') {
        const merchant=page.locator('.account-editor input[value=AGENT]');
        if(!(await merchant.isChecked())) await page.locator('.account-editor .accounts-types label:has(input[value=AGENT])').click();
        await page.waitForFunction(()=>document.querySelector('.account-editor input[value=AGENT]')?.checked);
        assert(await merchant.isChecked());
        const saved=page.waitForResponse(r=>r.url().includes('/api/admin/users/') && r.request().method()==='PUT');
        await page.locator('.accounts-footer button').last().click();assert.equal((await saved).status(),200);
        await page.locator('.account-editor').waitFor({state:'hidden'});
        report.uiSave='PASS: actual edit drawer saved with blank password';
      }
      assert.deepEqual(view.errors,[]);assert.deepEqual(view.network,[]);
      await context.close();
    }
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();await page.goto(origin+'/account',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.account-form input[type=checkbox]').count(),2);
  await snap(page,'independent-registration-390');
  if(!production) {
    await page.goto(origin,{waitUntil:'networkidle'});await page.locator('.product-add').first().click();await page.locator('.quantity-sheet .ant-btn-primary').click();
    await page.goto(origin+'/checkout',{waitUntil:'networkidle'});
    assert.equal(await page.locator('.account-form input[type=checkbox]').count(),0);
    await snap(page,'checkout-registration-390');
  }
  await context.close();
  assert.deepEqual(report.geometryFailures,[]);
  const negative=await browser.newPage({viewport:{width:390,height:844}});
  await negative.setContent('<button style="height:20px;width:80px">Too small</button>');
  const invalid=await negative.evaluate(measureMerchantControls,'button');
  assert(invalid[0].hitArea.height<44);
  report.geometryNegative='PASS: deliberately undersized control rejected by the same fixed height budget';
  await negative.close();
  report.result='PASS';
} finally {
  await browser.close();
  writeFileSync(new URL('browser-report.json',output),JSON.stringify(report,null,2));
  if(!production) execFileSync('docker',['compose','-p','bobuy-local','-f','compose.local.yml','exec','-T','postgres','psql','-U','bobuy','-d','bobuy','-v','ON_ERROR_STOP=1','-c',`DELETE FROM bb_refresh_token_session WHERE user_id IN (SELECT id FROM bb_user WHERE username LIKE 'qa61_%'); DELETE FROM bb_email_challenge WHERE user_id IN (SELECT id FROM bb_user WHERE username LIKE 'qa61_%'); DELETE FROM bb_user WHERE username LIKE 'qa61_%';`],{cwd:fileURLToPath(new URL('../../',import.meta.url)),stdio:'ignore'});
}
console.log(`PASS: ${report.views.length} user-management viewport/locale combinations`);
