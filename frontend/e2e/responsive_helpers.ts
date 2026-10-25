import { expect, type Page } from '@playwright/test';

type MockRole = 'CUSTOMER' | 'AGENT' | 'MERCHANT';

const MOCK_TRIPS = [
  {
    id: 2000,
    agentId: 1000,
    deliveryArea: 'Shanghai',
    deliveryDate: '2026-04-20',
    status: 'PUBLISHED',
    settlementFrozen: false,
    settlementFreezeStage: 'ACTIVE',
    settlementFreezeReason: ''
  }
];

const MOCK_USERS: Record<MockRole, { id: number; username: string; name: string; role: MockRole }> = {
  AGENT: {
    id: 1000,
    username: 'agent',
    name: 'Agent Smith',
    role: 'AGENT'
  },
  CUSTOMER: {
    id: 1001,
    username: 'customer',
    name: 'Alice Wang',
    role: 'CUSTOMER'
  },
  MERCHANT: {
    id: 1002,
    username: 'merchant',
    name: 'Merchant Li',
    role: 'MERCHANT'
  }
};

const ACCESS_TOKEN_BY_ROLE: Record<MockRole, string> = {
  AGENT: 'e2e-access-agent',
  CUSTOMER: 'e2e-access-customer',
  MERCHANT: 'e2e-access-merchant'
};

const REFRESH_TOKEN_BY_ROLE: Record<MockRole, string> = {
  AGENT: 'e2e-refresh-agent',
  CUSTOMER: 'e2e-refresh-customer',
  MERCHANT: 'e2e-refresh-merchant'
};

const CSRF_TOKEN_BY_ROLE: Record<MockRole, string> = {
  AGENT: 'e2e-csrf-agent',
  CUSTOMER: 'e2e-csrf-customer',
  MERCHANT: 'e2e-csrf-merchant'
};

const MOCK_ORDERS = [
  {
    id: 3000,
    businessId: 'BIZ-1001',
    customerId: 1001,
    tripId: 2000,
    status: 'CONFIRMED',
    paymentMethod: 'ALIPAY',
    paymentStatus: 'UNPAID',
    totalAmount: 65,
    lines: [{ skuId: 'SKU-001', itemName: 'Matcha', quantity: 2, unitPrice: 32.5 }]
  }
];

export const VIEWPORTS = [
  { label: '390 (mobile)', width: 390, height: 844 },
  { label: '768 (tablet)', width: 768, height: 1024 },
  { label: '1280 (desktop)', width: 1280, height: 800 }
] as const;

export const MOBILE_BLACKBOX_VIEWPORTS = [
  { label: '390x844', width: 390, height: 844 },
  { label: '360x800', width: 360, height: 800 }
] as const;

export async function setCustomerContext(page: Page) {
  await setAuthenticatedContext(page, 'CUSTOMER');
}

export async function setAgentContext(page: Page) {
  await setAuthenticatedContext(page, 'AGENT');
}

export async function loginAsAgent(page: Page) {
  await loginAsRole(page, 'AGENT');
}

export async function loginAsCustomer(page: Page) {
  await loginAsRole(page, 'CUSTOMER');
}

export async function loginAsRole(page: Page, role: 'CUSTOMER' | 'AGENT') {
  const defaultUsername = role === 'AGENT' ? 'agent' : 'customer';
  const defaultPassword = role === 'AGENT' ? 'agent-pass' : 'customer-pass';
  const username =
    role === 'AGENT'
      ? process.env.BOBBUY_E2E_AGENT_USERNAME?.trim() || defaultUsername
      : process.env.BOBBUY_E2E_CUSTOMER_USERNAME?.trim() || defaultUsername;
  const password =
    role === 'AGENT'
      ? process.env.BOBBUY_E2E_AGENT_PASSWORD?.trim() || defaultPassword
      : process.env.BOBBUY_E2E_CUSTOMER_PASSWORD?.trim() || defaultPassword;

  await page.addInitScript(() => {
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    window.localStorage.setItem('bobbuy_disable_chat_websocket', 'true');
  });
  await page.goto('/login');
  await expect(page.locator('input#username')).toBeVisible();
  await page.locator('input#username').fill(username);
  await page.locator('input#password').fill(password);
  const loginResponse = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST'
  );
  await page.locator('button[type="submit"]').click();
  expect((await loginResponse).ok()).toBe(true);
  await page.waitForURL((url) => url.pathname === (role === 'AGENT' ? '/dashboard' : '/'));
  await expect(page.locator(role === 'AGENT' ? '.dashboard-grid' : '.zen-page')).toBeVisible();
}

