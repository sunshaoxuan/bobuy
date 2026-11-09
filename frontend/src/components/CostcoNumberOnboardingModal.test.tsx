import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CostcoNumberOnboardingModal, { CostcoNumberLabels, CostcoOnboardingJobView } from './CostcoNumberOnboardingModal';
afterEach(cleanup);
const labels: CostcoNumberLabels = { title: 'Number intake', itemNumber: 'Item', submit: 'Start', close: 'Close', invalid: 'One item required', failed: 'Retry this attempt', queued: 'Task accepted', pending: 'Accepting task',newTask:'Next item' };
const job: CostcoOnboardingJobView = { id: 'synthetic-job', state: 'QUEUED', revision: 0 };
const base = { open: true, subject: 'merchant:1', supplierId: '3', market: 'JP', labels, onQueued: vi.fn(), onClose: vi.fn() };
describe('standalone number onboarding input', () => {
  it('normalizes full-width digits, preserves leading zeros and sends only the whitelist', async () => {
    const enqueue = vi.fn().mockResolvedValue(job); const onQueued = vi.fn();
    render(<CostcoNumberOnboardingModal {...base} enqueue={enqueue} onQueued={onQueued} />);
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: ' ００１４１１０ ' } });
    fireEvent.click(screen.getByText('Start')); await screen.findByText('Task accepted');
    expect(enqueue).toHaveBeenCalledTimes(1);
    const input = enqueue.mock.calls[0][0];
    expect(input.itemNumber).toBe('0014110'); expect(input.supplierId).toBe('3'); expect(input.market).toBe('JP');
    expect(Object.keys(input).sort()).toEqual(['itemNumber', 'market', 'requestId', 'supplierId']);
    expect(onQueued).toHaveBeenCalledWith(job);
    expect(screen.getByLabelText('job').textContent).toContain('QUEUED');
  });
  it('rejects multiple numbers and scientific notation before enqueue', () => {
    const enqueue = vi.fn(); render(<CostcoNumberOnboardingModal {...base} enqueue={enqueue} />);
    for (const value of ['14110,77839', '1e5', '14110 / 77839', '']) {
      fireEvent.change(screen.getByLabelText('Item'), { target: { value } }); fireEvent.click(screen.getByText('Start'));
      expect(screen.getByText('One item required')).toBeTruthy();
    }
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('reuses the request key after uncertain failure and across close/reopen', async () => {
    const enqueue = vi.fn().mockRejectedValueOnce(Error('network')).mockResolvedValueOnce(job);
    const { rerender } = render(<CostcoNumberOnboardingModal {...base} enqueue={enqueue} />);
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: '14110' } }); fireEvent.click(screen.getByText('Start'));
    await screen.findByText('Retry this attempt');
    rerender(<CostcoNumberOnboardingModal {...base} open={false} enqueue={enqueue} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<CostcoNumberOnboardingModal {...base} enqueue={enqueue} />);
    fireEvent.click(screen.getByText('Start')); await screen.findByText('Task accepted');
    expect(enqueue.mock.calls[0][0]).toEqual(enqueue.mock.calls[1][0]);
  });
  it('blocks double click and discards late results on merchant/supplier changes', async () => {
    let resolve!: (value: CostcoOnboardingJobView) => void;
    const enqueue = vi.fn(() => new Promise<CostcoOnboardingJobView>(r => { resolve = r; })); const onQueued = vi.fn();
    const { rerender } = render(<CostcoNumberOnboardingModal {...base} enqueue={enqueue} onQueued={onQueued} />);
    fireEvent.change(screen.getByLabelText('Item'), { target: { value: '14110' } });
    fireEvent.click(screen.getByText('Start')); fireEvent.click(screen.getByText('Start')); expect(enqueue).toHaveBeenCalledTimes(1);
    rerender(<CostcoNumberOnboardingModal {...base} subject="merchant:2" supplierId="4" enqueue={enqueue} onQueued={onQueued} />);
    resolve(job); await waitFor(() => expect((screen.getByLabelText('Item') as HTMLInputElement).value).toBe(''));
    expect(onQueued).not.toHaveBeenCalled(); expect(screen.queryByText('Task accepted')).toBeNull();
  });
  it('starts another explicit intent after the first task is safely queued',async()=>{
    const enqueue=vi.fn().mockResolvedValue(job);render(<CostcoNumberOnboardingModal {...base} enqueue={enqueue}/>);
    fireEvent.change(screen.getByLabelText('Item'),{target:{value:'14110'}});fireEvent.click(screen.getByText('Start'));await screen.findByText('Task accepted');
    fireEvent.click(screen.getByText('Next item'));expect((screen.getByLabelText('Item') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('Item'),{target:{value:'77839'}});fireEvent.click(screen.getByText('Start'));await screen.findByText('Task accepted');
    expect(enqueue).toHaveBeenCalledTimes(2);expect(enqueue.mock.calls[0][0].requestId).not.toBe(enqueue.mock.calls[1][0].requestId);
  });
});
