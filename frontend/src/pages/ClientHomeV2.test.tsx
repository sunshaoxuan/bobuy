import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import { UserRoleProvider } from '../context/UserRoleContext';
import ClientHomeV2 from './ClientHomeV2';

vi.mock('../components/ChatWidget', () => ({
  default: () => <div data-testid="chat-widget" />
}));

vi.mock('../api', () => ({
  api: {
    trips: () =>
      Promise.resolve([
        {
          id: 2000,
          agentId: 1000,
          deliveryArea: 'Shanghai',
          deliveryDate: '2026-04-20',



          status: 'PUBLISHED'
        }
      ]),
    products: () =>
      Promise.resolve([
        {
          product: {
            id: 'prd-1',
            name: { 'zh-CN': '抹茶礼盒' },
            basePrice: 99.5,
            mediaGallery: []
          },
          displayName: '抹茶礼盒',
          displayDescription: '限定风味'
        }
      ]),
    orders: () =>
      Promise.resolve([
        {
          id: 3000,
          businessId: 'BIZ-001',
          customerId: 1001,
          tripId: 2000,
          status: 'CONFIRMED',
          totalAmount: 99.5,
          lines: [{ skuId: 'SKU-1', itemName: '抹茶礼盒', quantity: 1, unitPrice: 99.5 }]
        }
      ]),
    customerBalanceLedger: () =>
      Promise.resolve([
        {
          businessId: 'BIZ-001',
          customerId: 1001,
          totalReceivable: 99.5,
          paidDeposit: 20,
          outstandingBalance: 79.5
        }
      ]),
    exportCustomerStatement: () => Promise.resolve(new Blob(['pdf'])),
    getWallet: () =>
      Promise.resolve({
        partnerId: 'PURCHASER',
        balance: 100,
        currency: 'CNY',
        updatedAt: '2026-04-20T00:00:00Z'
      }),
    quickOrder: () => Promise.resolve({})
  }
}));

describe('ClientHomeV2', () => {
  it('renders zen home sections and live narrative', async () => {
    render(
      <I18nProvider>
        <UserRoleProvider>
          <BrowserRouter>
            <ClientHomeV2 />
          </BrowserRouter>
        </UserRoleProvider>
      </I18nProvider>
    );

    expect(await screen.findByText('文雅、高级、干干净净')).toBeInTheDocument();
    expect((await screen.findAllByText('抹茶礼盒')).length).toBeGreaterThan(0);
    expect(await screen.findByText('BIZ-001 刚刚购入了 抹茶礼盒')).toBeInTheDocument();
    expect(await screen.findByText('待付尾款')).toBeInTheDocument();
  });
});
