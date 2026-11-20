import {act,renderHook,waitFor} from '@testing-library/react';
import {useProgressiveCatalog} from './useProgressiveCatalog';
import {browsePage,productCard} from './test/browseFixtures';
const api=vi.hoisted(()=>({productOverview:vi.fn(),productShelf:vi.fn(),categoryIcons:vi.fn()}));
vi.mock('./api',()=>({storefrontApi:api}));
const metadata=()=>browsePage([],{scopeTotal:4,matchedTotal:4,shelves:['a','b','c','d'].map(category=>({category,items:category==='a'?[productCard('a')]:[],total:1}))});
const shelf=(category:string)=>({...metadata(),shelves:[{category,total:1,items:[productCard(category)]}]});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
beforeEach(()=>{vi.clearAllMocks();api.categoryIcons.mockResolvedValue([]);api.productOverview.mockResolvedValue(metadata());api.productShelf.mockImplementation(q=>Promise.resolve(shelf(q.category)));});
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

it('requests product data first and displays the first shelf while optional icon hints are pending',async()=>{
 const hints=deferred<string[]>();api.categoryIcons.mockReturnValue(hints.promise);
 const {result}=renderHook(()=>useProgressiveCatalog('icon-pending',{},true,false));
 await waitFor(()=>expect(result.current.shelves.a.loaded).toBe(true));
 expect(api.productOverview.mock.invocationCallOrder[0]).toBeLessThan(api.categoryIcons.mock.invocationCallOrder[0]);
 expect(result.current.error).toBe('');expect(result.current.shelves.a.items).toHaveLength(1);
 await act(async()=>hints.resolve([]));expect(result.current.shelves.a.loaded).toBe(true);
});

it('continues a real 25-item section to its last item and retries without duplicating its first 24',async()=>{
 const rows=Array.from({length:25},(_,i)=>productCard('p'+i));
 const nav=browsePage([],{scopeTotal:25,matchedTotal:25,shelves:[{category:'a',total:25,items:rows.slice(0,8)}]});
 api.productOverview.mockResolvedValue(nav);api.productShelf.mockResolvedValueOnce({...nav,shelves:[{category:'a',total:25,items:rows.slice(0,24)}]}).mockRejectedValueOnce(Error('offline')).mockResolvedValue({...nav,page:1,shelves:[{category:'a',total:25,items:rows.slice(24)}]});
 const {result}=renderHook(()=>useProgressiveCatalog('pages',{sections:true},true,false));await waitFor(()=>expect(result.current.shelves.a.items).toHaveLength(8));act(()=>result.current.next('a'));await waitFor(()=>expect(result.current.shelves.a.items).toHaveLength(24));
 act(()=>{result.current.next('a');result.current.next('a');});await waitFor(()=>expect(result.current.shelves.a.error).toBe('offline'));expect(result.current.shelves.a.items).toHaveLength(24);
 act(()=>result.current.retry('a'));await waitFor(()=>expect(result.current.shelves.a.items).toHaveLength(25));expect(result.current.shelves.a.items.at(-1)?.productId).toBe('p24');
 act(()=>result.current.next('a'));expect(api.productShelf.mock.calls.map(c=>c[0].page)).toEqual([0,1,1]);
});
it('reuses root browse previews and replaces page zero only with a matching ordered prefix',async()=>{
 const rows=Array.from({length:25},(_,i)=>productCard('p'+i));
 const seed=browsePage(rows.slice(0,24),{scopeTotal:25,matchedTotal:25,shelves:[{category:'a',total:25,items:rows.slice(0,8)}]});
 api.productShelf.mockResolvedValue({...seed,items:[],shelves:[{category:'a',total:25,items:rows.slice(0,24)}]});
 const {result}=renderHook(()=>useProgressiveCatalog('root',{sections:true,category:'root'},true,false,undefined,seed));await waitFor(()=>expect(result.current.shelves.a.items).toHaveLength(8));expect(api.productOverview).not.toHaveBeenCalled();
 act(()=>result.current.next('a'));await waitFor(()=>expect(result.current.shelves.a.items).toHaveLength(24));expect(api.productShelf.mock.calls[0][0]).toMatchObject({scopeCategory:'root',category:'a',page:0});
});