async function setAuthenticatedContext(page: Page, role: MockRole) {
  const user = MOCK_USERS[role];
  const accessToken = ACCESS_TOKEN_BY_ROLE[role];
  const csrfToken = CSRF_TOKEN_BY_ROLE[role];
  const refreshToken = REFRESH_TOKEN_BY_ROLE[role];

  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: 'bobbuy_refresh_token',
      value: refreshToken,
      url: 'http://127.0.0.1:5173/api/auth',
      httpOnly: true,
      sameSite: 'Lax'
    },
    {
      name: 'bobbuy_csrf_token',
      value: csrfToken,
      url: 'http://127.0.0.1:5173/',
      sameSite: 'Lax'
    }
  ]);

  await page.addInitScript(
    ({ sessionUser, sessionAccessToken }) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('bobbuy_locale', 'en-US');
      window.localStorage.setItem('bobbuy_access_token', sessionAccessToken);
      window.localStorage.setItem('bobbuy_access_token_expires_at', '2099-12-31T23:59:59Z');
      window.localStorage.setItem('bobbuy_refresh_token_expires_at', '2099-12-31T23:59:59Z');
      window.localStorage.setItem('bobbuy_auth_user', JSON.stringify(sessionUser));
      window.localStorage.setItem('bobbuy_chat_sender_id', String(sessionUser.id));
      window.localStorage.setItem('bobbuy_disable_chat_websocket', 'true');
      window.localStorage.removeItem('bobbuy_refresh_token');
      window.localStorage.removeItem('bobbuy_test_role');
      window.localStorage.removeItem('bobbuy_test_user');
      window.localStorage.removeItem('bobbuy_user_role');
    },
    { sessionUser: user, sessionAccessToken: accessToken }
  );
}

export async function assertNoHorizontalOverflow(page: Page) {
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const before = window.scrollX;
    window.scrollBy(120, 0);
    const after = window.scrollX;
    if (after > 0) window.scrollTo(0, window.scrollY);
    const widthOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    return {
      canScrollHorizontally: after > before,
      widthOverflow
    };
  });
  expect(result.canScrollHorizontally, 'User should not be able to scroll horizontally').toBe(false);
  expect(result.widthOverflow, 'Page should not exceed viewport width').toBeLessThanOrEqual(1);
}

