import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {api,type CustomerAmendmentInput} from './api';
import {storeAuthSession} from './authStorage';
beforeEach(()=>{localStorage.clear();vi.restoreAllMocks();document.cookie='bobbuy_csrf_token=synthetic-csrf; path=/';storeAuthSession({accessToken:'synthetic-access',user:{id:2,username:'synthetic',name:'Synthetic',roles:['CUSTOMER']}});});
afterEach(()=>{vi.unstubAllGlobals();});
it('uses the authenticated customer route for the exact revision/quote/address input',async()=>{
 const data={orderId:9,revision:'a'.repeat(64),editable:true};const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'success',data}),{status:200}));vi.stubGlobal('fetch',fetch);
 const input:CustomerAmendmentInput={requestId:'00000000-0000-0000-0000-000000000001',expectedRevision:'a'.repeat(64),lines:[{productId:'98e8de5e-2122-451b-89c8-693439d90b60',quantity:3,priceToken:'quote',priceRevision:1,currency:'JPY'}]};
 expect(await api.amendOwnOrder(9,input)).toEqual(data);expect(String(fetch.mock.calls[0][0])).toContain('/api/customer/orders/9/amendment');
 const init=fetch.mock.calls[0][1];expect(init.method).toBe('PATCH');expect(JSON.parse(init.body)).toEqual(input);expect(new Headers(init.headers).get('Authorization')).toBe('Bearer synthetic-access');expect(JSON.parse(init.body)).not.toHaveProperty('customerId');
});
it('preserves a 409 conflict without mock fallback, retry or success',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'error',errorCode:'INVALID_REQUEST',message:'Changed'}),{status:409}));vi.stubGlobal('fetch',fetch);
 await expect(api.amendOwnOrder(9,{requestId:'00000000-0000-0000-0000-000000000001',expectedRevision:'a'.repeat(64),lines:[{productId:'legacy:SKU',quantity:1}]})).rejects.toMatchObject({status:409});expect(fetch).toHaveBeenCalledTimes(1);
});
it('sends server orderRevision as the explicit merchant replacement expectation',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'success',data:{}}),{status:200}));vi.stubGlobal('fetch',fetch);
 await api.updateOrder({id:9,businessId:'SYNTHETIC',customerId:2,tripId:7,status:'NEW',paymentStatus:'UNPAID',totalAmount:10,lines:[],orderRevision:4});
 expect(String(fetch.mock.calls[0][0])).toContain('/api/orders/9');expect(JSON.parse(fetch.mock.calls[0][1].body).expectedOrderRevision).toBe(4);
});
