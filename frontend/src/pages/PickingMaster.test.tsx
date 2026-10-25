import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PickingMaster from './PickingMaster';
import { I18nProvider } from '../i18n';

const { tripsMock, checklistMock, updateChecklistMock } = vi.hoisted(() => ({
  tripsMock: vi.fn(),
  checklistMock: vi.fn(),
  updateChecklistMock: vi.fn()
}));

vi.mock('antd', async () => {
  const antd = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...antd,
    Select: ({ options = [], onChange, value, ...props }: any) => (
      <select
        aria-label="trip-select"
        data-testid={props['data-testid']}
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
      >
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  };
});

vi.mock('../api', () => ({
  api: {
    trips: tripsMock,
    procurementPickingChecklist: checklistMock,
    updateProcurementPickingChecklist: updateChecklistMock
  }
}));

describe('PickingMaster', () => {
  beforeEach(() => {
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    tripsMock.mockResolvedValue([
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
    ]);
    checklistMock.mockResolvedValue([
      {
        businessId: 'BIZ-001',
        customerId: 1001,
        customerName: 'Alice',
        deliveryStatus: 'PENDING_DELIVERY',
        addressSummary: 'Shanghai Pudong Century Ave 88',
        readyForDelivery: false,
        items: [{ skuId: 'prd-1000', itemName: 'Matcha Kit', orderedQuantity: 2, pickedQuantity: 1, checked: false, labels: ['SHORT_SHIPPED'] }]
      },
      {
        businessId: 'BIZ-002',
        customerId: 1002,
        customerName: 'Bob',
        deliveryStatus: 'READY_FOR_DELIVERY',
        addressSummary: 'Shanghai Hongqiao',
        readyForDelivery: true,
        items: [{ skuId: 'prd-1001', itemName: 'Tokyo Banana', orderedQuantity: 1, pickedQuantity: 1, checked: true, labels: ['ON_SITE_REPLENISHED'] }]
      }
    ]);
    updateChecklistMock.mockResolvedValue({
      businessId: 'BIZ-001',
      customerId: 1001,
      customerName: 'Alice',
      deliveryStatus: 'READY_FOR_DELIVERY',
      addressSummary: 'Shanghai Pudong Century Ave 88',
      readyForDelivery: true,
      items: [{ skuId: 'prd-1000', itemName: 'Matcha Kit', orderedQuantity: 2, pickedQuantity: 1, checked: true, labels: ['SHORT_SHIPPED'] }]
    });
  });

  afterEach(() => {
    window.localStorage.removeItem('bobbuy_locale');
  });

  it('renders reviewed picking checklist items and labels', async () => {
    render(
      <I18nProvider>
        <BrowserRouter>
          <PickingMaster />
        </BrowserRouter>
      </I18nProvider>
    );

    expect((await screen.findAllByText(/Picking Master/i)).length).toBeGreaterThan(0);
    expect(await screen.findByText('Matcha Kit')).toBeInTheDocument();
    expect(await screen.findByText('Tokyo Banana')).toBeInTheDocument();
    expect(await screen.findByText('Short shipped')).toBeInTheDocument();
    expect(await screen.findByText('On-site replenished')).toBeInTheDocument();
  });

  it('filters entries by delivery readiness', async () => {
    render(
      <I18nProvider>
        <BrowserRouter>
          <PickingMaster />
        </BrowserRouter>
      </I18nProvider>
    );

    expect(await screen.findByText('Matcha Kit')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /To Pick/i }));
    expect(screen.getByText('Matcha Kit')).toBeInTheDocument();
    expect(screen.queryByText('Tokyo Banana')).not.toBeInTheDocument();
  });

  it('updates checklist state through the picking checklist api', async () => {
    render(
      <I18nProvider>
        <BrowserRouter>
          <PickingMaster />
        </BrowserRouter>
      </I18nProvider>
    );

    const checkbox = (await screen.findAllByRole('checkbox'))[0];
    fireEvent.click(checkbox);

    await waitFor(() => expect(updateChecklistMock).toHaveBeenCalledWith(2000, 'BIZ-001', { skuId: 'prd-1000', checked: true }));
    expect((await screen.findAllByText('Ready for Delivery')).length).toBeGreaterThan(0);
  });
});
