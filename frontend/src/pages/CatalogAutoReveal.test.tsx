import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import PublicProductCatalog,{CatalogSection} from './PublicProductCatalog';
import type {PublicCatalogEntry} from '../api';
const mocks=vi.hoisted(()=>({productCatalog:vi.fn(),markedCatalog:vi.fn(),publicAssignments:vi.fn()}));
vi.mock('../api',()=>({storefrontApi:mocks,productMarkerApi:mocks}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({user:null,isMerchant:false,isAuthenticated:false})}));
const rows=(count:number,prefix='p'):PublicCatalogEntry[]=>Array.from({length:count},(_,i)=>({productId:prefix+i,merchantId:1,name:{'en-US':prefix+i},description:{},specification:{},brand:'',model:'',packaging:'',itemNumber:prefix+i,gallery:[],categories:[],referenceOffers:[],reviewedMaster:true}));
const page=(items:PublicCatalogEntry[],index=0)=>({items:items.slice(index*24,(index+1)*24),page:index,size:24,total:items.length,hasNext:(index+1)*24<items.length});
const props={products:[],quantities:{},onAdd:vi.fn(),canBuy:()=>false};
const observers:FakeObserver[]=[];let frameId=0;const frames=new Map<number,FrameRequestCallback>();
class FakeObserver {
 target?:Element;active=true;
 constructor(readonly callback:IntersectionObserverCallback,readonly options:IntersectionObserverInit){observers.push(this);}
 observe(target:Element){this.target=target;}disconnect(){this.active=false;}unobserve(){this.active=false;}
 notify(intersecting=true){this.callback([{target:this.target,isIntersecting:intersecting}] as IntersectionObserverEntry[],this as unknown as IntersectionObserver);}
}
const current=()=>{const active=observers.filter(observer=>observer.active&&observer.target);return active[active.length-1]!;};
const cards=(container:ParentNode=document)=>container.querySelectorAll('.catalog-master-card');
async function tick(){await act(async()=>{const queued=[...frames.values()];frames.clear();queued.forEach(callback=>callback(0));});}
function mount(extra:Partial<React.ComponentProps<typeof CatalogSection>>={}){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter><CatalogSection {...props} {...extra}/></MemoryRouter></I18nProvider>);}
beforeEach(()=>{vi.clearAllMocks();observers.length=0;frames.clear();frameId=0;vi.stubGlobal('IntersectionObserver',FakeObserver);vi.stubGlobal('requestAnimationFrame',vi.fn((callback:FrameRequestCallback)=>{frames.set(++frameId,callback);return frameId;}));vi.stubGlobal('cancelAnimationFrame',vi.fn((id:number)=>frames.delete(id)));mocks.productCatalog.mockImplementation(async(index:number)=>page(rows(73),index));mocks.markedCatalog.mockImplementation(async(index:number)=>page(rows(49,'m'),index));mocks.publicAssignments.mockResolvedValue([]);});
afterEach(()=>{vi.unstubAllGlobals();});
it('automatically reveals one batch per settled observation and stops at the end without refetching',async()=>{
 mount();await screen.findByRole('heading',{name:'p0'});expect(cards()).toHaveLength(24);await waitFor(()=>expect(current()).toBeDefined());const observer=current();expect(observer.options.root).toBeNull();
 act(()=>{observer.notify();observer.notify();observer.notify();});expect(cards()).toHaveLength(24);await tick();expect(cards()).toHaveLength(48);expect(observer.active).toBe(false);
 act(()=>observer.notify());await tick();expect(cards()).toHaveLength(48);
 act(()=>current().notify());await tick();expect(cards()).toHaveLength(72);act(()=>current().notify());await tick();expect(cards()).toHaveLength(73);expect(new Set([...cards()].map(card=>card.getAttribute('data-product-id'))).size).toBe(73);expect(observers.every(observer=>!observer.active)).toBe(true);expect(screen.queryByRole('button',{name:/Load more/})).not.toBeInTheDocument();expect(mocks.productCatalog).toHaveBeenCalledTimes(4);
});
it('retains an accessible manual fallback when observers are unsupported',async()=>{
 vi.stubGlobal('IntersectionObserver',undefined);mount();await screen.findByRole('heading',{name:'p0'});const button=screen.getByRole('button',{name:/24\/73/});button.focus();fireEvent.click(button);expect(cards()).toHaveLength(48);expect(button).toHaveFocus();expect(screen.getByRole('status')).toHaveTextContent('48 of 73 products');expect(observers).toHaveLength(0);expect(mocks.productCatalog).toHaveBeenCalledTimes(4);
});
it('shares the synchronous guard between manual and automatic actions',async()=>{
 mount();await screen.findByRole('heading',{name:'p0'});const observer=current();act(()=>observer.notify());fireEvent.click(screen.getByRole('button',{name:/24\/73/}));await tick();expect(cards()).toHaveLength(48);fireEvent.click(screen.getByRole('button',{name:/48\/73/}));expect(cards()).toHaveLength(72);
});
it('cancels queued reveals while paused and safely observes again after resume',async()=>{
 const view=mount();await screen.findByRole('heading',{name:'p0'});const old=current();act(()=>old.notify());view.rerender(<I18nProvider><MemoryRouter><CatalogSection {...props} autoPaused/></MemoryRouter></I18nProvider>);act(()=>old.notify());await tick();expect(cards()).toHaveLength(24);expect(old.active).toBe(false);expect(screen.getByRole('button',{name:/24\/73/})).toBeDisabled();
 view.rerender(<I18nProvider><MemoryRouter><CatalogSection {...props}/></MemoryRouter></I18nProvider>);act(()=>current().notify());await tick();expect(cards()).toHaveLength(48);
});
it('pauses for its detail drawer without changing focus during later automatic reveal',async()=>{
 mount();await screen.findByRole('heading',{name:'p0'});const old=current();act(()=>old.notify());fireEvent.click(screen.getByRole('button',{name:'Product details: p0'}));await tick();expect(cards()).toHaveLength(24);expect(old.active).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Close'}));await waitFor(()=>expect(current()).not.toBe(old));const button=screen.getByRole('button',{name:/24\/73/});button.focus();act(()=>current().notify());await tick();expect(cards()).toHaveLength(48);expect(button).toHaveFocus();
});
it('resets category/search identities and rejects queued old notifications without new page requests',async()=>{
 const values=rows(73).map((row,i)=>({...row,categories:[{id:i<40?'a':'b',name:{'en-US':i<40?'Group A':'Group B'}}]}));mocks.productCatalog.mockImplementation(async(index:number)=>page(values,index));const view=mount();await screen.findByRole('heading',{name:'p0'});act(()=>current().notify());await tick();expect(cards()).toHaveLength(48);const old=current();act(()=>old.notify());fireEvent.click(screen.getByRole('button',{name:'Group A (40)'}));act(()=>old.notify());await tick();expect(cards()).toHaveLength(24);act(()=>current().notify());await tick();expect(cards()).toHaveLength(40);
 view.rerender(<I18nProvider><MemoryRouter><CatalogSection {...props} query="p7"/></MemoryRouter></I18nProvider>);expect(cards()).toHaveLength(1);expect(screen.getByRole('heading',{name:'p7'})).toBeInTheDocument();expect(mocks.productCatalog).toHaveBeenCalledTimes(4);
});
it('keeps marked and all section observation and visible counts independent',async()=>{
 localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><MemoryRouter><CatalogSection {...props} kind="marked"/><CatalogSection {...props}/></MemoryRouter></I18nProvider>);await screen.findByRole('heading',{name:'p0'});await screen.findByRole('heading',{name:'m0'});const all=document.querySelectorAll('.public-product-catalog')[1],marked=document.querySelectorAll('.public-product-catalog')[0];const observer=observers.find(value=>value.active&&value.target?.closest('section')===all)!;act(()=>observer.notify());await tick();expect(cards(all)).toHaveLength(48);expect(cards(marked)).toHaveLength(24);expect(mocks.markedCatalog).toHaveBeenCalledTimes(3);expect(mocks.productCatalog).toHaveBeenCalledTimes(4);
});
it('disconnects and ignores old node/catalog-marker responses and queued reveals after navigation',async()=>{
 let resolveMarkers!:(value:unknown)=>void;mocks.productCatalog.mockImplementation(async(index:number,node?:number)=>page(rows(node===2?49:73,node===2?'q':'p'),index));mocks.publicAssignments.mockImplementationOnce(()=>new Promise(done=>{resolveMarkers=done;})).mockResolvedValue([]);
 function Harness(){const navigate=useNavigate();return <><button onClick={()=>navigate('/products?node=2')}>Node 2</button><CatalogSection {...props}/></>;}
 localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><MemoryRouter initialEntries={['/products?node=1']}><Harness/></MemoryRouter></I18nProvider>);await waitFor(()=>expect(mocks.publicAssignments).toHaveBeenCalled());fireEvent.click(screen.getByRole('button',{name:'Node 2'}));await screen.findByRole('heading',{name:'q0'});await act(async()=>resolveMarkers([]));expect(screen.queryByRole('heading',{name:'p0'})).not.toBeInTheDocument();expect(cards()).toHaveLength(24);act(()=>current().notify());await tick();expect(cards()).toHaveLength(48);
});
it('invalidates an old observer and queued frame on save-triggered refresh',async()=>{
 const view=mount();await screen.findByRole('heading',{name:'p0'});act(()=>current().notify());await tick();const old=current();act(()=>old.notify());mocks.productCatalog.mockImplementation(async(index:number)=>page(rows(25,'updated'),index));view.rerender(<I18nProvider><MemoryRouter><CatalogSection {...props} refresh={1}/></MemoryRouter></I18nProvider>);await tick();await screen.findByRole('heading',{name:'updated0'});act(()=>old.notify());await tick();expect(cards()).toHaveLength(24);expect(screen.queryByRole('heading',{name:'p0'})).not.toBeInTheDocument();act(()=>current().notify());await tick();expect(cards()).toHaveLength(25);
});
it('does not automatically retry a failed traversal and preserves deliberate retry',async()=>{
 mocks.productCatalog.mockRejectedValue(new Error('offline'));mount();await screen.findByRole('alert');expect(observers).toHaveLength(0);await tick();expect(mocks.productCatalog).toHaveBeenCalledTimes(1);mocks.productCatalog.mockImplementation(async(index:number)=>page(rows(25),index));fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByRole('heading',{name:'p0'});act(()=>current().notify());await tick();expect(cards()).toHaveLength(25);expect(mocks.productCatalog).toHaveBeenCalledTimes(3);
});
it.each([0,1,24])('stops without observing short/empty catalog of %s rows',async count=>{
 mocks.productCatalog.mockImplementation(async(index:number)=>page(rows(count),index));mount();await waitFor(()=>expect(document.querySelector('.catalog-progress')).toBeNull());expect(cards()).toHaveLength(count);expect(observers).toHaveLength(0);expect(screen.queryByRole('button',{name:/Load more/})).not.toBeInTheDocument();
});
it('disconnects and cancels queued work on unmount',async()=>{
 const view=mount();await screen.findByRole('heading',{name:'p0'});const old=current();act(()=>old.notify());view.unmount();await tick();act(()=>old.notify());expect(old.active).toBe(false);expect(frames.size).toBe(0);expect(mocks.productCatalog).toHaveBeenCalledTimes(4);
});
it('pauses both sections synchronously when either section opens a detail drawer',async()=>{
 localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><MemoryRouter><PublicProductCatalog {...props}/></MemoryRouter></I18nProvider>);await screen.findByRole('heading',{name:'p0'});await screen.findByRole('heading',{name:'m0'});const live=observers.filter(observer=>observer.active);act(()=>live.forEach(observer=>observer.notify()));fireEvent.click(screen.getByRole('button',{name:'Product details: p0'}));await tick();const sections=document.querySelectorAll('.public-product-catalog');expect(cards(sections[0])).toHaveLength(24);expect(cards(sections[1])).toHaveLength(24);expect(live.every(observer=>!observer.active)).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Close'}));await waitFor(()=>expect(observers.filter(observer=>observer.active)).toHaveLength(2));
});
