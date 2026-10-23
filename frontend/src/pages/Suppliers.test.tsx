import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import Suppliers from './Suppliers';
import { api } from '../api';

vi.mock('../api', () => ({
  api: {
    suppliers: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn()
  }
}));

const mockApi = api as unknown as {
  suppliers: ReturnType<typeof vi.fn>;
  createSupplier: ReturnType<typeof vi.fn>;
  updateSupplier: ReturnType<typeof vi.fn>;
};

const supplierWithRules = {
  id: 'costco',
  name: { 'zh-CN': 'Costco', 'en-US': 'Costco Wholesale' },
  description: { 'zh-CN': 'Costco description' },
  contactInfo: 'contact@costco.com',
  onboardingRules: { itemNumberPattern: '5-6 digits only', preferredLanguage: 'ja' }
};

const supplierWithoutRules = {
  id: 'donki',
  name: { 'zh-CN': '唐吉诃德', 'en-US': 'Don Quijote' },
  description: {},
  onboardingRules: {}
};

const renderSuppliers = () =>
  render(
    <I18nProvider>
      <Suppliers />
    </I18nProvider>
  );

describe('Suppliers page', () => {
  beforeEach(() => {
    window.localStorage.setItem('bobbuy_locale', 'en-US');
    mockApi.suppliers.mockReset();
    mockApi.createSupplier.mockReset();
    mockApi.updateSupplier.mockReset();
    mockApi.suppliers.mockResolvedValue([supplierWithRules, supplierWithoutRules]);
  });

  it('renders supplier list and shows rules count badge', async () => {
    renderSuppliers();
    await waitFor(() => expect(mockApi.suppliers).toHaveBeenCalled());

    expect(await screen.findByText('Costco Wholesale')).toBeInTheDocument();
    expect(await screen.findByText('Don Quijote')).toBeInTheDocument();
    expect(screen.getByText('2 rules defined')).toBeInTheDocument();
  });

  it('shows dash for supplier with no onboarding rules', async () => {
    renderSuppliers();
    await waitFor(() => expect(mockApi.suppliers).toHaveBeenCalled());

    await screen.findByText('Costco Wholesale');
    const dashes = screen.getAllByText('-');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('does not crash when onboarding rules are missing (null/empty)', async () => {
    mockApi.suppliers.mockResolvedValueOnce([
      { id: 'test', name: { 'zh-CN': 'Test Supplier' }, onboardingRules: null },
      { id: 'test2', name: { 'zh-CN': 'Test2 Supplier' } }
    ]);
    renderSuppliers();

    expect(await screen.findByText('Test Supplier')).toBeInTheDocument();
    expect(await screen.findByText('Test2 Supplier')).toBeInTheDocument();
  });

  it('opens edit modal with existing onboarding rules pre-filled', async () => {
    renderSuppliers();
    await waitFor(() => expect(mockApi.suppliers).toHaveBeenCalled());

    await screen.findByText('Costco Wholesale');
    const editButtons = screen.getAllByRole('button', { name: /编辑|edit/i });
    fireEvent.click(editButtons[0]);

    const textarea = await screen.findByPlaceholderText(/itemNumberRule/i);
    expect(textarea).toHaveValue(JSON.stringify(supplierWithRules.onboardingRules, null, 2));
  });

  it('submits structured onboarding rules when saving', async () => {
    mockApi.updateSupplier.mockResolvedValue({ ...supplierWithRules });
    mockApi.suppliers.mockResolvedValue([supplierWithRules]);

    renderSuppliers();
    await waitFor(() => expect(mockApi.suppliers).toHaveBeenCalled());

    await screen.findByText('Costco Wholesale');
    const editButtons = screen.getAllByRole('button', { name: /编辑|edit/i });
    fireEvent.click(editButtons[0]);

    const rulesTextarea = await screen.findByPlaceholderText(/itemNumberRule/i);
    fireEvent.change(rulesTextarea, { target: { value: '{"newRule":"value"}' } });

    const okButton = screen.getByRole('button', { name: /ok/i });
    fireEvent.click(okButton);

    await waitFor(() =>
      expect(mockApi.updateSupplier).toHaveBeenCalledWith(
        'costco',
        expect.objectContaining({
          onboardingRules: { newRule: 'value' }
        })
      )
    );
  });

  it('creates a new supplier with onboarding rules', async () => {
    const user = userEvent.setup();
    mockApi.createSupplier.mockResolvedValue({
      id: 'newsupp',
      name: { 'zh-CN': '新供应商', 'en-US': 'New Supplier' },
      onboardingRules: { rule: 'value' }
    });
    mockApi.suppliers.mockResolvedValue([]);

    renderSuppliers();
    await waitFor(() => expect(mockApi.suppliers).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /add supplier/i }));

    await user.type(screen.getByPlaceholderText('e.g. costco'), 'newsupp');
    await user.type(screen.getByPlaceholderText('e.g. Costco'), '新供应商');
    const rulesTextarea = screen.getByPlaceholderText(/itemNumberRule/i);
    fireEvent.change(rulesTextarea, { target: { value: '{"rule":"value"}' } });

    fireEvent.click(screen.getByRole('button', { name: /ok/i }));

    await waitFor(() =>
      expect(mockApi.createSupplier).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'newsupp',
          onboardingRules: { rule: 'value' }
        })
      )
    );
  });
});
