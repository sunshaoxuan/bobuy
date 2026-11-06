import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import PublicProductCatalog from './PublicProductCatalog';
import type {PublicCatalogEntry} from '../api';
const mocks=vi.hoisted(()=>({role:{user:{id:1,platformAdmin:false} as {id:number;platformAdmin:boolean}|null,isMerchant:true,isAuthenticated:true},productCatalog:vi.fn(),markedCatalog:vi.fn(),publicAssignments:vi.fn(),list:vi.fn(),assignment:vi.fn(),assign:vi.fn()}));
vi.mock('../api',()=>({storefrontApi:mocks,productMarkerApi:mocks}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>mocks.role}));
const marker={id:'a',code:'new',badge:'N',name:{'en-US':'New'},description:{},color:'green',sortOrder:0,enabled:true,version:0};
const entry:PublicCatalogEntry={productId:'p',merchantId:1,name:{'en-US':'Product'},description:{},specification:{},brand:'',model:'',packaging:'',itemNumber:'ITEM',gallery:[],categories:[],referenceOffers:[],reviewedMaster:true};
const page=(items:typeof entry[])=>({items,page:0,size:24,total:items.length,hasNext:false});
const props={products:[],quantities:{},onAdd:vi.fn(),canBuy:()=>false};
let selected:string[],version:number;
function mount(){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={['/products?node=1&category=kept&markedCategory=kept']}><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);}
function mountUnfiltered(){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={['/products?node=1']}><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);}
const all=()=>screen.getByRole('region',{name:'Trip finds'});
const marked=()=>screen.getByRole('region',{name:'Marked products'});
async function open(){await within(all()).findByRole('heading',{name:'Product'});fireEvent.click(within(all()).getByRole('button',{name:'Product markers: Product'}));return await screen.findByRole('checkbox',{name:'New'});}
beforeEach(()=>{
 vi.clearAllMocks();selected=['a'];version=3;mocks.role={user:{id:1,platformAdmin:false},isMerchant:true,isAuthenticated:true};
 mocks.productCatalog.mockImplementation(async()=>page([entry]));mocks.markedCatalog.mockImplementation(async()=>page(selected.length?[entry]:[]));
 mocks.publicAssignments.mockImplementation(async(ids:string[])=>ids.map(productId=>({productId,markers:selected.length?[marker]:[]})));
 mocks.list.mockResolvedValue([marker]);mocks.assignment.mockImplementation(async()=>({productId:'p',markerIds:[...selected],version}));
 mocks.assign.mockImplementation(async(productId:string,input:{markerIds:string[];version:number})=>{selected=[...input.markerIds];version++;return {productId,markerIds:selected,version};});
});
it.each([
 ['owner AGENT',1,true,true,true,false],['other AGENT',2,true,true,false,false],['CUSTOMER',1,false,true,false,false],['anonymous',null,false,false,false,false],['other platform admin',2,true,true,false,true]
])('shows card maintenance only for %s',async(_name,id,merchant,authenticated,visible,platformAdmin)=>{
 mocks.role={user:id===null?null:{id:id as number,platformAdmin:platformAdmin as boolean},isMerchant:merchant as boolean,isAuthenticated:authenticated as boolean};mountUnfiltered();
 await within(all()).findByRole('heading',{name:'Product'});await within(marked()).findByRole('heading',{name:'Product'});
 expect(within(all()).queryByRole('button',{name:'Product markers: Product'})!==null).toBe(visible);
 expect(within(marked()).queryByRole('button',{name:'Product markers: Product'})!==null).toBe(visible);
 expect(mocks.assignment).not.toHaveBeenCalled();
});
it('saves explicitly, refreshes both sections, keeps editor after clearing last marker and reopens persisted state',async()=>{
 mountUnfiltered();await open();fireEvent.click(screen.getByRole('button',{name:'Clear selection'}));expect(mocks.assign).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save markers'}));await screen.findByText('Markers saved');
 await waitFor(()=>expect(marked().querySelectorAll('.catalog-master-card')).toHaveLength(0));await within(all()).findByRole('heading',{name:'Product'});
 expect(all().querySelectorAll('.product-marker-badges')).toHaveLength(0);expect(mocks.productCatalog).toHaveBeenCalledTimes(2);expect(mocks.markedCatalog).toHaveBeenCalledTimes(2);expect(screen.getByRole('checkbox',{name:'New'})).not.toBeChecked();
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
 await waitFor(()=>expect(within(all()).getByRole('button',{name:'Kept (1)'})).toHaveAttribute('aria-pressed','true'));expect(within(marked()).getByRole('button',{name:'Kept (1)'})).toHaveAttribute('aria-pressed','true');expect(mocks.productCatalog).toHaveBeenLastCalledWith(0,1);
});
it('exposes the same owner action in detail and never makes unavailable products purchasable',async()=>{
 mountUnfiltered();await within(all()).findByRole('heading',{name:'Product'});expect(within(all()).getByRole('button',{name:'Add to cart: Product'})).toBeDisabled();fireEvent.click(within(all()).getByRole('button',{name:'Product details: Product'}));const detail=await screen.findByRole('dialog');fireEvent.click(within(detail).getByRole('button',{name:'Product markers'}));await screen.findByRole('checkbox',{name:'New'});expect(mocks.assignment).toHaveBeenCalledWith('p');expect(props.onAdd).not.toHaveBeenCalled();
});
it('drops the old owner draft on identity change and ignores its late save response',async()=>{
 let resolve!:(result:unknown)=>void;mocks.assign.mockImplementation(()=>new Promise(done=>{resolve=done;}));const view=mountUnfiltered();await open();fireEvent.click(screen.getByRole('checkbox',{name:'New'}));fireEvent.click(screen.getByRole('button',{name:'Save markers'}));
 mocks.role={user:{id:2,platformAdmin:true},isMerchant:true,isAuthenticated:true};view.rerender(<I18nProvider><MemoryRouter><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);
 await waitFor(()=>expect(screen.queryByRole('checkbox',{name:'New'})).not.toBeInTheDocument());await act(async()=>resolve({productId:'p',markerIds:[],version:4}));expect(screen.queryByText('Markers saved')).not.toBeInTheDocument();expect(within(all()).queryByRole('button',{name:'Product markers: Product'})).not.toBeInTheDocument();expect(mocks.productCatalog).toHaveBeenCalledTimes(1);
});
