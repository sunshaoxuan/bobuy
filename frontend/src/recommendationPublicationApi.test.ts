import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {recommendationApi} from './api';
import {storeAuthSession} from './authStorage';
const input={requestId:'11111111-2222-4333-8444-555555555555',version:12,productVersion:7,sourceHash:'a'.repeat(64),reviewed:true as const};
beforeEach(()=>{localStorage.clear();storeAuthSession({accessToken:'synthetic-agent-token',user:{id:100,username:'agent',name:'Agent',roles:['AGENT']}});});
afterEach(()=>{vi.unstubAllGlobals();});
it('posts only the explicit item publication contract to the merchant item endpoint',async()=>{
 const value={post:{id:9},items:[]};const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:'success',data:value})});vi.stubGlobal('fetch',fetch);
 await expect(recommendationApi.publishItem(9,908,input)).resolves.toEqual(value);
 const [url,request]=fetch.mock.calls[0];expect(url).toBe('/api/merchant/recommendations/9/items/908/publish');expect(request.method).toBe('POST');expect(JSON.parse(request.body)).toEqual(input);
 expect(Object.keys(JSON.parse(request.body)).sort()).toEqual(['productVersion','requestId','reviewed','sourceHash','version']);expect(new Headers(request.headers).get('Authorization')).toBe('Bearer synthetic-agent-token');
});
it('retains HTTP conflict status for draft recovery instead of returning a fallback detail',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:409,json:async()=>({message:'Version changed'})});vi.stubGlobal('fetch',fetch);
 await expect(recommendationApi.publishItem(8,801,input)).rejects.toMatchObject({message:'Version changed',status:409});expect(fetch).toHaveBeenCalledTimes(1);
});

it('preserves structured publication conditions on a 400 response',async()=>{
 const conditions=[{code:'CATALOG_REVIEW_REQUIRED',message:'The product master is awaiting review.',target:'PRODUCT_MASTER'}];
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'error',errorCode:'INVALID_REQUEST',message:'Complete each listed item before publishing.',conditions}),{status:400,headers:{'Content-Type':'application/json'}})));
 await expect(recommendationApi.publishItem(8,801,{requestId:crypto.randomUUID(),version:4,productVersion:2,sourceHash:'a'.repeat(64),reviewed:true})).rejects.toMatchObject({status:400,conditions});
});
it('preserves append conflict status and the existing from-product body',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:409,json:async()=>({message:'Product changed'})});vi.stubGlobal('fetch',fetch);
 const body={productId:'synthetic',productVersion:3,facts:{name:'Synthetic',itemNumber:'123'},version:12,reviewed:true};
 await expect(recommendationApi.fromProduct(9,body)).rejects.toMatchObject({status:409});expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(body);
});
