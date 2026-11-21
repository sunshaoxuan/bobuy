import {act,renderHook,waitFor} from '@testing-library/react';
import {useVisibleCatalog} from './useVisibleCatalog';
import {browsePage,productCard} from './test/browseFixtures';
const api=vi.hoisted(()=>({productOverview:vi.fn(),productShelf:vi.fn(),productBrowse:vi.fn(),categoryIcons:vi.fn()}));
vi.mock('./api',()=>({storefrontApi:api}));
const categories=[{id:'root',name:{'en-US':'Root'},count:40},{id:'a',parentId:'root',name:{'en-US':'Leaf'},count:40}];
function response(q:any,section=false){const items=Array.from({length:Math.min(q.limit,40-q.offset)},(_,i)=>productCard('p'+(q.offset+i)));return browsePage(section?[]:items,{offset:q.offset,size:q.limit,scopeTotal:40,matchedTotal:40,hasNext:q.offset+q.limit<40,categories,shelves:section?[{category:'a',total:40,items}]:[],selectedCategory:section?'':'a'});}
beforeEach(()=>{vi.clearAllMocks();api.categoryIcons.mockResolvedValue([]);api.productOverview.mockImplementation(q=>Promise.resolve(response(q,true)));api.productShelf.mockImplementation(q=>Promise.resolve(response(q,true)));api.productBrowse.mockImplementation(q=>Promise.resolve(response(q)));});
it('jumps to demanded rows without reading the intervening prefix and reuses overlapping positions',async()=>{
 const {result}=renderHook(()=>useVisibleCatalog('a',{},true,false,6));await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));
 act(()=>result.current.ensure('a',20,26));await waitFor(()=>expect(result.current.rows.a.items.has(25)).toBe(true));expect(api.productShelf).toHaveBeenCalledTimes(1);expect(api.productShelf.mock.calls[0][0]).toMatchObject({offset:20,limit:6,category:'a'});expect(result.current.rows.a.items.has(6)).toBe(false);
 act(()=>result.current.ensure('a',22,28));await waitFor(()=>expect(result.current.rows.a.items.has(27)).toBe(true));expect(api.productShelf.mock.calls[1][0]).toMatchObject({offset:26,limit:2});expect(result.current.visible.map(i=>i.productId)).toEqual(['p22','p23','p24','p25','p26','p27']);
});
it('retains earlier facts on a failed range and retries only that demand',async()=>{
 const {result}=renderHook(()=>useVisibleCatalog('a',{},true,false,6));await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));api.productShelf.mockRejectedValueOnce(Error('offline'));
 act(()=>result.current.ensure('a',6,12));await waitFor(()=>expect(result.current.rows.a.error).toBe('offline'));expect(result.current.rows.a.items.size).toBe(6);
 act(()=>result.current.retry('a'));await waitFor(()=>expect(result.current.rows.a.items.size).toBe(12));expect(api.productShelf.mock.calls.map(c=>[c[0].offset,c[0].limit])).toEqual([[6,6],[6,6]]);
});
it('does not combine changed revisions or duplicate identities',async()=>{
 const {result}=renderHook(()=>useVisibleCatalog('a',{},true,false,6));await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));api.productShelf.mockImplementationOnce(q=>Promise.resolve({...response(q,true),revision:'changed'}));
 act(()=>result.current.ensure('a',6,12));await waitFor(()=>expect(result.current.changed).toBe(true));expect(result.current.rows.a.items.size).toBe(6);act(()=>result.current.retry('a'));expect(api.productShelf).toHaveBeenCalledTimes(1);
});
it('discards a late response after a merchant change and resumes paused viewport work',async()=>{
 let resolve!:(r:any)=>void;api.productShelf.mockImplementationOnce(()=>new Promise(r=>resolve=r));
 const {result,rerender}=renderHook(({id,paused})=>useVisibleCatalog(id,{merchantId:id==='a'?1:2},true,paused,6),{initialProps:{id:'a',paused:false}});await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));act(()=>result.current.ensure('a',6,12));
 rerender({id:'b',paused:true});await waitFor(()=>expect(result.current.identity).toBe('b'));await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));act(()=>result.current.ensure('a',20,26));expect(api.productShelf).toHaveBeenCalledTimes(1);
 await act(async()=>resolve(response({offset:6,limit:6},true)));expect(result.current.rows.a.items.has(6)).toBe(false);rerender({id:'b',paused:false});await waitFor(()=>expect(result.current.rows.a.items.has(25)).toBe(true));
});
it('keeps explicit leaves and search/sort in a single ordered range',async()=>{
 const {result}=renderHook(()=>useVisibleCatalog('leaf',{category:'a',sort:'rating-desc',query:'text'},true,false,6));await waitFor(()=>expect(result.current.rows['']?.items.size).toBe(6));expect(result.current.continuous).toBe(false);expect(api.categoryIcons).not.toHaveBeenCalled();expect(api.productOverview).not.toHaveBeenCalled();expect(api.productBrowse.mock.calls[0][0]).toMatchObject({category:'a',sort:'rating-desc',query:'text',offset:0,limit:6});
});
it('rejects a duplicate product at a different offset',async()=>{
 const {result}=renderHook(()=>useVisibleCatalog('a',{},true,false,6));await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));
 api.productShelf.mockImplementationOnce(q=>{const value=response(q,true);value.shelves![0].items[0]=productCard('p0');return Promise.resolve(value);});
 act(()=>result.current.ensure('a',6,12));await waitFor(()=>expect(result.current.changed).toBe(true));expect(result.current.rows.a.items.size).toBe(6);
});
it('limits concurrent section reads to two without letting a slow later section block existing cards',async()=>{
 const metas=['a','b','c'].map((category,index)=>({category,total:20,items:index?[]:Array.from({length:6},(_,i)=>productCard('a'+i))}));
 api.productOverview.mockImplementation(q=>Promise.resolve(browsePage([],{offset:0,size:q.limit,scopeTotal:60,matchedTotal:60,shelves:metas,categories:[]})));
 const completions:Array<()=>void>=[];api.productShelf.mockImplementation(q=>new Promise(resolve=>completions.push(()=>resolve(browsePage([],{offset:q.offset,size:q.limit,scopeTotal:60,matchedTotal:60,shelves:[{category:q.category,total:20,items:Array.from({length:q.limit},(_,i)=>productCard(q.category+(q.offset+i)))}]})))));
 const {result}=renderHook(()=>useVisibleCatalog('a',{},true,false,6));await waitFor(()=>expect(result.current.rows.a?.items.size).toBe(6));
 act(()=>{result.current.ensure('a',6,12);result.current.ensure('b',0,6);result.current.ensure('c',0,6);});expect(api.productShelf).toHaveBeenCalledTimes(2);expect(result.current.rows.a.items.get(0)?.productId).toBe('a0');
 await act(async()=>completions[0]());await waitFor(()=>expect(api.productShelf).toHaveBeenCalledTimes(3));
});
