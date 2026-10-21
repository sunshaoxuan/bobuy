import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../frontend/node_modules/playwright-core/index.mjs';

const origin = 'https://bobuy.cc';
const output = new URL('../docs/deployment-evidence/', import.meta.url);
mkdirSync(output, { recursive: true });
const credentials = JSON.parse(execFileSync('ssh', [
  '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
  '-i', 'C:/workspace/Secure/sunsxaws.pem', 'root@185.184.223.41',
  'cat /etc/bobuy-admin.json',
], { encoding: 'utf8' }));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const report = { origin, release: '20261021.1', data: 'Empty production database; bootstrap operator', views: [] };
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    const httpErrors = [];
    const view = { viewport, errors, failedRequests, httpErrors };
    view.cookieResponses = [];
    report.views.push(view);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('requestfailed', req => failedRequests.push({ url: req.url(), error: req.failure()?.errorText }));
    page.on('response', res => { if (res.status() >= 400) httpErrors.push({ url: res.url(), status: res.status() }); });
    page.on('response', async res => {
      const headers = await res.headersArray();
      for (const header of headers.filter(header => header.name.toLowerCase() === 'set-cookie')) {
        view.cookieResponses.push({ url: res.url(), cookie: header.value.split('=')[0], deleted: /Max-Age=0/i.test(header.value) });
      }
    });
    const response = await page.goto(origin, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.locator('#username').fill(credentials.username);
    await page.locator('#password').fill(credentials.password);
    const loginResponse = page.waitForResponse(res => res.url().endsWith('/api/auth/login'));
    await page.locator('button[type="submit"]').click();
    assert.equal((await loginResponse).status(), 200);
    view.cookiesAfterLogin = (await context.cookies()).map(({name,path,secure,httpOnly}) => ({name,path,secure,httpOnly}));
    await page.waitForURL('**/dashboard');
    await page.getByText('今日概览', { exact: true }).waitFor();
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => !document.body.textContent.includes('--'));
    const refreshCookie = (await context.cookies()).find(cookie => cookie.name === 'bobbuy_refresh_token');
    assert(refreshCookie?.secure && refreshCookie.httpOnly);
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('今日概览', { exact: true }).waitFor();
    assert(page.url().endsWith('/dashboard'));
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    assert(layout.scrollWidth <= layout.width, 'Dashboard must fit the viewport');
    await page.screenshot({ path: fileURLToPath(new URL(`dashboard-${viewport.width}.png`, output)), fullPage: true });
    const csrfCookie = (await context.cookies()).find(cookie => cookie.name === 'bobbuy_csrf_token');
    view.cookiesAfterReload = (await context.cookies()).map(({name,path,secure,httpOnly}) => ({name,path,secure,httpOnly}));
    assert(csrfCookie, 'CSRF cookie must survive page reload');
    assert.equal((await context.request.post(`${origin}/api/auth/refresh`)).status(), 403);
    assert.equal((await context.request.post(`${origin}/api/auth/refresh`, { headers: { 'X-BOBBUY-CSRF-TOKEN': 'forged-token' } })).status(), 403);
    const refresh = await context.request.post(`${origin}/api/auth/refresh`, { headers: { 'X-BOBBUY-CSRF-TOKEN': csrfCookie.value } });
    assert.equal(refresh.status(), 200);
    const csrfAfterRefresh = (await context.cookies()).find(cookie => cookie.name === 'bobbuy_csrf_token');
    const logout = await context.request.post(`${origin}/api/auth/logout`, { headers: { 'X-BOBBUY-CSRF-TOKEN': csrfAfterRefresh.value } });
    assert.equal(logout.status(), 200);
    assert(!(await context.cookies()).some(cookie => cookie.name === 'bobbuy_refresh_token' && cookie.value));
    const anonymous = await browser.newContext();
    assert.equal((await anonymous.request.get(`${origin}/api/auth/me`)).status(), 401);
    assert.equal((await anonymous.request.post(`${origin}/api/auth/login`, { data: { username: 'invalid-probe', password: 'invalid-probe' } })).status(), 401);
    await anonymous.close();
    Object.assign(view, { layout, login: 'PASS', refresh: 'PASS', csrfNegativeCases: 'PASS', logout: 'PASS', anonymous: 'PASS', secureCookie: 'PASS' });
    assert.deepEqual(errors, [], 'Browser console and page errors');
    assert.deepEqual(httpErrors, [], 'Unexpected browser HTTP errors');
    assert.deepEqual(failedRequests.filter(request => !request.url.includes('/cdn-cgi/rum')), [], 'Application request failures');
    await context.close();
  }
} finally {
  await browser.close();
  writeFileSync(new URL('browser-results.json', output), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
