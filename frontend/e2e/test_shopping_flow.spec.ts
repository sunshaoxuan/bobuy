import { expect, test } from '@playwright/test';
import { setupCommonMocks } from './responsive_helpers';

test('regional delivery creates and edits using only area and delivery date', async ({ page }) => {
  const trips: any[] = [];
  const writes: any[] = [];
  await setupCommonMocks(page);
  await page.route('**/api/trips', async route => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON(); writes.push(payload);
      trips.push({ id: 2000, agentId: 1000, ...payload, status: 'PUBLISHED', settlementFrozen: false });
    }
    await route.fulfill({ json: { status: 'success', data: route.request().method() === 'GET' ? trips : trips[0] } });
  });
  await page.route('**/api/trips/2000', async route => {
    const payload = route.request().postDataJSON(); writes.push(payload); Object.assign(trips[0], payload);
    await route.fulfill({ json: { status: 'success', data: trips[0] } });
  });
  const user = { id: 1000, username: 'agent', name: 'Regional merchant', roles: ['AGENT'] };
  await page.route('**/api/auth/me', route => route.fulfill({ json: { status: 'success', data: user } }));
  await page.addInitScript(user => {
    localStorage.setItem('bobbuy_locale', 'en-US');
    localStorage.setItem('bobbuy_auth_user', JSON.stringify(user));
    localStorage.setItem('bobbuy_access_token', 'e2e-access-agent');
    localStorage.setItem('bobbuy_access_token_expires_at', '2099-12-31T23:59:59Z');
  }, user);
  await page.goto('/admin/trips');
  await page.getByLabel('Delivery Area').fill('Seoul region');
  await page.getByLabel('Delivery Date').fill('2026-11-01');
  await page.getByLabel('Delivery Date').press('Enter');
  await page.getByTestId('trips-submit').click();
  await expect(page.getByText('Seoul region', { exact: true })).toBeVisible();
  expect(writes[0]).toEqual({ deliveryArea: 'Seoul region', deliveryDate: '2026-11-01' });
  await expect(page.getByLabel('Capacity', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Agent ID', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Delivery' }).click();
  await page.getByLabel('Delivery Area').fill('Busan region');
  await page.getByTestId('trips-submit').click();
  await expect(page.getByText('Busan region', { exact: true })).toBeVisible();
  expect(writes[1]).toEqual({ deliveryArea: 'Busan region', deliveryDate: '2026-11-01' });
});
