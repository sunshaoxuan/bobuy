import {fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import type {PublicCatalogEntry,PublicCatalogPage,StoreProduct} from '../api';
import {CatalogSection as PublicProductCatalog,catalogText} from './PublicProductCatalog';
const mocks=vi.hoisted(()=>({productCatalog:vi.fn(),publicAssignments:vi.fn(async()=>[])}));
vi.mock('../api',()=>({storefrontApi:mocks,productMarkerApi:mocks}));
const row=(id:number,merchantId=1):PublicCatalogEntry=>({productId:String(id),merchantId,name:{'en-US':'Product '+id},description:{'ja-JP':'Original description'},specification:{'en-US':'500 g'},brand:'Brand',itemNumber:'ITEM'+id,model:'M1',packaging:'Box',gallery:[],categories:[],referenceOffers:[],reviewedMaster:true});
const page=(rows:PublicCatalogEntry[],index=0,total=rows.length,hasNext=false):PublicCatalogPage=>({items:rows,page:index,size:24,total,hasNext});
const base={products:[] as StoreProduct[],quantities:{},onAdd:vi.fn(),canBuy:()=>false};
function mount(props:Partial<typeof base>&{query?:string}={},path='/products') {
 localStorage.setItem('bobbuy_locale','en-US');
 return render(<I18nProvider><MemoryRouter initialEntries={[path]}><PublicProductCatalog {...base} {...props}/></MemoryRouter></I18nProvider>);
}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();});
it('browses public masters without sale products/trips, preserving separate identity and no fake price',async()=>{
 mocks.productCatalog.mockResolvedValue(page([row(1)]));const view=mount();
 expect(await screen.findByRole('heading',{name:'Product 1'})).toBeInTheDocument();
 expect(screen.getByText('Brand')).toBeInTheDocument();expect(screen.getByText('500 g')).toBeInTheDocument();
 expect(view.container.querySelector('.rec-sale-actual')).toBeNull();expect(screen.getByRole('button',{name:'Add to cart: Product 1'})).toBeDisabled();
 expect(mocks.productCatalog).toHaveBeenCalledWith(0,undefined);
});
it('finishes every page before filtered empty results and finds last-page categories/search',async()=>{
 const rows=Array.from({length:25},(_,i)=>row(i));rows[24]={...row(24),name:{'en-US':'Last-page-only'},categories:[{id:'last',name:{'en-US':'Final category'}}]};
 let resolve!:(value:PublicCatalogPage)=>void;
 mocks.productCatalog.mockImplementation((index:number)=>index===0?Promise.resolve(page(rows.slice(0,24),0,25,true)):new Promise<PublicCatalogPage>(done=>{resolve=done;}));
 const view=mount({query:'last-page-only'});
 await waitFor(()=>expect(mocks.productCatalog).toHaveBeenCalledTimes(2));expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(0);
 expect(screen.queryByText('No matching products')).not.toBeInTheDocument();
 await act(async()=>resolve(page([rows[24]],1,25)));
 expect(await screen.findByRole('heading',{name:'Last-page-only'})).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Final category (1)'})).toBeInTheDocument();
});
it('makes all loaded cards reachable through explicit load-more and filters all 25',async()=>{
 const rows=Array.from({length:25},(_,i)=>row(i));rows[24].categories=[{id:'last',name:{'en-US':'Final category'}}];
 mocks.productCatalog.mockImplementation(async(index:number)=>page(rows.slice(index*24,(index+1)*24),index,25,index===0));
 const view=mount();await screen.findByRole('heading',{name:'Product 0'});
 expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(24);
 fireEvent.click(screen.getByRole('button',{name: name=>name.includes('24/25')}));expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(25);
 fireEvent.click(screen.getByRole('button',{name:'Final category (1)'}));expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(1);
 expect(screen.getByRole('heading',{name:'Product 24'})).toBeInTheDocument();
});
it('retries a failed later page from page zero without showing partial success',async()=>{
 mocks.productCatalog.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(page([row(1)]));
 const view=mount();await screen.findByRole('alert');expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(0);
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));expect(await screen.findByRole('heading',{name:'Product 1'})).toBeInTheDocument();
 expect(mocks.productCatalog.mock.calls).toEqual([[0,undefined],[0,undefined]]);
});
it('suppresses stale merchant results and retains complete new-scope results',async()=>{
 let oldResolve!:(value:PublicCatalogPage)=>void;
 mocks.productCatalog.mockImplementation((_page:number,node:number)=>node===1?new Promise<PublicCatalogPage>(done=>{oldResolve=done;}):Promise.resolve(page([row(2,2)])));
 function Harness(){const nav=useNavigate();return <><button onClick={()=>nav('/products?node=2')}>Switch merchant</button><PublicProductCatalog {...base}/></>;}
 localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><MemoryRouter initialEntries={['/products?node=1']}><Harness/></MemoryRouter></I18nProvider>);
 await waitFor(()=>expect(mocks.productCatalog).toHaveBeenCalledWith(0,1));fireEvent.click(screen.getByRole('button',{name:'Switch merchant'}));
 await screen.findByRole('heading',{name:'Product 2'});await act(async()=>oldResolve(page([row(1)])));
 expect(screen.queryByRole('heading',{name:'Product 1'})).not.toBeInTheDocument();expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(1);
});
it('keeps invalid merchant scopes empty without broadening API access',async()=>{
 mount({},'/products?node=invalid');await screen.findByText('No public products');expect(mocks.productCatalog).not.toHaveBeenCalled();
});
it('uses existing buyability and same-merchant sale data only',async()=>{
 mocks.productCatalog.mockResolvedValue(page([row(1)]));
 const sale={id:'1',merchantId:1,name:{'en-US':'Product 1'},description:{},brand:'Brand',price:888,categoryId:'',images:[],currency:'JPY',recommendationReady:true};
 const onAdd=vi.fn();mount({products:[sale],canBuy:()=>true,onAdd});await screen.findByRole('heading',{name:'Product 1'});
 fireEvent.click(screen.getByRole('button',{name:'Add to cart: Product 1'}));expect(onAdd).toHaveBeenCalledWith(sale);
 expect(document.querySelector('.rec-sale-actual')).toHaveTextContent('888');
});
it('opens source-language master details and preserves individual historical issue references',async()=>{
 const entry=row(1);entry.referenceOffers=[{postId:9,facts:{id:90,name:'Historical source name',imageUrl:'',referencePrice:77,offerStart:'2020-01-01',offerEnd:'2020-01-02',referenceContext:{channel:'COSTCO_ONLINE'}}}];
 mocks.productCatalog.mockResolvedValue(page([entry]));mount({},'/products?node=1');await screen.findByRole('heading',{name:'Product 1'});
 fireEvent.click(screen.getByRole('button',{name:'Reference offers (1)'}));
 expect((await screen.findByText('Original description')).closest('[lang]')).toHaveAttribute('lang','ja-JP');
 expect(screen.getByText('Source language: ja-JP')).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Issue 9'})).toHaveAttribute('href','/recommendations/9?node=1&item=90');
 expect(document.querySelector('.catalog-master-detail .rec-sale-actual')).toBeNull();
 expect(screen.getByText(/77 JPY/)).toBeInTheDocument();
});
it('marks source language explicitly for missing translations',()=>{
 expect(catalogText({'ja-JP':'Original'},'zh-CN')).toEqual({value:'Original',language:'ja-JP',fallback:true});
 expect(catalogText({'en-US':'Translated'},'en-US').fallback).toBe(false);
});
