import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import Trips from '../Trips';
import { I18nProvider } from '../../i18n';
import { api } from '../../api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('antd', async () => {
  const antd = await vi.importActual<typeof import('antd')>('antd');
  return { ...antd, message: { success: vi.fn(), error: vi.fn() },
    DatePicker: ({ value, onChange, ...props }: any) => <input {...props} type="date" value={value?.format('YYYY-MM-DD') ?? ''}
      onChange={event => onChange?.(event.target.value ? dayjs(event.target.value) : null)} /> };
});
vi.mock('../../api', () => ({ api: { trips: vi.fn(), createTrip: vi.fn(), updateTrip: vi.fn() } }));
const mockApi = vi.mocked(api);
const trip = { id: 2001, agentId: 1000, deliveryArea: 'Seoul region', deliveryDate: '2026-11-01', status: 'PUBLISHED', settlementFrozen: false };
const show = () => render(<I18nProvider><Trips /></I18nProvider>);

describe('Regional delivery management', () => {
  beforeEach(() => {
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    vi.clearAllMocks();
    mockApi.trips.mockResolvedValue([]);
    mockApi.createTrip.mockResolvedValue(trip);
    mockApi.updateTrip.mockResolvedValue(trip);
    Element.prototype.scrollIntoView = vi.fn();
  });
  it('publishes only area and delivery date', async () => {
    const user = userEvent.setup(); show();
    await user.type(screen.getByLabelText('Delivery Area'), 'Seoul region');
    await user.type(screen.getByLabelText('Delivery Date'), '2026-11-01');
    await user.click(screen.getByRole('button', { name: /Publish Delivery/ }));
    await waitFor(() => expect(mockApi.createTrip).toHaveBeenCalledWith({ deliveryArea: 'Seoul region', deliveryDate: '2026-11-01' }));
    expect(screen.queryByLabelText('Agent ID')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Capacity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Origin')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
  it('validates required area and date', async () => {
    const user = userEvent.setup(); show();
    await user.click(screen.getByRole('button', { name: /Publish Delivery/ }));
    expect(await screen.findByText('Please enter delivery area')).toBeInTheDocument();
    expect(await screen.findByText('Please select delivery date')).toBeInTheDocument();
    expect(mockApi.createTrip).not.toHaveBeenCalled();
  });
  it('edits existing delivery without changing owner or status', async () => {
    const user = userEvent.setup(); mockApi.trips.mockResolvedValue([trip]); show();
    await user.click(await screen.findByRole('button', { name: 'Edit Delivery' }));
    await user.clear(screen.getByLabelText('Delivery Area'));
    await user.type(screen.getByLabelText('Delivery Area'), 'Busan region');
    await user.click(screen.getByRole('button', { name: /Save Changes/ }));
    await waitFor(() => expect(mockApi.updateTrip).toHaveBeenCalledWith(2001, { deliveryArea: 'Busan region', deliveryDate: '2026-11-01' }));
  });
  it('disables editing frozen deliveries', async () => {
    mockApi.trips.mockResolvedValue([{ ...trip, status: 'SETTLED', settlementFrozen: true }]); show();
    expect(await screen.findByRole('button', { name: 'Edit Delivery' })).toBeDisabled();
  });
});
