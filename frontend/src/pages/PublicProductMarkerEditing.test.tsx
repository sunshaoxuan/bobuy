import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import PublicProductCatalog from './PublicProductCatalog';
import type {PublicCatalogEntry} from '../api';
const mocks=vi.hoisted(()=>({role:{user:{id:1,platformAdmin:false} as {id:number;platformAdmin:boolean}|null,isMerchant:true,isAuthenticated:true,loading:false},productCatalog:vi.fn(),markedCatalog:vi.fn(),publicAssignments:vi.fn(),list:vi.fn(),assignment:vi.fn(),assign:vi.fn(),productDetail:vi.fn(),productSales:vi.fn()}));
vi.mock('../api',()=>({storefrontApi:{...mocks,productBrowse:async(q:{page:number;marked:boolean;merchantId?:number})=>{const result=await(q.marked?mocks.markedCatalog:mocks.productCatalog)(q.page,q.merchantId);return {...result,items:result.items.map((row:any)=>({...row,image:row.gallery[0]??null,markers:selected.length?[marker]:[]})),scopeTotal:result.total,matchedTotal:result.total,categories:result.items[0]?.categories.map((value:any)=>({...value,count:result.total}))??[],unclassified:0,markedScopeTotal:selected.length?1:0,revision:'r',datasetRevision:'d'};}},productMarkerApi:mocks}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>mocks.role}));
const marker={id:'a',code:'new',badge:'N',name:{'en-US':'New'},description:{},color:'green',sortOrder:0,enabled:true,version:0};
const entry:PublicCatalogEntry={productId:'p',merchantId:1,name:{'en-US':'Product'},description:{},specification:{},brand:'',model:'',packaging:'',itemNumber:'ITEM',gallery:[],categories:[],referenceOffers:[],reviewedMaster:true};
const page=(items:typeof entry[])=>({items,page:0,size:24,total:items.length,hasNext:false});
const props={products:[],quantities:{},onAdd:vi.fn(),canBuy:()=>false};
let selected:string[],version:number;
function URLProbe(){return <span data-testid="catalog-url">{useLocation().search}</span>;}
function mount(){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={['/products?node=1&category=kept&markedCategory=kept']}><PublicProductCatalog {...props}/><URLProbe/></MemoryRouter></I18nProvider>);}
function mountUnfiltered(){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={['/products?node=1']}><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);}
const all=()=>screen.getByRole('region',{name:'Trip finds'});
const marked=()=>screen.getByRole('region',{name:'Marked products'});
it('skips the duplicate marked catalog request when the public scope has no marked products',async()=>{
 selected=[];mountUnfiltered();await within(all()).findByRole('heading',{name:'Product'});
 await waitFor(()=>expect(screen.queryByRole('region',{name:'Marked products'})).toBeNull());
 expect(mocks.markedCatalog).not.toHaveBeenCalled();expect(mocks.productCatalog).toHaveBeenCalledTimes(1);
});
async function open(){await within(all()).findByRole('heading',{name:'Product'});fireEvent.click(within(all()).getByRole('button',{name:'Set product markers: Product'}));return await screen.findByRole('checkbox',{name:'New'});}
beforeEach(()=>{
 vi.clearAllMocks();selected=['a'];version=3;mocks.role={user:{id:1,platformAdmin:false},isMerchant:true,isAuthenticated:true,loading:false};
 mocks.productCatalog.mockImplementation(async()=>page([entry]));mocks.markedCatalog.mockImplementation(async()=>page(selected.length?[entry]:[]));
 mocks.publicAssignments.mockImplementation(async(ids:string[])=>ids.map(productId=>({productId,markers:selected.length?[marker]:[]})));
 mocks.productDetail.mockResolvedValue({item:entry,markers:[marker],revision:"r"});mocks.productSales.mockResolvedValue([]);
 mocks.list.mockResolvedValue([marker]);mocks.assignment.mockImplementation(async()=>({productId:'p',markerIds:[...selected],version}));
 mocks.assign.mockImplementation(async(productId:string,input:{markerIds:string[];version:number})=>{selected=[...input.markerIds];version++;return {productId,markerIds:selected,version};});
});
it.each([
 ['owner AGENT',1,true,true,true,false,false],['other AGENT',2,true,true,false,false,false],['CUSTOMER',1,false,true,false,false,false],['anonymous',null,false,false,false,false,false],['other platform admin with AGENT',2,true,true,false,true,false],['platform admin without AGENT',1,false,true,false,true,false],['own platform admin with AGENT',1,true,true,true,true,false],['dual CUSTOMER/AGENT owner flags',1,true,true,true,false,false],['unresolved stale owner',1,true,true,false,false,true]
])('shows card maintenance only for %s',async(_name,id,merchant,authenticated,visible,platformAdmin,loading)=>{
 mocks.role={user:id===null?null:{id:id as number,platformAdmin:platformAdmin as boolean},isMerchant:merchant as boolean,isAuthenticated:authenticated as boolean,loading:loading as boolean};mountUnfiltered();
 await within(all()).findByRole('heading',{name:'Product'});await within(marked()).findByRole('heading',{name:'Product'});
 expect(within(all()).queryByRole('button',{name:'Set product markers: Product'})!==null).toBe(visible);
 expect(within(marked()).queryByRole('button',{name:'Set product markers: Product'})!==null).toBe(visible);
 expect(mocks.assignment).not.toHaveBeenCalled();
 expect(mocks.list).not.toHaveBeenCalled();expect(mocks.assign).not.toHaveBeenCalled();expect(within(all()).getByLabelText('New')).toBeInTheDocument();
 expect(screen.queryByRole('complementary',{name:'Product management'})!==null).toBe(Boolean(id&&merchant&&authenticated&&!loading));
 if(visible)expect(within(all()).getByRole('group',{name:'Management actions: Product'})).toBeInTheDocument();
});
it('saves explicitly, refreshes both sections, keeps editor after clearing last marker and reopens persisted state',async()=>{
 mountUnfiltered();await open();fireEvent.click(screen.getByRole('button',{name:'Clear selection'}));expect(mocks.assign).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save markers'}));await screen.findByText('Markers saved');
 await waitFor(()=>expect(screen.queryByRole('region',{name:'Marked products'})).toBeNull());await within(all()).findByRole('heading',{name:'Product'});
 expect(all().querySelectorAll('.product-marker-badges')).toHaveLength(0);expect(mocks.productCatalog).toHaveBeenCalledTimes(2);expect(mocks.markedCatalog).toHaveBeenCalledTimes(1);expect(screen.getByRole('checkbox',{name:'New'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'New'})).not.toBeInTheDocument());
 await open();expect(screen.getByRole('checkbox',{name:'New'})).not.toBeChecked();fireEvent.click(screen.getByRole('checkbox',{name:'New'}));fireEvent.click(screen.getByRole('button',{name:'Save markers'}));await screen.findByText('Markers saved');
 await within(marked()).findByRole('heading',{name:'Product'});expect(mocks.assign.mock.calls.map(call=>call[1])).toEqual([{markerIds:[],version:3},{markerIds:['a'],version:4}]);
 await waitFor(()=>expect(all().querySelectorAll('.product-marker-badges')).toHaveLength(1));
});
it('keeps conflict draft and blocks close and duplicate writes while pending',async()=>{
 let reject!:(reason:Error)=>void;mocks.assign.mockImplementation(()=>new Promise((_resolve,fail)=>{reject=fail;}));mountUnfiltered();await open();fireEvent.click(screen.getByRole('checkbox',{name:'New'}));
 const save=screen.getByRole('button',{name:'Save markers'});fireEvent.click(save);fireEvent.click(save);fireEvent.click(screen.getByRole('button',{name:'Close'}));
 expect(screen.getByRole('checkbox',{name:'New'})).toBeInTheDocument();expect(mocks.assign).toHaveBeenCalledTimes(1);
 await act(async()=>reject(new Error('error.marker.invalid')));await screen.findByRole('alert');expect(screen.getByRole('checkbox',{name:'New'})).not.toBeChecked();expect(save).toBeEnabled();expect(mocks.productCatalog).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Close'}));await screen.findByText('Discard unsaved marker changes?');fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.getByRole('checkbox',{name:'New'})).not.toBeChecked();
 await waitFor(()=>expect(screen.queryByText('Discard unsaved marker changes?')).not.toBeInTheDocument());fireEvent.click(screen.getByRole('button',{name:'Close'}));await screen.findByText('Discard unsaved marker changes?');fireEvent.click(screen.getByRole('button',{name:'OK'}));
 await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'New'})).not.toBeInTheDocument());await open();expect(screen.getByRole('checkbox',{name:'New'})).toBeChecked();expect(mocks.assign).toHaveBeenCalledTimes(1);
});
it('preserves category URL filters through a successful refresh',async()=>{
 const categorized={...entry,categories:[{id:'kept',name:{'en-US':'Kept'}}]};mocks.productCatalog.mockImplementation(async()=>page([categorized]));mocks.markedCatalog.mockImplementation(async()=>page([categorized]));mount();await open();fireEvent.click(screen.getByRole('checkbox',{name:'New'}));fireEvent.click(screen.getByRole('button',{name:'Save markers'}));await screen.findByText('Markers saved');
 await waitFor(()=>expect(within(all()).getByRole('button',{name:'Kept (1)'})).toHaveAttribute('aria-pressed','true'));expect(screen.getByTestId('catalog-url')).toHaveTextContent('markedCategory=kept');expect(mocks.productCatalog).toHaveBeenLastCalledWith(0,1);
});
it('exposes the same owner action in detail and never makes unavailable products purchasable',async()=>{
 mountUnfiltered();await within(all()).findByRole('heading',{name:'Product'});expect(within(all()).queryByRole('button',{name:'Add to cart: Product'})).not.toBeInTheDocument();fireEvent.click(within(all()).getByRole('button',{name:'Product details: Product'}));const detail=await screen.findByRole('dialog');expect(await within(detail).findByRole('button',{name:'Not open for booking yet'})).toBeDisabled();fireEvent.click(await within(detail).findByRole('button',{name:'Set product markers: Product'}));await screen.findByRole('checkbox',{name:'New'});expect(mocks.assignment).toHaveBeenCalledWith('p');expect(props.onAdd).not.toHaveBeenCalled();
});
it('drops the old owner draft on identity change and ignores its late save response',async()=>{
 let resolve!:(result:unknown)=>void;mocks.assign.mockImplementation(()=>new Promise(done=>{resolve=done;}));const view=mountUnfiltered();await open();fireEvent.click(screen.getByRole('checkbox',{name:'New'}));fireEvent.click(screen.getByRole('button',{name:'Save markers'}));
 mocks.role={user:{id:2,platformAdmin:true},isMerchant:true,isAuthenticated:true,loading:false};view.rerender(<I18nProvider><MemoryRouter><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);
 await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'New'})).not.toBeInTheDocument());await act(async()=>resolve({productId:'p',markerIds:[],version:4}));expect(screen.queryByText('Markers saved')).not.toBeInTheDocument();expect(within(all()).queryByRole('button',{name:'Set product markers: Product'})).not.toBeInTheDocument();expect(mocks.productCatalog).toHaveBeenCalledTimes(2);
});
it('opens the same parent editor directly from the marked card and names the product/ITEM',async()=>{
 mountUnfiltered();await within(marked()).findByRole('heading',{name:'Product'});fireEvent.click(within(marked()).getByRole('button',{name:'Set product markers: Product'}));await screen.findByRole('checkbox',{name:'New'});const drawer=screen.getByRole('dialog');expect(drawer.querySelector('.marker-product-context')).toHaveTextContent('Product');expect(drawer.querySelector('.marker-product-context')).toHaveTextContent('ITEM');expect(mocks.assignment).toHaveBeenCalledTimes(1);expect(mocks.list).toHaveBeenCalledTimes(1);
});
it('removes a draft immediately while auth is unresolved and reopens a fresh editor after resolution',async()=>{
 const view=mountUnfiltered();await open();fireEvent.click(screen.getByRole('checkbox',{name:'New'}));mocks.role.loading=true;view.rerender(<I18nProvider><MemoryRouter><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'New'})).not.toBeInTheDocument());expect(screen.queryByRole('complementary',{name:'Product management'})).not.toBeInTheDocument();expect(mocks.assignment).toHaveBeenCalledTimes(1);mocks.role.loading=false;view.rerender(<I18nProvider><MemoryRouter><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);await open();expect(screen.getByRole('checkbox',{name:'New'})).toBeChecked();expect(mocks.assign).not.toHaveBeenCalled();
});
