import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import{api}from'./api';
import{translate,type Locale}from'./i18n';
beforeEach(()=>{localStorage.clear();});afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();});
describe('owned Costco queue API',()=>{
 it('sends one stable intent and whitelisted number fields to the durable endpoint',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:'success',data:{id:'synthetic',state:'QUEUED',revision:0}})});vi.stubGlobal('fetch',fetch);
  const input={requestId:'00000000-0000-0000-0000-000000000001',supplierId:'supplier-jp',market:'JP',itemNumber:'0014110'};
  await api.costcoOnboarding.number(input);await api.costcoOnboarding.number(input);
  expect(fetch.mock.calls[0][0]).toBe('/api/ai/costco-onboarding');expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
  expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body);expect(Object.keys(JSON.parse(fetch.mock.calls[0][1].body))).not.toContain('merchantId');
 });
 it('passes the original photo file and scope through multipart without manufacturing a price or owner',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({status:'success',data:{id:'synthetic-photo',state:'QUEUED',revision:0}})});vi.stubGlobal('fetch',fetch);
  const photo=new File(['synthetic-original'],'photo.png',{type:'image/png'});await api.costcoOnboarding.photo({requestId:'00000000-0000-0000-0000-000000000001',supplierId:'supplier-jp',market:'JP'},photo);
  const [url,request]=fetch.mock.calls[0];expect(url).toBe('/api/ai/costco-onboarding/photo');const body=request.body as FormData;
  expect(Array.from(body.keys()).sort()).toEqual(['file','market','requestId','supplierId']);expect((body.get('file') as File).name).toBe('photo.png');expect(request.headers.get('Content-Type')).toBeNull();
 });
 it.each(['zh-CN','zh-TW','ja-JP','en-US'] as Locale[])('shows the recoverable queue quota in %s',async locale=>{
  localStorage.setItem('bobbuy_locale',locale);vi.spyOn(console,'error').mockImplementation(()=>{});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:429,statusText:'Too Many Requests',json:async()=>({errorCode:'RATE_LIMITED',message:'onboarding.pending_quota'})}));
  await expect(api.costcoOnboarding.number({requestId:'00000000-0000-0000-0000-000000000001',supplierId:'supplier-jp',market:'JP',itemNumber:'14110'})).rejects.toThrow(translate(locale,'onboarding.pending_quota'));
 });
});
