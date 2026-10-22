import { test, expect } from '@playwright/test';

test.skip(process.env.BOBUY_LOCAL_E2E !== '1', 'Requires the bobuy-local Compose group');

for (const [width, height] of [[360,800], [390,844], [768,1024], [1440,1000]]) {
  test(`public storefront ${width}x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.goto('/');
    await expect(page.locator('.store-product').first()).toBeVisible();
    await expect(page.locator('.trip-choice.selected')).toBeVisible();
    await page.locator('.product-photo img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const titleLines = await page.locator('.product-name h3').last().evaluate(element => {
      const node = element.firstChild!;
      const lines = new Map<number, number>();
      for (let index = 0; index < (node.textContent?.length || 0); index++) {
        if (!node.textContent![index].trim()) continue;
        const range = document.createRange();
        range.setStart(node, index); range.setEnd(node, index + 1);
        const top = Math.round(range.getBoundingClientRect().top);
        lines.set(top, (lines.get(top) || 0) + 1);
      }
      return [...lines.values()];
    });
    expect(titleLines.every(characters => characters > 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`storefront-${width}.png`), fullPage: true });
    await page.getByPlaceholder('搜索商品').fill('不存在的测试商品');
    await expect(page.getByText('没有匹配商品')).toBeVisible();
    await page.getByPlaceholder('搜索商品').fill('');
    await page.locator('.product-name').first().click();
    await expect(page.locator('.product-detail .detail-photo img')).toBeVisible();
    await page.locator('.product-detail').getByRole('button', { name: '加入购物车' }).click();
    await page.locator('.product-detail .ant-drawer-close').click();
    await expect(page.locator('.product-detail')).not.toBeVisible();
    await page.reload();
    await expect(page.locator('.cart-bar')).toContainText('1 件商品');
    await expect(page.locator('.store-product').first()).toBeVisible();
    await page.locator('.product-photo img').evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const lastAction = await page.locator('.store-product .ant-btn').last().boundingBox();
    const cartBar = await page.locator('.cart-bar').boundingBox();
    expect(lastAction!.y + lastAction!.height + 6).toBeLessThan(cartBar!.y);
    await page.screenshot({ path: info.outputPath(`catalog-bottom-${width}.png`) });
    await page.getByRole('button', { name: /去结算/ }).click();
    await expect(page.getByRole('button', { name: /确认下单/ })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`cart-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: /确认下单/ }).click();
    await expect(page.getByRole('heading', { name: '创建客户账户' })).toBeVisible();
    expect(await page.locator('.ant-segmented-item-label').first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: info.outputPath(`checkout-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('register, unverified checkout, scoped merchant approval and SMTP verification', async ({ page, browser, request }, info) => {
  await page.setViewportSize({ width:390, height:844 });
  const username = `local_${Date.now()}`;
  const email = `${username}@example.test`;
  await page.goto('/');
  await page.getByRole('button', { name: '加入购物车' }).first().click();
  await page.getByRole('button', { name: /去结算/ }).click();
  await page.getByRole('button', { name: /确认下单/ }).click();
  await page.getByLabel('用户名', { exact:true }).fill(username);
  await page.getByLabel('邮箱', { exact:true }).fill(email);
  await page.getByLabel('密码', { exact:true }).fill('local-valid-password');
  await page.getByRole('button', { name: '注册并继续' }).click();
  await expect(page.getByText('邮箱尚未验证，可先提交待确认订单')).toBeVisible();
  await page.getByRole('button', { name: /提交订单/ }).click();
  await expect(page.getByRole('heading', { name:'订单已提交' })).toBeVisible();
  await page.screenshot({ path: info.outputPath('order-success.png'), fullPage:true });
  await page.getByRole('button', { name:'查看订单' }).click();
  await expect(page.getByText('NEW', { exact:true }).first()).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL('http://127.0.0.1:18080/');

  const merchant = await browser.newPage({ viewport:{ width:390, height:844 } });
  await merchant.goto('http://127.0.0.1:18080/admin');
  await merchant.getByLabel('用户名').fill('agent');
  await merchant.getByLabel('密码').fill('agent-pass');
  await merchant.getByRole('button', { name:/登\s*录/ }).click();
  await expect(merchant).toHaveURL(/\/admin\/dashboard$/);
  await merchant.goto('http://127.0.0.1:18080/admin/customers');
  const customer = merchant.locator('article').filter({ hasText:username });
  await expect(customer).toBeVisible();
  await customer.getByRole('button', { name:/认可/ }).click();
  await expect(customer.getByText('本商家已认可')).toBeVisible();
  await merchant.screenshot({ path: info.outputPath('merchant-customers.png'), fullPage:true });
  await merchant.close();

  const inbox = await (await request.get('http://127.0.0.1:18025/api/v1/messages')).json();
  const message = inbox.messages.find((message: { To: { Address:string }[] }) => message.To.some(to => to.Address === email));
  expect(message).toBeTruthy();
  const content = await (await request.get(`http://127.0.0.1:18025/api/v1/message/${message.ID}`)).json();
  const code = content.Text.match(/[0-9]{6}/)?.[0];
  expect(code).toMatch(/^[0-9]{6}$/);
  await page.goto('/account');
  await page.getByLabel('邮箱验证码').fill(code);
  await page.getByRole('button', { name:'验证邮箱', exact:true }).click();
  await expect(page.getByText('邮箱已验证', { exact:true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('verified-account.png'), fullPage:true });
});
