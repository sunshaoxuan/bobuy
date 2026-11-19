import {act,renderHook,waitFor} from '@testing-library/react';
import {useProgressiveCatalog} from './useProgressiveCatalog';
import {browsePage,productCard} from './test/browseFixtures';
const api=vi.hoisted(()=>({productOverview:vi.fn(),productShelf:vi.fn()}));
vi.mock('./api',()=>({storefrontApi:api}));
const metadata=()=>browsePage([],{scopeTotal:4,matchedTotal:4,shelves:['a','b','c','d'].map(category=>({category,items:category==='a'?[productCard('a')]:[],total:1}))});
const shelf=(category:string)=>({...metadata(),shelves:[{category,total:1,items:[productCard(category)]}]});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
beforeEach(()=>{vi.clearAllMocks();api.productOverview.mockResolvedValue(metadata());api.productShelf.mockImplementation(q=>Promise.resolve(shelf(q.category)));});
it('shows navigation before cards, bounds concurrency and never waits for a later slow shelf',async()=>{
 const first=deferred<ReturnType<typeof shelf>>(),second=deferred<ReturnType<typeof shelf>>();
 api.productShelf.mockImplementation(q=>q.category==='b'?first.promise:q.category==='c'?second.promise:Promise.resolve(shelf(q.category)));
 const {result}=renderHook(()=>useProgressiveCatalog('one',{},true,false));
 await waitFor(()=>expect(result.current.page?.shelves).toHaveLength(4));await waitFor(()=>expect(result.current.shelves.a.loaded).toBe(true));
 act(()=>{result.current.activate('b');result.current.activate('c');result.current.activate('d');result.current.activate('d');});expect(api.productShelf).toHaveBeenCalledTimes(2);
 await act(async()=>first.resolve(shelf('b')));
 await waitFor(()=>expect(result.current.shelves.d.loaded).toBe(true));expect(result.current.shelves.a.loaded).toBe(true);expect(result.current.shelves.c.loaded).toBe(false);
 expect(api.productShelf.mock.calls.map(c=>c[0].category)).toEqual(['b','c','d']);
});
it('retries just a failed shelf and preserves successful rows without duplicates',async()=>{
 api.productShelf.mockRejectedValueOnce(Error('offline')).mockImplementation(q=>Promise.resolve(shelf(q.category)));
 const {result}=renderHook(()=>useProgressiveCatalog('one',{},true,false));await waitFor(()=>expect(result.current.shelves.a.loaded).toBe(true));act(()=>result.current.activate('b'));await waitFor(()=>expect(result.current.shelves.b.error).toBe('offline'));
 act(()=>result.current.activate('c'));await waitFor(()=>expect(result.current.shelves.c.loaded).toBe(true));
 act(()=>{result.current.retry('b');result.current.retry('b');});await waitFor(()=>expect(result.current.shelves.b.loaded).toBe(true));
 expect(api.productShelf.mock.calls.map(c=>c[0].category)).toEqual(['b','c','b']);expect(api.productOverview).toHaveBeenCalledTimes(1);
});
it('rejects mixed revisions and halts further shelf loads until explicit refresh',async()=>{
 api.productShelf.mockResolvedValue({...shelf('b'),revision:'changed'});
 const {result}=renderHook(()=>useProgressiveCatalog('one',{},true,false));await waitFor(()=>expect(result.current.shelves.a.loaded).toBe(true));act(()=>result.current.activate('b'));await waitFor(()=>expect(result.current.changed).toBe(true));
 act(()=>{result.current.activate('b');result.current.retry('b');});expect(api.productShelf).toHaveBeenCalledTimes(1);expect(result.current.shelves.b.items).toEqual([]);
});
it('drops old merchant responses and respects paused detail reads',async()=>{
 const old=deferred<ReturnType<typeof metadata>>();api.productOverview.mockImplementation(q=>q.merchantId===1?old.promise:Promise.resolve(metadata()));
 const {result,rerender}=renderHook(({id,paused})=>useProgressiveCatalog(String(id),{merchantId:id},true,paused),{initialProps:{id:1,paused:false}});
 rerender({id:2,paused:true});await waitFor(()=>expect(result.current.page).toBeDefined());expect(api.productShelf).not.toHaveBeenCalled();
 await act(async()=>old.resolve({...metadata(),revision:'old'}));expect(result.current.page?.revision).not.toBe('old');
 rerender({id:2,paused:false});await waitFor(()=>expect(result.current.shelves.a.loaded).toBe(true));act(()=>result.current.activate('b'));await waitFor(()=>expect(result.current.shelves.b.loaded).toBe(true));expect(api.productShelf.mock.calls[0][0].merchantId).toBe(2);
});
