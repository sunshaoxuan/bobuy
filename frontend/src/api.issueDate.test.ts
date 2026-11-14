import {recommendationApi} from './api';
import {getStoredAccessToken,storeAuthSession} from './authStorage';
const user={id:42,username:'synthetic-owner',name:'Synthetic owner',roles:['AGENT'] as const};
const session=(token:string)=>storeAuthSession({accessToken:token,user:{...user,roles:[...user.roles]}});
const review={issueDate:null,sourceRef:null,sourceHash:null,reviewedBy:null,reviewedAt:null,source:'UNKNOWN',version:3};
const response=(status=200,value:unknown={status:'success',data:review})=>({ok:status>=200&&status<300,status,json:async()=>value}) as Response;
let fetchMock=vi.fn();
beforeEach(()=>{localStorage.clear();session('synthetic-token-a');fetchMock=vi.fn().mockResolvedValue(response());vi.stubGlobal('fetch',fetchMock);});
afterEach(()=>{vi.unstubAllGlobals();});
it('GET uses the exact captured token with no-store and the real private endpoint',async()=>{
 await expect(recommendationApi.getIssueDate(8,'synthetic-token-a')).resolves.toEqual(review);
 expect(fetchMock).toHaveBeenCalledTimes(1);const[path,init]=fetchMock.mock.calls[0];expect(path).toBe('/api/merchant/recommendations/8/issue-date');expect(init).toMatchObject({method:'GET',cache:'no-store',credentials:'same-origin',headers:{Authorization:'Bearer synthetic-token-a'}});expect(init.body).toBeUndefined();
});
it('encodes draft references and sends raw source files with a captured token and browser multipart boundary',async()=>{
 const ref='https://example.invalid/source?a=1&b=2',file=new File(['raw\r\nメール'],'source.eml',{type:'message/rfc822'});
 await recommendationApi.getIssueDateSource(11,ref,'synthetic-token-a');expect(fetchMock.mock.calls[0][0]).toBe('/api/merchant/recommendations/11/issue-date/source?'+new URLSearchParams({sourceRef:ref}));
 await recommendationApi.uploadIssueDateSource(12,ref,file,'synthetic-token-a');const [path,init]=fetchMock.mock.calls[1];expect(path).toBe('/api/merchant/recommendations/12/issue-date/source');expect(init.method).toBe('POST');expect(init.headers.Authorization).toBe('Bearer synthetic-token-a');expect(init.headers).not.toHaveProperty('Content-Type');expect(init.body.get('file')).toBe(file);expect(init.body.get('sourceRef')).toBe(ref);
});
it('discards an upload receipt when its captured session is replaced',async()=>{
 let finish!:(r:Response)=>void;fetchMock.mockReturnValue(new Promise<Response>(resolve=>{finish=resolve;}));const request=recommendationApi.uploadIssueDateSource(12,'message:source',new File(['x'],'source.eml'),'synthetic-token-a');session('synthetic-token-b');finish(response());await expect(request).rejects.toMatchObject({status:409,errorCode:'SESSION_CHANGED'});expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('PUT constructs exactly the five allowed fields and never sends client identity or review stamps',async()=>{
 const input={issueDate:'2026-10-31',sourceRef:'message:source',sourceHash:'a'.repeat(64),version:3,reviewed:true as const,reviewedBy:999,userId:999,merchantId:999,roles:['AGENT']};
 await recommendationApi.saveIssueDate(8,input,'synthetic-token-a');const init=fetchMock.mock.calls[0][1];expect(init.method).toBe('PUT');expect(JSON.parse(init.body)).toEqual({issueDate:input.issueDate,sourceRef:input.sourceRef,sourceHash:input.sourceHash,version:3,reviewed:true});expect(init.headers.Authorization).toBe('Bearer synthetic-token-a');
});
it('an old token cannot dispatch under the replacement session',async()=>{session('synthetic-token-b');await expect(recommendationApi.getIssueDate(8,'synthetic-token-a')).rejects.toMatchObject({status:409,errorCode:'SESSION_CHANGED'});expect(fetchMock).not.toHaveBeenCalled();expect(getStoredAccessToken()).toBe('synthetic-token-b');});
it('token rotation during a response discards old data without clearing the new session or retrying',async()=>{
 let finish!:(r:Response)=>void;fetchMock.mockReturnValue(new Promise<Response>(resolve=>{finish=resolve;}));const request=recommendationApi.getIssueDate(8,'synthetic-token-a');session('synthetic-token-b');finish(response());await expect(request).rejects.toMatchObject({status:409,errorCode:'SESSION_CHANGED'});expect(fetchMock).toHaveBeenCalledTimes(1);expect(getStoredAccessToken()).toBe('synthetic-token-b');
});
it('keeps the backend 409 code for the real editor conflict path and performs no automatic retry',async()=>{fetchMock.mockResolvedValue(response(409,{errorCode:'RECOMMENDATION_CHANGED',message:'Conflict'}));await expect(recommendationApi.getIssueDate(8,'synthetic-token-a')).rejects.toMatchObject({status:409,errorCode:'RECOMMENDATION_CHANGED'});expect(fetchMock).toHaveBeenCalledTimes(1);});
it('401 does not refresh and replay this private operation or clear a session',async()=>{fetchMock.mockResolvedValue(response(401,{errorCode:'UNAUTHORIZED'}));await expect(recommendationApi.getIssueDate(8,'synthetic-token-a')).rejects.toMatchObject({status:401});expect(fetchMock).toHaveBeenCalledTimes(1);expect(getStoredAccessToken()).toBe('synthetic-token-a');});
it('denied merchant access stays an explicit 403 without a write retry',async()=>{fetchMock.mockResolvedValue(response(403,{errorCode:'FORBIDDEN'}));await expect(recommendationApi.saveIssueDate(8,{issueDate:'2026-10-31',sourceRef:'message:source',sourceHash:'a'.repeat(64),version:3,reviewed:true},'synthetic-token-a')).rejects.toMatchObject({status:403});expect(fetchMock).toHaveBeenCalledTimes(1);});
it('rejects missing review confirmation and invalid IDs before a fetch',async()=>{await expect(recommendationApi.saveIssueDate(8,{reviewed:false} as never,'synthetic-token-a')).rejects.toMatchObject({status:400});await expect(recommendationApi.getIssueDate(-1,'synthetic-token-a')).rejects.toMatchObject({status:409});expect(fetchMock).not.toHaveBeenCalled();});
it('an HTTP-200 error envelope cannot be accepted as a successful date review',async()=>{fetchMock.mockResolvedValue(response(200,{status:'error',data:review}));await expect(recommendationApi.getIssueDate(8,'synthetic-token-a')).rejects.toMatchObject({errorCode:'INVALID_RESPONSE'});});