export async function setupCommonMocks(page: Page) {
  // [Fallback] Must stay first: this absorbs non-essential `/api/**` calls and prevents
  // Vite proxy ECONNREFUSED noise in regular local E2E runs.
  // Any spec-level overrides should be registered after setupCommonMocks(page).
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: {} }) })
  );

  await page.route('**/api/auth/me', async (route) => {
    const session = resolveSessionFromRequest(route.request().headers());
    if (!session) {
      await route.fulfill({ status: 401, body: JSON.stringify({ status: 'error', message: 'Unauthorized' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ status: 'success', data: session.user })
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    let payload: { username?: string } = {};
    try {
      payload = route.request().postDataJSON() as { username?: string };
    } catch {
      payload = {};
    }
    const role: MockRole = payload.username === 'agent' ? 'AGENT' : 'CUSTOMER';
    const user = MOCK_USERS[role];
    await route.fulfill({
      status: 200,
      headers: {
        'Set-Cookie': [
          `bobbuy_refresh_token=${REFRESH_TOKEN_BY_ROLE[role]}; Path=/api/auth; HttpOnly; SameSite=Lax`,
          `bobbuy_csrf_token=${CSRF_TOKEN_BY_ROLE[role]}; Path=/; SameSite=Lax`
        ].join(', ')
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          accessToken: ACCESS_TOKEN_BY_ROLE[role],
          accessTokenExpiresAt: '2099-12-31T23:59:59Z',
          refreshTokenExpiresAt: '2099-12-31T23:59:59Z',
          user
        }
      })
    });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    const session = resolveSessionFromRequest(route.request().headers());
    const csrfHeader = route.request().headers()['x-bobbuy-csrf-token'];
    const cookieHeader = route.request().headers().cookie ?? '';
    if (!session) {
      await route.fulfill({ status: 401, body: JSON.stringify({ status: 'error', message: 'Unauthorized' }) });
      return;
    }
    const csrfCookie = CSRF_TOKEN_BY_ROLE[session.user.role];
    const refreshCookie = REFRESH_TOKEN_BY_ROLE[session.user.role];
    if (!csrfHeader || csrfHeader !== csrfCookie || !cookieHeader.includes(`bobbuy_refresh_token=${refreshCookie}`)) {
      await route.fulfill({ status: 403, body: JSON.stringify({ status: 'error', message: 'Invalid CSRF token' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Set-Cookie': `bobbuy_refresh_token=${refreshCookie}; Path=/api/auth; HttpOnly; SameSite=Lax`
      },
      body: JSON.stringify({
        status: 'success',
        data: {
          accessToken: ACCESS_TOKEN_BY_ROLE[session.user.role],
          accessTokenExpiresAt: '2099-12-31T23:59:59Z',
          refreshTokenExpiresAt: '2099-12-31T23:59:59Z',
          user: session.user
        }
      })
    });
  });

  await page.route('**/api/auth/logout', async (route) => {
    const session = resolveSessionFromRequest(route.request().headers());
    const csrfHeader = route.request().headers()['x-bobbuy-csrf-token'];
    const cookieHeader = route.request().headers().cookie ?? '';
    if (!session) {
      await route.fulfill({ status: 401, body: JSON.stringify({ status: 'error', message: 'Unauthorized' }) });
      return;
    }
    const csrfCookie = CSRF_TOKEN_BY_ROLE[session.user.role];
    const refreshCookie = REFRESH_TOKEN_BY_ROLE[session.user.role];
    if (!csrfHeader || csrfHeader !== csrfCookie || !cookieHeader.includes(`bobbuy_refresh_token=${refreshCookie}`)) {
      await route.fulfill({ status: 403, body: JSON.stringify({ status: 'error', message: 'Invalid CSRF token' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Set-Cookie': 'bobbuy_refresh_token=; Max-Age=0; Path=/api/auth; HttpOnly; SameSite=Lax'
      },
      body: JSON.stringify({ status: 'success', data: { revoked: true } })
    });
  });

  await page.route('**/api/trips/*/procurement-list', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [
          {
            skuId: 'SKU-001',
            itemName: 'Matcha',
            totalQuantity: 5,
            purchasedQuantity: 1,
            unitPrice: 32.5,
            businessIds: ['BIZ-1001']
          }
        ]
      })
    })
  );

  await page.route('**/api/trips**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: MOCK_TRIPS }) })
  );

  await page.route('**/api/orders**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: MOCK_ORDERS, meta: { total: 1 } }) })
  );

  await page.route('**/api/users**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{ id: 1001, name: 'Alice Wang', role: 'CUSTOMER', rating: 4.7 }]
      })
    })
  );

  await page.route('**/api/metrics', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ status: 'success', data: { users: 2, trips: 1, orders: 1, gmV: 65, orderStatusCounts: { CONFIRMED: 1 } } })
    })
  );

  await page.route('**/api/ai/parse', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: {
          items: [{ id: 'ai-1', originalName: 'Matcha', matchedName: 'Matcha', quantity: 1, note: '', price: 32.5, confidence: 0.95 }]
        }
      })
    })
  );

  await page.route('**/api/ai/experience/confirm', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: {} }) })
  );

  await page.route('**/api/chat/**/cursor**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ status: 'success', data: { messages: [], nextCursor: null, hasMore: false } })
    })
  );

  await page.route('**/api/chat/**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/procurement/*/hud', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: {
          tripId: 2000,
          currentFxRate: 1,
          referenceFxRate: 1,
          currentPurchasedAmount: 65,
          totalTripExpenses: 0,
          totalEstimatedProfit: 10,
          currentWeight: 1,
          currentVolume: 1,
          categoryCompletionPercent: {},
          partnerShares: []
        }
      })
    })
  );

  await page.route('**/api/procurement/*/ledger', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          tripId: 2000,
          businessId: 'BIZ-1001',
          customerId: 1001,
          totalReceivable: 65,
          paidDeposit: 0,
          outstandingBalance: 65,
          settlementStatus: 'PENDING_CONFIRMATION',
          settlementFrozen: false,
          settlementFreezeStage: 'ACTIVE',
          settlementFreezeReason: '',
          orderLines: [{ skuId: 'SKU-001', itemName: 'Matcha', orderedQuantity: 2, purchasedQuantity: 1, unitPrice: 32.5, differenceNote: 'Short shipped 1' }]
        }]
      })
    })
  );

  await page.route('**/api/procurement/*/picking', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          businessId: 'BIZ-1001',
          customerId: 1001,
          customerName: 'Alice Wang',
          deliveryStatus: 'PENDING_DELIVERY',
          addressSummary: 'Shanghai Pudong Century Ave 88',
          readyForDelivery: false,
          items: [{
            skuId: 'SKU-001',
            itemName: 'Matcha',
            orderedQuantity: 2,
            pickedQuantity: 1,
            checked: false,
            labels: ['SHORT_SHIPPED']
          }]
        }]
      })
    })
  );

  await page.route('**/api/procurement/*/picking/*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: {
          businessId: 'BIZ-1001',
          customerId: 1001,
          customerName: 'Alice Wang',
          deliveryStatus: 'READY_FOR_DELIVERY',
          addressSummary: 'Shanghai Pudong Century Ave 88',
          readyForDelivery: true,
          items: [{
            skuId: 'SKU-001',
            itemName: 'Matcha',
            orderedQuantity: 2,
            pickedQuantity: 1,
            checked: true,
            labels: ['SHORT_SHIPPED']
          }]
        }
      })
    })
  );

  await page.route('**/api/procurement/*/delivery-preparations/export', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'businessId,customerName,deliveryStatus,addressSummary\nBIZ-1001,Alice Wang,PENDING_DELIVERY,Shanghai Pudong Century Ave 88\n'
    })
  );

  await page.route('**/api/procurement/*/delivery-preparations', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          businessId: 'BIZ-1001',
          customerId: 1001,
          customerName: 'Alice Wang',
          deliveryStatus: 'PENDING_DELIVERY',
          addressSummary: 'Shanghai Pudong Century Ave 88',
          routeCoordinates: '31.2304,121.4737',
          totalPickItems: 1,
          pickedItems: 0
        }]
      })
    })
  );

  await page.route('**/api/procurement/*/receipts', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          id: 11,
          tripId: 2000,
          fileName: 'receipt-1.jpg',
          originalImageUrl: 'https://example.com/receipt.jpg',
          thumbnailUrl: 'https://example.com/receipt.jpg',
          processingStatus: 'READY_FOR_REVIEW',
          uploadedAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          reconciliationResult: {
            receiptItems: [{ name: 'Matcha', quantity: 1, unitPrice: 32.5 }],
            matchedOrderLines: [],
            unmatchedReceiptItems: [{ name: 'Store sample item', quantity: 1, disposition: 'UNREVIEWED' }],
            missingOrderedItems: [],
            selfUseItems: []
          }
        }]
      })
    })
  );

  await page.route('**/api/procurement/*/profit-sharing', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: { tripId: 2000, purchaserRatioPercent: 70, promoterRatioPercent: 30, shares: [] }
      })
    })
  );

  await page.route('**/api/procurement/*/expenses', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/procurement/*/logistics', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/procurement/*/deficit', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/procurement/*/audit-logs', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/procurement/wallets/*/transactions', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{ id: 9000, partnerId: 'PURCHASER', amount: 45.2, type: 'TRIP_PAYOUT', tripId: 2000, createdAt: '2026-01-01T00:00:00Z' }]
      })
    })
  );

  await page.route('**/api/procurement/wallets/*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: { partnerId: 'PURCHASER', balance: 1250.5, currency: 'CNY', updatedAt: '2026-01-01T00:00:00Z' }
      })
    })
  );

  await page.route('**/api/mobile/products**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [
          {
            product: {
              id: 'SKU-001',
              name: { 'en-US': 'Matcha Kit', 'zh-CN': '抹茶套装', 'ja-JP': '抹茶セット' },
              description: { 'en-US': 'Ready-to-buy matcha set' },
              brand: 'BOBBuy',
              basePrice: 32.5,
              categoryId: 'cat-1000',
              itemNumber: 'SKU-001',
              isRecommended: true,
              visibilityStatus: 'PUBLIC',
              mediaGallery: [{ url: '/assets/products/milk.png', type: 'image' }],
              attributes: { netContent: '120g', storageHint: 'Ambient' },
              priceTiers: []
            },
            displayName: 'Matcha Kit',
            displayDescription: 'Ready-to-buy matcha set'
          }
        ],
        meta: { total: 1 }
      })
    })
  );

  await page.route('**/api/mobile/categories**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/mobile/suppliers**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );

  await page.route('**/api/financial/audit/**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
}

function resolveSessionFromRequest(headers: Record<string, string | undefined>) {
  const authorization = headers.authorization?.trim();
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  const cookieHeader = headers.cookie ?? '';
  const refreshToken = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('bobbuy_refresh_token='))
    ?.slice('bobbuy_refresh_token='.length);
  const role = (
    Object.entries(ACCESS_TOKEN_BY_ROLE).find(([, token]) => token === accessToken)?.[0] ??
    Object.entries(REFRESH_TOKEN_BY_ROLE).find(([, token]) => token === refreshToken)?.[0] ??
    null
  ) as MockRole | null;
  if (!role) {
    return null;
  }
  return {
    user: MOCK_USERS[role]
  };
}
