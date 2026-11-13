import {api,storefrontApi} from './api';
import {isRecoverableReadError,retryRead} from './readRecovery';
const response=(status:number)=>({status,ok:status<400,body:null,json:async()=>({message:'unavailable',status:'success',data:[]})}) as Response;
beforeEach(()=>{vi.useFakeTimers();localStorage.clear();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.restoreAllMocks();});

it('keeps public reads independent of an expired session without refreshing or clearing it',async()=>{
 localStorage.setItem('bobbuy_access_token','expired-session-fixture');
 const fetch=vi.fn().mockImplementation(async(_url:string,init:RequestInit)=>response(new Headers(init.headers).has('Authorization')?401:200));vi.stubGlobal('fetch',fetch);
 await expect(storefrontApi.trips()).resolves.toEqual([]);
 await expect(storefrontApi.activeTrips()).resolves.toEqual([]);
 expect(fetch.mock.calls.every(call=>!new Headers(call[1].headers).has('Authorization'))).toBe(true);
 expect(localStorage.getItem('bobbuy_access_token')).toBe('expired-session-fixture');
 expect(fetch.mock.calls.some(call=>call[0]==='/api/auth/refresh')).toBe(false);
});

it('recovers network failures with exactly two delayed retries and no intermediate UI error',async()=>{
 const fetch=vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(response(502)).mockResolvedValue(response(200));vi.stubGlobal('fetch',fetch);
 const result=storefrontApi.trips();await vi.advanceTimersByTimeAsync(499);expect(fetch).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1);expect(fetch).toHaveBeenCalledTimes(2);await vi.advanceTimersByTimeAsync(1500);await expect(result).resolves.toEqual([]);
 expect(fetch).toHaveBeenCalledTimes(3);expect(fetch.mock.calls.every(call=>call[0]==='/api/storefront/trips'&&call[1].method===undefined&&call[1].cache==='no-store')).toBe(true);
});
it.each([408,500,502,503,504])('bounds transient HTTP %s and marks exhaustion recoverable',async status=>{
 const request=vi.fn().mockResolvedValue(response(status));vi.stubGlobal('fetch',request);const result=storefrontApi.trips().catch(error=>error);
 await vi.advanceTimersByTimeAsync(2000);expect(isRecoverableReadError(await result)).toBe(true);expect(request).toHaveBeenCalledTimes(3);expect(vi.getTimerCount()).toBe(0);
});
it.each([400,401,403,404,409,422,429])('does not retry business HTTP %s or refresh a public GET',async status=>{
 const fetch=vi.fn().mockResolvedValue(response(status));vi.stubGlobal('fetch',fetch);const result=await storefrontApi.trips().catch(error=>error);
 expect(isRecoverableReadError(result)).toBe(false);expect(fetch).toHaveBeenCalledTimes(1);
});
it('marks exhausted network errors recoverable and stops all timers',async()=>{
 const request=vi.fn().mockRejectedValue(new TypeError('offline'));const result=retryRead(request).catch(error=>error);await vi.advanceTimersByTimeAsync(2000);
 expect(isRecoverableReadError(await result)).toBe(true);expect(request).toHaveBeenCalledTimes(3);expect(vi.getTimerCount()).toBe(0);
});
it('does not retry caller cancellation or programming errors',async()=>{
 for(const error of [new DOMException('cancelled','AbortError'),new Error('bug')]){const request=vi.fn().mockRejectedValue(error);await expect(retryRead(request)).rejects.toBe(error);expect(request).toHaveBeenCalledTimes(1);}expect(vi.getTimerCount()).toBe(0);
});
it('times out a stalled GET and bounds the recovery attempts',async()=>{
 const request=vi.fn().mockImplementation((signal:AbortSignal)=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError')),{once:true})));
 const result=retryRead(request).catch(error=>error);await vi.advanceTimersByTimeAsync(38000);expect(isRecoverableReadError(await result)).toBe(true);expect(request).toHaveBeenCalledTimes(3);expect(vi.getTimerCount()).toBe(0);
});
it('does not retry malformed successful JSON',async()=>{
 const fetch=vi.fn().mockResolvedValue({...response(200),json:async()=>{throw new SyntaxError('invalid json');}});vi.stubGlobal('fetch',fetch);await expect(storefrontApi.trips()).rejects.toThrow('invalid json');expect(fetch).toHaveBeenCalledTimes(1);
});
it.each(['network','503'])('never automatically replays checkout after %s failure',async mode=>{
 const fetch=mode==='network'?vi.fn().mockRejectedValue(new TypeError('uncertain')):vi.fn().mockResolvedValue(response(503));vi.stubGlobal('fetch',fetch);
 const payload={requestId:'same-id',tripId:11,items:[]};await expect(storefrontApi.checkout(payload)).rejects.toThrow();await vi.advanceTimersByTimeAsync(10000);expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][1].method).toBe('POST');expect(JSON.parse(fetch.mock.calls[0][1].body).requestId).toBe('same-id');
});
it('leaves protected GET authentication and transport behavior unchanged',async()=>{
 const fetch=vi.fn().mockRejectedValue(new TypeError('offline'));vi.stubGlobal('fetch',fetch);await expect(api.trips()).rejects.toThrow('offline');expect(fetch).toHaveBeenCalledTimes(1);
});
