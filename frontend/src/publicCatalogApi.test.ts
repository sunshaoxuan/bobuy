import {storefrontApi} from './api';
import {clearAuthSession} from './authStorage';
beforeEach(()=>{localStorage.clear();clearAuthSession();vi.restoreAllMocks();});
it('unwraps success/data and sends explicit page and optional merchant',async()=>{
 const data={items:[],page:1,size:24,total:0,hasNext:false};
 const fetchMock=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:'success',data})});vi.stubGlobal('fetch',fetchMock);
 expect(await storefrontApi.productCatalog(1,8)).toEqual(data);
 expect(String(fetchMock.mock.calls[0][0])).toContain('/api/storefront/product-catalog?page=1&merchantId=8');
 await storefrontApi.productCatalog();expect(String(fetchMock.mock.calls[1][0])).toContain('/api/storefront/product-catalog?page=0');
 expect(String(fetchMock.mock.calls[1][0])).not.toContain('merchantId');
});
