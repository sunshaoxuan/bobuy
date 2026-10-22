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
    await expect(page.locator('.store-brand')).toContainText('宝宝败');
    await page.getByRole('button', { name:'选择采购行程', exact:true }).click();
    await expect(page.locator('.trip-choice.selected')).toBeVisible();
    await page.locator('.journey-picker .ant-drawer-close').click();
    await page.locator('.product-photo img').first().evaluate(image => (image as HTMLImageElement).decode());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const titleLines = await page.locator('.product-name h2').last().evaluate(element => {
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
    await expect(page.locator('.store-product').first()).toBeVisible();
    const columns = await page.locator('.product-masonry').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
    expect(columns).toBe(width < 768 ? 2 : width < 1100 ? 3 : 6);
    await expect(page.locator('.product-tile').first()).toHaveCSS('border-radius','20px');
    await expect(page.locator('.product-tile').first()).toHaveCSS('overflow','hidden');
    const addFace = await page.locator('.product-add').first().evaluate(element => {
      const face = getComputedStyle(element,'::before');
      return { size:element.getBoundingClientRect().width - 2 * parseFloat(face.top), fill:face.backgroundColor, blur:face.backdropFilter, hit:element.getBoundingClientRect().height };
    });
    expect(addFace.size).toBe(34);
    expect(addFace.fill).toBe('rgba(255, 255, 255, 0.72)');
    expect(addFace.blur).toBe('blur(12px)');
    expect(addFace.hit).toBeGreaterThanOrEqual(44);
    if (width === 390) {
      const oldFace = await page.addStyleTag({content:'.product-add::before { inset:0; background:white; }'});
      const invalidFace = await page.locator('.product-add').first().evaluate(element => element.getBoundingClientRect().width - 2 * parseFloat(getComputedStyle(element,'::before').top));
      expect(invalidFace === 34).toBe(false);
      await oldFace.evaluate(element => element.remove());
    }
    const tileWidth = (await page.locator('.product-tile').first().boundingBox())!.width;
    if (width >= 1100) expect(tileWidth).toBeLessThanOrEqual(240);
    const first = await page.locator('.product-tile').first().boundingBox();
    const next = await page.locator('.product-tile').nth(1).boundingBox();
    expect(next!.x-first!.x-first!.width).toBeGreaterThanOrEqual(12);
    const originalTop = await page.locator('.product-tile').first().evaluate(element => element.getBoundingClientRect().top + scrollY);
    await page.locator('.store-product').last().scrollIntoViewIfNeeded();
    await expect(page.locator('.store-product')).toHaveCount(7);
    expect(await page.locator('.product-tile').first().evaluate(element => element.getBoundingClientRect().top + scrollY)).toBe(originalTop);
    await page.evaluate(() => scrollTo(0,0));
    await page.locator('.product-add').first().click();
    await expect(page.locator('.quantity-sheet')).toBeVisible();
    await expect(page.getByRole('button',{name:'减少购买数量',exact:true})).toBeDisabled();
    await page.getByRole('spinbutton',{name:'购买数量',exact:true}).fill('99');
    await page.getByRole('spinbutton',{name:'购买数量',exact:true}).blur();
    await expect(page.getByRole('button',{name:'增加购买数量',exact:true})).toBeDisabled();
    await page.screenshot({path:info.outputPath(`quantity-max-${width}.png`)});
    await page.locator('.quantity-sheet .ant-drawer-close').click();
    await expect(page.locator('.product-count')).toHaveCount(0);
    await page.locator('.product-name').first().click();
    await expect(page.locator('.product-detail .detail-photo img')).toBeVisible();
    await page.locator('.product-detail').getByRole('button', { name: '设置购买数量' }).click();
    await page.locator('.quantity-sheet').getByRole('button', { name:'加入购物车',exact:true }).click();
    await expect(page.locator('.product-detail')).not.toBeVisible();
    await page.reload();
    await expect(page.locator('.product-count').first()).toHaveText('1');
    await expect(page.locator('.store-product').first()).toBeVisible();
    await page.locator('.product-photo img').first().evaluate(image => (image as HTMLImageElement).decode());
    await page.locator(width < 768 ? '.store-bottom' : '.store-header-actions').getByRole('link',{name:/购物车/}).click();
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

test('progressive masonry appends three batches without shifting loaded cards', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/storefront/products',async route => {
    const response=await route.fetch(), envelope=await response.json();
    const original=envelope.data;
    envelope.data=Array.from({length:18},(_,index)=>({...original[index%original.length],id:`visual-${index}`}));
    await route.fulfill({response,json:envelope});
  });
  await page.goto('/');
  await expect(page.locator('.store-product')).toHaveCount(6);
  await expect(page.locator('.store-product').first()).toHaveCSS('grid-row-end',/span/);
  const positions=()=>page.locator('.product-tile').evaluateAll(elements=>elements.slice(0,6).map(element=>{const r=element.getBoundingClientRect();return [r.x,r.y+scrollY,r.width,r.height];}));
  const initial=await positions();
  await page.locator('.store-product').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.store-product')).toHaveCount(12);
  expect(await positions()).toEqual(initial);
  await page.locator('.store-product').last().scrollIntoViewIfNeeded();
  await expect(page.locator('.store-product')).toHaveCount(18);
  expect(await positions()).toEqual(initial);
  await expect(page.getByRole('button',{name:'加载更多商品',exact:true})).toHaveCount(0);
});

test('register, unverified checkout, scoped merchant approval and SMTP verification', async ({ page, browser, request }, info) => {
  await page.setViewportSize({ width:390, height:844 });
  const username = `local_${Date.now()}`;
  const email = `${username}@example.test`;
  await page.goto('/');
  await page.locator('.product-add').first().click();
  await page.locator('.quantity-sheet').getByRole('button', { name:'加入购物车',exact:true }).click();
  await page.locator('.store-bottom').getByRole('link',{name:/购物车/}).click();
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
