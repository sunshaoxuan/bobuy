import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {I18nProvider,translate,type Locale} from '../i18n';
import ClientOrders from './ClientOrders';
import type {CustomerAmendmentView,Order} from '../api';
const mocks=vi.hoisted(()=>({trips:vi.fn(),orders:vi.fn(),view:vi.fn(),save:vi.fn(),user:{id:2},token:'session-a'}));
vi.mock('../api',()=>({api:{customerTrips:mocks.trips,customerOrders:mocks.orders,customerAmendment:mocks.view,amendOwnOrder:mocks.save}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({user:mocks.user})}));
vi.mock('../authStorage',()=>({getStoredAccessToken:()=>mocks.token}));
const productId='98e8de5e-2122-451b-89c8-693439d90b60';
const view:CustomerAmendmentView={orderId:9,revision:'a'.repeat(64),reason:'EDITABLE',editable:true,lines:[{productId,quantity:2,priceToken:'quote',priceRevision:1,currency:'JPY'}],delivery:{contactName:'A',countryRegion:'JP',city:'Tokyo',addressLine:'Street'},merchantId:3,tripId:7,currency:'JPY',totalAmount:20,products:[{id:productId,name:{'en-US':'Tea','zh-CN':'茶','zh-TW':'茶','ja-JP':'お茶'},amount:10,currency:'JPY',unit:'pack',priceRevision:1,priceToken:'quote'}]};
const row:Order={id:9,businessId:'SYNTHETIC',customerId:2,tripId:7,status:'NEW',paymentStatus:'UNPAID',totalAmount:20,currency:'JPY',lines:[]};
beforeEach(()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.clearAllMocks();mocks.user={id:2};mocks.token='session-a';mocks.trips.mockResolvedValue([{id:7,agentId:3,deliveryArea:'Synthetic',deliveryDate:'2026-11-12'}]);mocks.orders.mockResolvedValue([row]);mocks.view.mockResolvedValue(view);mocks.save.mockResolvedValue(view);});
function page(){return <I18nProvider><ClientOrders/></I18nProvider>;}
describe('wired own-order journey',()=>{
  it.each<Locale>(['en-US','zh-CN','zh-TW','ja-JP'])('opens and saves through customer API, then reads fresh state before success (%s)',async locale=>{
    localStorage.setItem('bobbuy_locale',locale);render(page());fireEvent.click(await screen.findByText(translate(locale,'amendment.edit')));
    const input=await screen.findByLabelText(translate(locale,'amendment.quantity')+' '+productId);fireEvent.change(input,{target:{value:'3'}});
    const fresh={...view,revision:'b'.repeat(64),lines:[{...view.lines[0],quantity:3}],totalAmount:30};mocks.save.mockResolvedValue(fresh);mocks.view.mockResolvedValue(fresh);mocks.orders.mockResolvedValue([{...row,totalAmount:30}]);
    fireEvent.click(screen.getByText(translate(locale,'amendment.save')));await screen.findByText(translate(locale,'amendment.saved'));
    expect(mocks.save).toHaveBeenCalledTimes(1);expect(mocks.save.mock.calls[0][0]).toBe(9);expect(mocks.save.mock.calls[0][1].lines[0]).toMatchObject({productId,quantity:3,priceToken:'quote',priceRevision:1,currency:'JPY'});
    expect(mocks.view).toHaveBeenCalledTimes(2);expect(mocks.orders).toHaveBeenCalledTimes(2);expect(screen.queryByText('nav.orders')).toBeNull();
  });
  it('does not announce saved when post-commit read fails, and retries the same intent key',async()=>{
    render(page());fireEvent.click(await screen.findByText('Edit order'));await screen.findByLabelText('Quantity '+productId);
    mocks.view.mockRejectedValueOnce(new Error('read failed'));fireEvent.click(screen.getByText('Save changes'));await screen.findByText(translate('en-US','amendment.failed'));expect(screen.queryByText('Changes saved')).toBeNull();
    mocks.view.mockResolvedValue({...view,revision:'b'.repeat(64)});fireEvent.click(screen.getByText('Save changes'));await screen.findByText('Changes saved');
    expect(mocks.save).toHaveBeenCalledTimes(2);expect(mocks.save.mock.calls[0][1]).toEqual(mocks.save.mock.calls[1][1]);
  });
  it('uses the fresh paid/locked view instead of an editable historical replay response',async()=>{
    render(page());fireEvent.click(await screen.findByText('Edit order'));await screen.findByLabelText('Quantity '+productId);
    mocks.save.mockResolvedValue(view);mocks.view.mockResolvedValue({...view,revision:'b'.repeat(64),editable:false,reason:'PAYMENT_LOCKED'});
    mocks.orders.mockResolvedValue([{...row,status:'CONFIRMED',paymentStatus:'PAID'}]);fireEvent.click(screen.getByText('Save changes'));await screen.findByText('Changes saved');
    expect((screen.getByText('Save changes') as HTMLButtonElement).disabled).toBe(true);expect(screen.queryByText('Edit order')).toBeNull();
    expect(screen.getAllByText(translate('en-US','amendment.locked')).length).toBeGreaterThan(0);expect(mocks.view).toHaveBeenCalledTimes(2);
  });
  it('ignores an old account open response and resets editing on identity/token rotation',async()=>{
    let resolve!:(v:CustomerAmendmentView)=>void;mocks.view.mockImplementationOnce(()=>new Promise<CustomerAmendmentView>(r=>{resolve=r;}));
    const {rerender}=render(page());fireEvent.click(await screen.findByText('Edit order'));mocks.user={id:4};mocks.token='session-b';mocks.orders.mockResolvedValue([]);rerender(page());resolve(view);
    await waitFor(()=>expect(mocks.trips).toHaveBeenCalledTimes(2));expect(screen.queryByLabelText('Quantity '+productId)).toBeNull();
  });
  it('keeps the order list usable when opening the edit view fails',async()=>{
    mocks.view.mockRejectedValueOnce(new Error('temporary read error'));render(page());fireEvent.click(await screen.findByText('Edit order'));await screen.findByText('temporary read error');
    expect(screen.getByText('#9')).toBeTruthy();mocks.view.mockResolvedValue(view);fireEvent.click(screen.getByText('Edit order'));await screen.findByLabelText('Quantity '+productId);
  });
});
