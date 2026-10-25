import { expect, test } from '@playwright/test';
import { setAgentContext, setCustomerContext, setupCommonMocks } from './responsive_helpers';

async function setupProcurementPageMocks(
  page: import('@playwright/test').Page,
  options?: {
    frozen?: boolean;
    checklist?: Array<Record<string, any>>;
  }
) {
  await setupCommonMocks(page);
  const checklist = options?.checklist ?? [{
    businessId: 'BIZ-1001',
    customerId: 1001,
    customerName: 'Alice Wang',
    deliveryStatus: 'PENDING_DELIVERY',
    addressSummary: 'Shanghai Pudong Century Ave 88',
    readyForDelivery: false,
    items: [{ skuId: 'SKU-001', itemName: 'Matcha', orderedQuantity: 2, pickedQuantity: 1, checked: false, labels: ['SHORT_SHIPPED'] }]
  }];
  const frozen = Boolean(options?.frozen);
  const trip = {
    id: 2000,
    agentId: 1000,
    deliveryArea: 'Shanghai',
    deliveryDate: '2026-04-20',



    status: frozen ? 'COMPLETED' : 'PUBLISHED',
    settlementFrozen: frozen,
    settlementFreezeStage: frozen ? 'DELIVERY_PENDING_SETTLEMENT' : 'ACTIVE',
    settlementFreezeReason: frozen ? 'Trip completed and frozen for settlement' : ''
  };

  await page.route('**/api/trips**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [trip] }) })
  );
  await page.route('**/api/orders**', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          id: 3000,
          businessId: 'BIZ-1001',
          customerId: 1001,
          tripId: 2000,
          status: 'CONFIRMED',
          totalAmount: 65,
          lines: [{ skuId: 'SKU-001', itemName: 'Matcha', quantity: 2, purchasedQuantity: 1, unitPrice: 32.5 }]
        }]
      })
    })
  );
  await page.route('**/api/procurement/2000/hud', (route) =>
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
  await page.route('**/api/procurement/2000/expenses', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
  await page.route('**/api/procurement/2000/audit-logs', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
  await page.route('**/api/procurement/2000/ledger', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          tripId: 2000,
          businessId: 'BIZ-1001',
          customerId: 1001,
          customerName: 'Alice Wang',
          totalReceivable: 65,
          paidDeposit: 0,
          outstandingBalance: 65,
          amountDueThisTrip: 65,
          amountReceivedThisTrip: 0,
          amountPendingThisTrip: 65,
          settlementStatus: 'PENDING_CONFIRMATION',
          settlementFrozen: frozen,
          settlementFreezeStage: trip.settlementFreezeStage,
          settlementFreezeReason: trip.settlementFreezeReason,
          orderLines: [{ skuId: 'SKU-001', itemName: 'Matcha', orderedQuantity: 2, purchasedQuantity: 1, unitPrice: 32.5, differenceNote: 'Short shipped 1' }]
        }]
      })
    })
  );
  await page.route('**/api/procurement/2000/profit-sharing', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: { tripId: 2000, purchaserRatioPercent: 70, promoterRatioPercent: 30, shares: [] } }) })
  );
  await page.route('**/api/procurement/2000/logistics', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
  await page.route('**/api/procurement/2000/deficit', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
  await page.route('**/api/procurement/2000/receipts', (route) =>
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
  await page.route('**/api/procurement/2000/delivery-preparations', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: [{
          businessId: 'BIZ-1001',
          customerId: 1001,
          customerName: 'Alice Wang',
          deliveryStatus: checklist[0]?.deliveryStatus ?? 'PENDING_DELIVERY',
          addressSummary: 'Shanghai Pudong Century Ave 88',
          totalPickItems: 1,
          pickedItems: checklist[0]?.readyForDelivery ? 1 : 0
        }]
      })
    })
  );
  await page.route('**/api/procurement/2000/picking', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: checklist }) })
  );
  await page.route('**/api/procurement/wallets/PURCHASER/transactions', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
  await page.route('**/api/procurement/wallets/*', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ status: 'success', data: { partnerId: 'PURCHASER', balance: 0, currency: 'CNY', updatedAt: '2026-01-01T00:00:00Z' } })
    })
  );
  await page.route('**/api/chat/**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: [] }) })
  );
}

test('client billing confirmation posts irreversible action', async ({ page }) => {
  let confirmedAction = '';
  await setupCommonMocks(page);
  await page.route('**/api/procurement/2000/ledger/BIZ-1001/confirm', async (route) => {
    const payload = await route.request().postDataJSON();
    confirmedAction = payload.action;
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        status: 'success',
        data: {
          tripId: 2000,
          businessId: 'BIZ-1001',
          customerId: 1001,
          totalReceivable: 65,
          paidDeposit: 0,
          outstandingBalance: 65,
          settlementStatus: 'RECEIPT_CONFIRMED',
          settlementFrozen: false,
          settlementFreezeStage: 'ACTIVE',
          settlementFreezeReason: '',
          receiptConfirmedAt: '2026-01-01T00:00:00Z',
          receiptConfirmedBy: '1001',
          orderLines: []
        }
      })
    });
  });
  await setCustomerContext(page);
  await page.goto('/client/billing');
  await page.getByRole('button', { name: 'Confirm receipt' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => confirmedAction).toBe('RECEIPT');
});

test('settlement frozen trip disables order mutations and shows receipt workbench', async ({ page }) => {
  await setupProcurementPageMocks(page, { frozen: true });
  await setAgentContext(page);
  await page.goto('/procurement');
  await expect(page.getByText('Procurement Receipt Workbench')).toBeVisible();
  await expect(page.getByRole('alert').getByText('Trip completed and frozen for settlement')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save reconciliation' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Record Offline Payment' })).toBeDisabled();

  await page.goto('/picking');
  await expect(page.getByRole('alert').getByText('Trip completed and frozen for settlement')).toBeVisible();
  await expect(page.getByRole('checkbox').first()).toBeDisabled();
});

test('procurement picking updates are reflected on the picking page', async ({ page }) => {
  let updated = false;
  let checklist = [
    {
      businessId: 'BIZ-1001',
      customerId: 1001,
      customerName: 'Alice Wang',
      deliveryStatus: 'PENDING_DELIVERY',
      addressSummary: 'Shanghai Pudong Century Ave 88',
      readyForDelivery: false,
      items: [{ skuId: 'SKU-001', itemName: 'Matcha', orderedQuantity: 2, pickedQuantity: 1, checked: false, labels: ['SHORT_SHIPPED'] }]
    }
  ];

  await setupProcurementPageMocks(page, { checklist });
  await page.route('**/api/procurement/2000/picking/BIZ-1001', async (route) => {
    updated = true;
    checklist[0] = {
      ...checklist[0],
      deliveryStatus: 'READY_FOR_DELIVERY',
      readyForDelivery: true,
      items: checklist[0].items.map((item) => ({ ...item, checked: true }))
    };
    await route.fulfill({ status: 200, body: JSON.stringify({ status: 'success', data: checklist[0] }) });
  });

  await setAgentContext(page);
  await page.goto('/procurement');
  await page.getByRole('checkbox').first().click();
  await expect.poll(() => updated).toBe(true);

  await page.goto('/picking');
  await expect(page.getByText('Ready for Delivery')).toBeVisible();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
});
