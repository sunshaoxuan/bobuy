import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Orders from '../Orders';
import { I18nProvider } from '../../i18n';
import { api } from '../../api';
import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', async () => {
  const antd = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...antd,
    message: {
      success: vi.fn(),
      error: vi.fn()
    },
    Select: ({ value, onChange, options = [], disabled, placeholder }: any) => (
      <select
        aria-label={placeholder ?? 'select'}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={disabled}
      >
        <option value="" disabled>
          {placeholder ?? 'select'}
        </option>
        {options.map((option: { value: string; label?: string }) => (
          <option key={option.value} value={option.value}>
            {option.label ?? option.value}
          </option>
        ))}
      </select>
    ),
    InputNumber: ({ value, onChange, ...props }: any) => {
      const safeValue = Number.isFinite(value) ? value : '';
      return (
        <input
          type="number"
          value={safeValue}
          onChange={(event) => {
            const next = event.target.value;
            onChange?.(next === '' ? undefined : Number(next));
          }}
          {...props}
        />
      );
    },
    Collapse: ({ items = [] }: any) => (
      <div data-testid="collapse">
        {items.map((item: any) => (
          <div key={item.key}>
            <div>{item.label}</div>
            <div>{item.children}</div>
          </div>
        ))}
      </div>
    ),
    Table: ({ dataSource = [], locale }: any) => (
      <div data-testid="table">
        {dataSource.length === 0 ? locale?.emptyText : null}
      </div>
    )
  };
});

vi.mock('../../api', () => ({
  api: {
    trips: vi.fn(),
    orders: vi.fn(),
    createOrder: vi.fn()
  }
}));

const mockApi = api as unknown as {
  trips: ReturnType<typeof vi.fn>;
  orders: ReturnType<typeof vi.fn>;
  createOrder: ReturnType<typeof vi.fn>;
};

const renderOrders = () =>
  render(
    <I18nProvider>
      <Orders />
    </I18nProvider>
  );

const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByPlaceholderText('Enter customer ID'), '1001');
  await user.type(screen.getByPlaceholderText('Enter trip ID'), '2000');
  await user.type(screen.getByPlaceholderText('e.g. Limited Edition Sneakers'), 'Matcha Kit');
};

describe('Orders page', () => {
  beforeEach(() => {
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    mockApi.trips.mockReset();
    mockApi.orders.mockReset();
    mockApi.createOrder.mockReset();
    (message.success as ReturnType<typeof vi.fn>).mockReset();
    (message.error as ReturnType<typeof vi.fn>).mockReset();

    mockApi.trips.mockResolvedValue([
      {
        id: 2000,
        agentId: 1000,
        deliveryArea: 'Shanghai',
        deliveryDate: '2026-02-01',



        status: 'PUBLISHED',
        settlementFrozen: false,
        settlementFreezeStage: 'ACTIVE',
        settlementFreezeReason: ''
      }
    ]);
    mockApi.orders.mockResolvedValue([]);
  });

  it('submits the form and refreshes the list', async () => {
    const user = userEvent.setup();
    mockApi.createOrder.mockResolvedValue({
      id: 3001,
      businessId: '20260117001',
      customerId: 1001,
      tripId: 2000,
      status: 'NEW',
      totalAmount: 71,
      lines: [
        { skuId: 'SKU-MATCHA', itemName: 'Matcha Kit', quantity: 2, unitPrice: 32.5 }
      ]
    });

    renderOrders();
    await waitFor(() => expect(mockApi.trips).toHaveBeenCalled());
    await waitFor(() => expect(mockApi.orders).toHaveBeenCalledWith(2000));

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create Order' }));

    await waitFor(() => expect(mockApi.createOrder).toHaveBeenCalled());
    expect(mockApi.orders.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    renderOrders();
    await waitFor(() => expect(mockApi.trips).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Create Order' }));

    expect(await screen.findByText('Please enter customer ID')).toBeInTheDocument();
    expect(await screen.findByText('Please enter item name')).toBeInTheDocument();
  });

  it('shows success feedback after a successful submit', async () => {
    const user = userEvent.setup();
    mockApi.createOrder.mockResolvedValue({
      id: 3001,
      businessId: '20260117001',
      customerId: 1001,
      tripId: 2000,
      status: 'NEW',
      totalAmount: 71,
      lines: [
        { skuId: 'SKU-MATCHA', itemName: 'Matcha Kit', quantity: 2, unitPrice: 32.5 }
      ]
    });

    renderOrders();
    await waitFor(() => expect(mockApi.trips).toHaveBeenCalled());

    await fillRequiredFields(user);
    await user.click(screen.getByRole('button', { name: 'Create Order' }));

    await waitFor(() =>
      expect(message.success).toHaveBeenCalledWith('Order created successfully')
    );
  });

  it('renders order header and line items when data is available', async () => {
    mockApi.orders.mockResolvedValueOnce([
      {
        id: 3000,
        businessId: 'BIZ-001',
        customerId: 1001,
        tripId: 2000,
        status: 'CONFIRMED',
        totalAmount: 65,
        lines: [
          { id: 1, skuId: 'SKU001', itemName: 'Matcha Kit', quantity: 2, unitPrice: 32.5 }
        ]
      }
    ]);

    renderOrders();
    await waitFor(() => expect(mockApi.orders).toHaveBeenCalledWith(2000));

    const collapse = await screen.findByTestId('collapse');
    expect(within(collapse).getByText('BIZ-001')).toBeInTheDocument();
  });

  it('disables create flow when trip is settlement frozen', async () => {
    const user = userEvent.setup();
    mockApi.trips.mockResolvedValueOnce([
      {
        id: 2000,
        agentId: 1000,
        deliveryArea: 'Shanghai',
        deliveryDate: '2026-02-01',



        status: 'COMPLETED',
        settlementFrozen: true,
        settlementFreezeStage: 'DELIVERY_PENDING_SETTLEMENT',
        settlementFreezeReason: 'Frozen'
      }
    ]);

    renderOrders();
    await waitFor(() => expect(mockApi.trips).toHaveBeenCalled());
    const submitButton = await screen.findByRole('button', { name: 'Create Order' });
    expect(submitButton).toBeDisabled();
    await fillRequiredFields(user);
    await user.click(submitButton);
    expect(mockApi.createOrder).not.toHaveBeenCalled();
  });
});
