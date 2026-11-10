import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CustomerOrderAmendment, { AmendmentLabels, AmendmentOrder } from './CustomerOrderAmendment';
afterEach(cleanup);
const labels: AmendmentLabels = { title: 'Edit order', quantity: 'Quantity', save: 'Save', reload: 'Reload', conflict: 'Changed: your draft is kept', failed: 'Retry', locked: 'Contact merchant', saved: 'Saved' };
const productId = '98e8de5e-2122-451b-89c8-693439d90b60';
const quantityLabel = `Quantity ${productId}`;
const order: AmendmentOrder = { id: 4, revision: 'a'.repeat(64), editable: true, lines: [{ productId, quantity: 2 }] };
describe('independent customer amendment form', () => {
  it('retains the draft across conflict and only replaces it on explicit reload', async () => {
    const save = vi.fn().mockRejectedValue({ status: 409 });
    const { rerender } = render(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} />);
    fireEvent.change(screen.getByLabelText(quantityLabel), { target: { value: '5' } });
    fireEvent.click(screen.getByText('Save')); await screen.findByText(labels.conflict);
    expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('5');
    rerender(<CustomerOrderAmendment subject="customer:2" order={{ ...order, revision: 'b'.repeat(64), lines: [{ productId, quantity: 3 }] }} labels={labels} save={save} />);
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Reload'));
    expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('3');
  });
  it('uses one request key on uncertain retry and whitelists the submitted payload', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ...order, revision: 'b'.repeat(64) });
    render(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} />);
    fireEvent.click(screen.getByText('Save')); await screen.findByText('Retry');
    fireEvent.click(screen.getByText('Save')); await screen.findByText('Saved');
    expect(save.mock.calls[0][1]).toEqual(save.mock.calls[1][1]);
    expect(save.mock.calls[0][1].lines[0].productId).toBe(productId);
    expect(Object.keys(save.mock.calls[0][1]).sort()).toEqual(['expectedRevision', 'lines', 'requestId']);
  });
  it('never transfers a pending result or draft across accounts', async () => {
    let resolve!: (value: AmendmentOrder) => void;
    const save = vi.fn(() => new Promise<AmendmentOrder>(r => { resolve = r; }));
    const { rerender } = render(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} />);
    fireEvent.change(screen.getByLabelText(quantityLabel), { target: { value: '9' } }); fireEvent.click(screen.getByText('Save'));
    rerender(<CustomerOrderAmendment subject="customer:3" order={{ ...order, lines: [{ productId, quantity: 1 }] }} labels={labels} save={save} />);
    resolve({ ...order, lines: [{ productId, quantity: 9 }] });
    await waitFor(() => expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('1'));
    expect(screen.queryByText('Saved')).toBeNull();
  });
  it('blocks writes for a locked order and rejects invalid quantities', () => {
    const save = vi.fn();
    const { rerender } = render(<CustomerOrderAmendment subject="customer:2" order={{ ...order, editable: false }} labels={labels} save={save} />);
    expect(screen.getByText('Contact merchant')).toBeTruthy(); fireEvent.click(screen.getByText('Save')); expect(save).not.toHaveBeenCalled();
    rerender(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} />);
    fireEvent.change(screen.getByLabelText(quantityLabel), { target: { value: '0' } });
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });
  it('accepts successive saved revisions while parent props still contain the known old snapshot', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ...order, revision: 'b'.repeat(64) })
      .mockResolvedValueOnce({ ...order, revision: 'c'.repeat(64) });
    render(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} />);
    fireEvent.click(screen.getByText('Save')); await screen.findByText('Saved');
    expect(screen.queryByText(labels.conflict)).toBeNull();
    fireEvent.click(screen.getByText('Save')); await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await screen.findByText('Saved');
    expect(save.mock.calls[1][1].expectedRevision).toBe('b'.repeat(64));
    expect(screen.queryByText(labels.conflict)).toBeNull();
  });
  it('keeps a conflicting draft when a newer refresh arrives during save', async () => {
    let resolve!: (value: AmendmentOrder) => void;
    const save = vi.fn(() => new Promise<AmendmentOrder>(r => { resolve = r; }));
    const { rerender } = render(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} />);
    fireEvent.change(screen.getByLabelText(quantityLabel), { target: { value: '9' } }); fireEvent.click(screen.getByText('Save'));
    rerender(<CustomerOrderAmendment subject="customer:2" order={{ ...order, revision: 'c'.repeat(64), lines: [{ productId, quantity: 3 }] }} labels={labels} save={save} />);
    resolve({ ...order, revision: 'b'.repeat(64), lines: [{ productId, quantity: 9 }] });
    await screen.findByText(labels.conflict);
    expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('9');
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Reload'));
    expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('3');
  });
  it('drops pending callbacks when the same account rotates its session', async () => {
    let resolve!: (value: AmendmentOrder) => void;
    const save = vi.fn(() => new Promise<AmendmentOrder>(r => { resolve = r; }));
    const { rerender } = render(<CustomerOrderAmendment subject="customer:2" sessionKey="old" order={order} labels={labels} save={save} />);
    fireEvent.change(screen.getByLabelText(quantityLabel), { target: { value: '7' } }); fireEvent.click(screen.getByText('Save'));
    rerender(<CustomerOrderAmendment subject="customer:2" sessionKey="new" order={order} labels={labels} save={save} />);
    resolve({ ...order, revision: 'b'.repeat(64), lines: [{ productId, quantity: 7 }] });
    await waitFor(() => expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('2'));
    expect(screen.queryByText('Saved')).toBeNull();
  });
  it('adds/removes eligible String products and sends only a complete explicit order address plus server quotes', async () => {
    const second='legacy:second';const products=[{id:productId,name:{'en-US':'Tea'},amount:10,currency:'JPY',unit:'pack',priceRevision:1,priceToken:'q1',brand:'Brand',itemNumber:'ITEM-1',model:'Model',packaging:'2 packs',specifications:{'en-US':'80 × 2'}},{id:second,name:{'en-US':'Rice'},amount:20,currency:'JPY',unit:'bag',priceRevision:2,priceToken:'q2'}];
    const rich={...order,products,currency:'JPY',lines:[{...order.lines[0],priceToken:'q1',priceRevision:1,currency:'JPY'}]};
    const save=vi.fn().mockResolvedValue({...rich,revision:'b'.repeat(64)});
    const extra={...labels,remove:'Remove',add:'Add',select:'Pick',changeAddress:'Change address',contactName:'Name',phone:'Phone',countryRegion:'Country',city:'City',addressLine:'Street',postalCode:'Postcode',total:'Total'};
    render(<CustomerOrderAmendment subject="customer:2" order={rich} labels={extra} save={save}/>);
    expect(screen.getByText(/80 × 2/)).toBeTruthy();expect(screen.getByText(/ITEM-1/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Pick'),{target:{value:second}});fireEvent.click(screen.getByText('Add'));expect(screen.getByLabelText('Quantity '+second)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Remove')[0]);fireEvent.click(screen.getByLabelText('Change address'));
    fireEvent.change(screen.getByLabelText('Name'),{target:{value:'B'}});fireEvent.change(screen.getByLabelText('Country'),{target:{value:'JP'}});fireEvent.change(screen.getByLabelText('City'),{target:{value:'Osaka'}});fireEvent.change(screen.getByLabelText('Street'),{target:{value:'New street'}});
    fireEvent.click(screen.getByText('Save'));await screen.findByText('Saved');
    expect(save.mock.calls[0][1].lines).toEqual([{productId:second,quantity:1,priceToken:'q2',priceRevision:2,currency:'JPY'}]);
    expect(save.mock.calls[0][1].delivery).toMatchObject({contactName:'B',countryRegion:'JP',city:'Osaka',addressLine:'New street'});
    expect(save.mock.calls[0][1]).not.toHaveProperty('customerId');
  });
  it('retains draft on failed fresh reload then adopts the deliberately reloaded quote', async()=>{
    const reload=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({...order,revision:'b'.repeat(64),lines:[{productId,quantity:4,priceToken:'new',priceRevision:2,currency:'JPY'}]});
    const save=vi.fn().mockRejectedValue({status:409});render(<CustomerOrderAmendment subject="customer:2" order={order} labels={labels} save={save} reload={reload}/>);
    fireEvent.change(screen.getByLabelText(quantityLabel),{target:{value:'8'}});fireEvent.click(screen.getByText('Save'));await screen.findByText(labels.conflict);
    fireEvent.click(screen.getByText('Reload'));await screen.findByText(labels.failed);expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('8');
    fireEvent.click(screen.getByText('Reload'));await waitFor(()=>expect((screen.getByLabelText(quantityLabel) as HTMLInputElement).value).toBe('4'));
    fireEvent.click(screen.getByText('Save'));await waitFor(()=>expect(save).toHaveBeenCalledTimes(2));expect(save.mock.calls[1][1].lines[0].priceToken).toBe('new');
  });
  it('retains the original product identity for an unavailable line and requires deliberate replacement',async()=>{
    const save=vi.fn();render(<CustomerOrderAmendment subject="customer:2" order={{...order,products:[],originalProducts:[{id:productId,name:{'en-US':'Original item'},itemNumber:'ITEM-OLD',packaging:'80 × 2',unit:'pack'}]}} labels={{...labels,remove:'Remove',unavailable:'Unavailable'}} save={save}/>);
    expect(screen.getByText(/Original item · ITEM-OLD · 80 × 2/)).toBeTruthy();expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Remove'));expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);expect(save).not.toHaveBeenCalled();
  });
});
