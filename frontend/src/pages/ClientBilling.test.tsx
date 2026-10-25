import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClientBilling from './ClientBilling';
import { I18nProvider } from '../i18n';

const { confirmSpy, modalConfirmSpy } = vi.hoisted(() => ({
  confirmSpy: vi.fn(),
  modalConfirmSpy: vi.fn()
}));

const { tripsMock, ledgerMock } = vi.hoisted(() => ({
  tripsMock: vi.fn(),
  ledgerMock: vi.fn()
}));

vi.mock('antd', async () => {
  const antd = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...antd,
    Table: ({ dataSource = [] }: any) => <div>{dataSource.map((item: any) => item.itemName ?? '').join(' ')}</div>,
    Select: ({ options = [], onChange, value }: any) => (
      <select value={value} onChange={(event) => onChange?.(Number(event.target.value))}>
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    Modal: {
      ...antd.Modal,
      confirm: (config: any) => {
        modalConfirmSpy(config);
        return config.onOk?.();
      }
    },
    message: {
      success: vi.fn(),
      error: vi.fn()
    }
  };
});

vi.mock('../api', () => ({
  api: {
    customerTrips: tripsMock,
    customerViewLedger: ledgerMock,
    confirmOwnLedger: confirmSpy
  }
}));

describe('ClientBilling', () => {
  beforeEach(() => {
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    confirmSpy.mockReset();
    modalConfirmSpy.mockReset();
    confirmSpy.mockResolvedValue({});
    tripsMock.mockResolvedValue([{ id: 2000, agentId: 1, deliveryArea: 'Shanghai', deliveryDate: '2026-01-01', status: 'PUBLISHED', settlementFrozen: false, settlementFreezeStage: 'ACTIVE', settlementFreezeReason: '' }]);
    ledgerMock.mockResolvedValue([
      {
        tripId: 2000,
        businessId: 'BIZ-1001',
        customerId: 1001,
        customerName: 'Chen Li',
        totalReceivable: 100,
        paidDeposit: 10,
        outstandingBalance: 90,
        amountDueThisTrip: 100,
        amountReceivedThisTrip: 10,
        amountPendingThisTrip: 90,
        balanceBeforeCarryForward: 0,
        balanceAfterCarryForward: -90,
        settlementStatus: 'PENDING_CONFIRMATION',
        deliveryStatus: 'READY_FOR_DELIVERY',
        deliveryAddressSummary: 'Shanghai Pudong Century Ave 88',
        settlementFrozen: false,
        settlementFreezeStage: 'ACTIVE',
        settlementFreezeReason: '',
        paymentRecords: [{ id: 1, tripId: 2000, businessId: 'BIZ-1001', customerId: 1001, amount: 10, paymentMethod: 'CASH', createdAt: '2026-01-01T00:00:00' }],
        orderLines: [{ skuId: 'SKU-1', itemName: 'Matcha', orderedQuantity: 2, purchasedQuantity: 1, unitPrice: 50, differenceNote: 'Short shipped 1' }]
      }
    ]);
  });

  it('renders detailed bill and triggers receipt confirmation', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <ClientBilling />
      </I18nProvider>
    );

    expect(await screen.findByText(/BIZ-1001/)).toBeInTheDocument();
    expect(await screen.findByText('Matcha')).toBeInTheDocument();
    expect(await screen.findAllByText('Pending confirmation')).not.toHaveLength(0);
    expect(screen.queryByText('PENDING_CONFIRMATION')).not.toBeInTheDocument();
    expect(await screen.findByText(/CASH ·/)).toBeInTheDocument();
    expect(await screen.findByText('Shanghai Pudong Century Ave 88')).toBeInTheDocument();
    expect(await screen.findByText('Ready for Delivery')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm receipt' }));
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith(2000, 'BIZ-1001', 'RECEIPT'));
    expect(modalConfirmSpy).toHaveBeenCalled();
  });

  it('allows receipt confirmation after delivery completion', async () => {
    tripsMock.mockResolvedValue([{ id: 2000, deliveryArea: 'Shanghai', deliveryDate: '2026-11-01', status: 'COMPLETED', settlementFrozen: true }]);
    const user = userEvent.setup();
    render(<I18nProvider><ClientBilling /></I18nProvider>);
    const button = await screen.findByRole('button', { name: 'Confirm receipt' });
    await user.click(button);
    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith(2000, 'BIZ-1001', 'RECEIPT'));
  });

  it('disables confirmation actions after final settlement', async () => {
    tripsMock.mockResolvedValue([{ id: 2000, agentId: 1, deliveryArea: 'Shanghai', deliveryDate: '2026-01-01', status: 'SETTLED', settlementFrozen: true, settlementFreezeStage: 'SETTLED_FROZEN', settlementFreezeReason: 'Trip completed and frozen for settlement' }]);
    ledgerMock.mockResolvedValue([
      {
        tripId: 2000,
        businessId: 'BIZ-1001',
        customerId: 1001,
        customerName: 'Chen Li',
        totalReceivable: 100,
        paidDeposit: 10,
        outstandingBalance: 90,
        amountDueThisTrip: 100,
        amountReceivedThisTrip: 10,
        amountPendingThisTrip: 90,
        balanceBeforeCarryForward: 0,
        balanceAfterCarryForward: -90,
        settlementStatus: 'PENDING_CONFIRMATION',
        deliveryStatus: 'PENDING_DELIVERY',
        deliveryAddressSummary: 'Shanghai Pudong Century Ave 88',
        settlementFrozen: true,
        settlementFreezeStage: 'DELIVERY_PENDING_SETTLEMENT',
        settlementFreezeReason: 'Trip completed and frozen for settlement',
        paymentRecords: [],
        orderLines: [{ skuId: 'SKU-1', itemName: 'Matcha', orderedQuantity: 2, purchasedQuantity: 1, unitPrice: 50, differenceNote: 'Short shipped 1' }]
      }
    ]);

    render(
      <I18nProvider>
        <ClientBilling />
      </I18nProvider>
    );

    await screen.findByRole('button', { name: 'Confirm receipt' });
    expect(screen.getAllByText('Settlement completed. This bill is read-only.')).toHaveLength(2);
    expect(screen.queryByText('Trip completed and frozen for settlement')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm receipt' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirm statement' })).toBeDisabled();
  });
});
