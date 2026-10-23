import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../frontend/node_modules/playwright-core/index.mjs';

const origin = 'https://bobuy.cc';
const release = process.env.BOBUY_RELEASE;
assert.match(release || '', /^\d{8}\.[1-9]\d*$/);
const output = new URL(`../docs/reports/evidence/release-${release}/`, import.meta.url);
mkdirSync(output, { recursive: true });
const credentials = JSON.parse(execFileSync('ssh', [
  '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
  '-i', 'C:/workspace/Secure/sunsxaws.pem', 'root@185.184.223.41',
  'cat /etc/bobuy-admin.json',
], { encoding: 'utf8' }));
const browser = await chromium.launch({
  executablePath: process.env.BOBUY_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const report = { origin, release, productionData: 'Existing merchant; empty production catalog', views: [] };
try {
  const api = await browser.newContext();
  const home = await api.request.get(origin);
  assert.equal(home.status(), 200);
  assert(home.headers()['cf-ray'], 'Request must pass through Cloudflare');
  const sourceHtml = readFileSync(new URL('../frontend/dist/index.html', import.meta.url), 'utf8');
  const assets = [...sourceHtml.matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(match => match[1]);
  const servedHtml = await home.text();
  for (const asset of assets) {
    assert(servedHtml.includes(asset), `Production must serve current asset ${asset}`);
    const response = await api.request.get(origin + asset);
    assert.equal(response.status(), 200);
    assert.deepEqual(await response.body(), readFileSync(new URL('../frontend/dist' + asset, import.meta.url)));
  }
  report.assets = assets;
  for (const url of ['http://bobuy.cc', 'https://www.bobuy.cc']) {
    const response = await api.request.get(url, { maxRedirects: 0 });
    assert([301, 302, 307, 308].includes(response.status()));
    assert(response.headers().location.startsWith(origin));
  }
  assert.equal((await api.request.get(origin + '/health')).status(), 200);
  assert.equal((await api.request.get(origin + '/api/auth/me')).status(), 401);
  for (const route of ['/api/auth/register', '/api/auth/email/resend', '/api/auth/email/verify']) {
    const response = await api.request.post(origin + route, { data: {} });
    assert.equal(response.status(), 503);
    assert((await response.json()).message.includes('temporarily unavailable'));
  }
  const trips = await (await api.request.get(origin + '/api/storefront/trips')).json();
  const products = await (await api.request.get(origin + '/api/storefront/products')).json();
  assert.deepEqual(trips.data, []);
  assert.deepEqual(products.data, []);
  const fixtureTrips = await (await api.request.get('http://127.0.0.1:18080/api/storefront/trips')).json();
  const fixtureProducts = await (await api.request.get('http://127.0.0.1:18080/api/storefront/products')).json();
  assert(fixtureProducts.data.length >= 6 && fixtureTrips.data.length);
  await api.close();

  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 },
    { width: 768, height: 1024 }, { width: 1440, height: 1000 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [], httpErrors = [], failedRequests = [];
    let phase = 'guest';
    const view = { viewport, errors, httpErrors, failedRequests };
    report.views.push(view);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) httpErrors.push({ url: response.url(), status: response.status() }); });
    page.on('requestfailed', request => failedRequests.push({ phase, url: request.url(), error: request.failure()?.errorText }));
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('.store-brand').filter({ hasText: '宝宝败' }).waitFor();
    await page.getByRole('button', { name: '选择采购行程', exact: true }).waitFor();
    assert.equal(await page.locator('.store-product').count(), 0);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: fileURLToPath(new URL(`production-empty-${viewport.width}.png`, output)), fullPage: true });
    await page.getByRole('button', { name: '选择采购行程', exact: true }).click();
    await page.getByRole('dialog').getByText('暂无可预订行程', { exact: true }).waitFor();
    await page.locator('.journey-picker .ant-drawer-close').click();
    await page.goto(origin + '/cart', { waitUntil: 'networkidle' });
    view.productionGuest = 'PASS';

    // These catalog responses are browser-only fixtures, never production writes.
    await page.route('**/api/storefront/trips', route => route.fulfill({ json: fixtureTrips }));
    await page.route('**/api/storefront/products', route => route.fulfill({ json: fixtureProducts }));
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.locator('.store-product').first().waitFor();
    await page.locator('.product-photo img').first().evaluate(image => image.decode());
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: fileURLToPath(new URL(`production-assets-fixture-${viewport.width}.png`, output)) });
    if (viewport.width === 390) {
      await page.locator('.product-tile').first().screenshot({ path: fileURLToPath(new URL('fixture-card-original.png', output)) });
    }
    await page.locator('.product-add').first().click();
    await page.getByRole('button', { name: '加入购物车', exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('bobuy.cart.v1')).items).reduce((a,b) => a+b, 0)), 1);
    await page.getByPlaceholder('搜索商品').fill('没有这个商品123');
    await page.getByText('没有匹配商品', { exact: true }).waitFor();
    view.fixtureCatalog = 'PASS: production assets, browser-only local fixture responses';
    await page.unrouteAll({ behavior: 'wait' });

    if ([390, 1440].includes(viewport.width)) {
      phase = 'admin-login';
      await page.goto(origin + '/admin', { waitUntil: 'networkidle' });
      await page.locator('#username').fill(credentials.username);
      await page.locator('#password').fill(credentials.password);
      const dashboardResponses = ['/api/metrics', '/api/trips', '/api/orders'].map(path =>
        page.waitForResponse(response => response.url() === origin + path && response.request().method() === 'GET'));
      await page.locator('button[type="submit"]').click();
      await page.waitForURL('**/admin/dashboard');
      await page.getByText('今日概览', { exact: true }).waitFor();
      for (const response of await Promise.all(dashboardResponses)) {
        assert.equal(response.status(), 200);
        assert.equal(await response.finished(), null);
      }
      await page.waitForLoadState('networkidle');
      phase = 'admin-reload';
      await page.reload({ waitUntil: 'networkidle' });
      assert(page.url().endsWith('/admin/dashboard'));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: fileURLToPath(new URL(`production-admin-${viewport.width}.png`, output)), fullPage: true });
      phase = 'admin-cookie-security';
      const cookies = await context.cookies();
      assert(cookies.find(cookie => cookie.name === 'bobbuy_refresh_token' && cookie.secure && cookie.httpOnly));
      const csrf = cookies.find(cookie => cookie.name === 'bobbuy_csrf_token');
      assert(csrf);
      assert.equal((await context.request.post(origin + '/api/auth/refresh')).status(), 403);
      assert.equal((await context.request.post(origin + '/api/auth/refresh', { headers: { 'X-BOBBUY-CSRF-TOKEN': 'forged' } })).status(), 403);
      assert.equal((await context.request.post(origin + '/api/auth/refresh', { headers: { 'X-BOBBUY-CSRF-TOKEN': csrf.value } })).status(), 200);
      const currentCsrf = (await context.cookies()).find(cookie => cookie.name === 'bobbuy_csrf_token');
      assert.equal((await context.request.post(origin + '/api/auth/logout', { headers: { 'X-BOBBUY-CSRF-TOKEN': currentCsrf.value } })).status(), 200);
      view.adminLoginReloadRefreshLogout = 'PASS';
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(httpErrors, []);
    assert.deepEqual(failedRequests.filter(request => !request.url.includes('/cdn-cgi/rum')), []);
    await context.close();
  }
  report.result = 'PASS';
} finally {
  await browser.close();
  writeFileSync(new URL('browser-results.json', output), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
