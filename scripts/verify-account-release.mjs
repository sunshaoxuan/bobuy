import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {chromium} from '../frontend/node_modules/playwright-core/index.mjs';

const origin='https://bobuy.cc';
const report={release:'20261024.1',origin,checks:{}};
const credentials=JSON.parse(execFileSync('ssh',['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-i','C:/workspace/Secure/sunsxaws.pem','root@185.184.223.41','cat /etc/bobuy-admin.json'],{encoding:'utf8'}));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const context=await browser.newContext();
  const home=await context.request.get(origin);
  assert.equal(home.status(),200);assert(home.headers()['cf-ray']);
  const html=await home.text();
  const local=readFileSync(new URL('../frontend/dist/index.html',import.meta.url),'utf8');
  const assets=[...local.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(m=>m[1]);
  assert(assets.length>0);
  for(const asset of assets) {
    assert(html.includes(asset));
    const response=await context.request.get(origin+asset);
    assert.equal(response.status(),200);
    assert.deepEqual(await response.body(),readFileSync(new URL('../frontend/dist'+asset,import.meta.url)));
  }
  report.checks.cloudflareHttpsAndExactAssets='PASS';report.assets=assets;
  for(const address of ['http://bobuy.cc','https://www.bobuy.cc']) {
    const response=await context.request.get(address,{maxRedirects:0});
    assert([301,302,307,308].includes(response.status()));
    assert(response.headers().location.startsWith(origin));
  }
  assert.equal((await context.request.get(origin+'/health')).status(),200);
  report.checks.redirectsAndHealth='PASS';
  const response=await context.request.post(origin+'/api/auth/login',{data:credentials});
  assert.equal(response.status(),200);
  const session=(await response.json()).data;
  assert(session.user.platformAdmin);assert.deepEqual(session.user.roles,['AGENT']);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin+'/admin',{waitUntil:'networkidle'});
  await page.locator('#username').fill(credentials.username);
  await page.locator('#password').fill(credentials.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/admin/users');
  await page.locator('.accounts-table .ant-table-row').first().waitFor();
  await page.reload({waitUntil:'networkidle'});
  assert(page.url().endsWith('/admin/users'));
  await page.locator('.accounts-table .ant-table-row').first().waitFor();
  assert.deepEqual(errors,[]);
  report.checks.actualAdminFormRedirectAndReload='PASS';
  const cookies=await context.cookies();
  assert(cookies.some(c=>c.name==='bobbuy_refresh_token'&&c.secure&&c.httpOnly));
  const csrf=cookies.find(c=>c.name==='bobbuy_csrf_token');assert(csrf);
  assert.equal((await context.request.post(origin+'/api/auth/refresh')).status(),403);
  assert.equal((await context.request.post(origin+'/api/auth/refresh',{headers:{'X-BOBBUY-CSRF-TOKEN':'forged'}})).status(),403);
  assert.equal((await context.request.post(origin+'/api/auth/refresh',{headers:{'X-BOBBUY-CSRF-TOKEN':csrf.value}})).status(),200);
  const current=(await context.cookies()).find(c=>c.name==='bobbuy_csrf_token');assert(current);
  assert.equal((await context.request.post(origin+'/api/auth/logout',{headers:{'X-BOBBUY-CSRF-TOKEN':current.value}})).status(),200);
  report.checks.adminLoginSecureCookieCsrfRefreshLogout='PASS';
  await context.close();report.result='PASS';
} finally {
  await browser.close();
  writeFileSync(new URL('../docs/reports/evidence/PLAN61/production/release-verification.json',import.meta.url),JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));
