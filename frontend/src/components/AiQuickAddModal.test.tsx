import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import AiQuickAddModal from './AiQuickAddModal';

const onboardScanMock = vi.fn();

vi.mock('../api', () => ({
  api: {
    onboardScan: (...args: unknown[]) => onboardScanMock(...args),
  },
}));

class MockFileReader {
  result = 'data:image/png;base64,ZmFrZQ==';
  onload: null | ((event: ProgressEvent<FileReader>) => void) = null;

  readAsDataURL() {
    setTimeout(() => {
      this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
    }, 0);
  }
}

const renderModal = (onSuccess = vi.fn()) =>
  render(
    <I18nProvider>
      <AiQuickAddModal visible onCancel={vi.fn()} onSuccess={onSuccess} />
    </I18nProvider>
  );

describe('AiQuickAddModal', () => {
  it('ignores a scan that finishes after closing and reopening', async () => {
    localStorage.setItem('bobbuy_locale','en-US');
    let finish:(value:unknown)=>void=()=>{};
    onboardScanMock.mockReturnValueOnce(new Promise(resolve=>{finish=resolve;}));
    const onSuccess=vi.fn(),onCancel=vi.fn();
    const view=render(<I18nProvider><AiQuickAddModal visible onCancel={onCancel} onSuccess={onSuccess}/></I18nProvider>);
    fireEvent.change(document.querySelector('input[type="file"]')!,{target:{files:[new File(['synthetic'],'synthetic.png',{type:'image/png'})]}});
    await waitFor(()=>expect(onboardScanMock).toHaveBeenCalledTimes(1));
    view.rerender(<I18nProvider><AiQuickAddModal visible={false} onCancel={onCancel} onSuccess={onSuccess}/></I18nProvider>);
    view.rerender(<I18nProvider><AiQuickAddModal visible onCancel={onCancel} onSuccess={onSuccess}/></I18nProvider>);
    finish({name:'Late candidate',attributes:{}});
    await waitFor(()=>expect(screen.queryByDisplayValue('Late candidate')).not.toBeInTheDocument());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('accepts pasted images through the same scan path',async()=>{
    localStorage.setItem('bobbuy_locale','en-US');renderModal();
    const zone=screen.getByLabelText('Paste, drop or choose a product image');
    fireEvent.paste(zone,{clipboardData:{files:[new File(['synthetic'],'paste.png',{type:'image/png'})]}});
    await waitFor(()=>expect(onboardScanMock).toHaveBeenCalledWith('data:image/png;base64,ZmFrZQ==','paste.png'));
  });

  beforeEach(() => {
    localStorage.setItem('bobbuy_locale','zh-CN');
    onboardScanMock.mockResolvedValue({
      name: 'Acme Orange Box 1kg',
      brand: 'Acme',
      price: 10,
      matchScore: 45,
      attributes: {
        netContent: '1kg',
        pricePerUnit: '¥10/100g',
        packSize: '1pack'
      },
      semanticReasoning: '品名与口味不一致，建议另存为新产品。',
      fieldDiffs: [
        { field: 'flavor', label: '口味', oldValue: 'apple', newValue: 'orange', different: true, identityField: true },
      ],
      verificationTarget: {
        productId: 'prd-1000',
        displayName: 'Acme Apple Box 1kg',
        mediaGallery: [{ url: 'https://example.com/history.jpg', type: 'image' }],
      },
    });
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows a strong warning and disables overwrite for low-confidence matches', async () => {
    renderModal();
    const input = document.querySelector('.ant-upload-wrapper input[type="file"], input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['x'], 'product.png', { type: 'image/png' })] } });

    expect(await screen.findByTestId('ai-low-match-warning', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(document.querySelector('.ant-btn-primary[disabled]')).not.toBeNull();
    expect(screen.getByTestId('attribute-diff-table')).toBeInTheDocument();
  });

  it('allows saving as a new product when overwrite is blocked', async () => {
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    const input = document.querySelector('.ant-upload-wrapper input[type="file"], input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['x'], 'product.png', { type: 'image/png' })] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /另存为新产品|Save as New Product/i })).toBeInTheDocument(), {
      timeout: 4000,
    });

    fireEvent.click(screen.getByRole('button', { name: /另存为新产品|Save as New Product/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      existingProductFound: false,
      existingProductId: undefined,
    })));
  });

  it('submits user-edited field values instead of raw AI values on confirm', async () => {
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    const input = document.querySelector('.ant-upload-wrapper input[type="file"], input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['x'], 'product.png', { type: 'image/png' })] } });

    // Wait for the form to appear at step 4
    const nameInput = await screen.findByPlaceholderText(/例如：富士苹果|product name/i, {}, { timeout: 4000 });
    // Override the AI-suggested name with a user-edited value
    fireEvent.change(nameInput, { target: { value: 'User Edited Name' } });

    // The OK/publish button is disabled (low confidence), so use "Save as New"
    fireEvent.click(screen.getByRole('button', { name: /另存为新产品|Save as New Product/i }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'User Edited Name' })
      )
    );
  });

  it('submits user-edited structured fields in attributes payload', async () => {
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    const input = document.querySelector('.ant-upload-wrapper input[type="file"], input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['x'], 'product.png', { type: 'image/png' })] } });

    const netContentInput = await screen.findByPlaceholderText(/705g/i, {}, { timeout: 4000 });
    fireEvent.change(netContentInput, { target: { value: '900g' } });
    fireEvent.click(screen.getByRole('button', { name: /另存为新产品|Save as New Product/i }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            netContent: '900g',
            pricePerUnit: '¥10/100g',
            packSize: '1pack'
          })
        })
      )
    );
  });

  it('falls back to manual entry when scan fails', async () => {
    onboardScanMock.mockRejectedValueOnce(new Error('error.ai.ocr_failed'));
    const onSuccess = vi.fn();
    renderModal(onSuccess);
    const input = document.querySelector('.ant-upload-wrapper input[type="file"], input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { files: [new File(['x'], 'broken.png', { type: 'image/png' })] } });

    expect(await screen.findByTestId('ai-manual-entry-alert', {}, { timeout: 4000 })).toBeInTheDocument();
    fireEvent.change(await screen.findByPlaceholderText(/例如：富士苹果|product name/i), { target: { value: 'Manual Product' } });
    fireEvent.click(screen.getByRole('button', { name: /另存为新产品|Save as New Product/i }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Manual Product',
          visibilityStatus: 'DRAFTER_ONLY',
          existingProductFound: false,
          trace: expect.objectContaining({
            recognitionStatus: 'FAILED_RECOGNITION',
            manualReviewRequired: true
          })
        })
      )
    );
  });
});
