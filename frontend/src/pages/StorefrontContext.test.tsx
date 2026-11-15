import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {I18nProvider,translate} from '../i18n';
import {cartStorageKey,commitDraft,readDraft} from '../cart';
import {installCartLocks} from '../test/cartLock';
import Storefront from './Storefront';
import type {StoreProduct} from '../api';
import {ReadRequestError} from '../readRecovery';
import {storefrontFeatures} from '../storefrontFeatures';
const mocks=vi.hoisted(()=>({trips:vi.fn(),activeTrips:vi.fn(),products:vi.fn(),productSales:vi.fn(),nodes:vi.fn(),privateTrips:vi.fn(),catalogProps:vi.fn(),role:{user:{id:7,name:'Fixture',roles:['CUSTOMER']},isCustomer:true,isAuthenticated:true,loading:false,logout:vi.fn()}}));
vi.mock('../api',()=>({api:{customerTrips:mocks.privateTrips},storefrontApi:mocks,recommendationApi:mocks}));
vi.mock('../storefrontFeatures',()=>({storefrontFeatures:{trips:true,dealsBulletin:true}}));vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>mocks.role}));
vi.mock('./PublicRecommendations',()=>({default:({purchasePending}:{purchasePending:boolean})=><><h1>Recommendations fixture</h1><output data-testid="eligibility">{String(purchasePending)}</output></>}));
vi.mock('./PublicProductCatalog',()=>({default:(props:{merchantId?:number;purchasePending:boolean;onAdd:(product:StoreProduct)=>void;canBuy:(product:StoreProduct)=>boolean})=>{mocks.catalogProps(props);return <><h1>Catalog fixture</h1><output data-testid="scope">{props.merchantId??'all'}</output><output data-testid="eligibility">{String(props.purchasePending)}</output></>;}}));
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({id,value,onChange,options,'aria-label':label}:{id:string;value:number;onChange:(id:number)=>void;options:{value:number;label:string}[];'aria-label':string})=><select id={id} aria-label={label} value={value} onChange={event=>onChange(Number(event.target.value))}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
beforeEach(()=>{installCartLocks();vi.clearAllMocks();localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');mocks.trips.mockResolvedValue([{id:11,merchantId:1,merchantName:'Shop',deliveryArea:'Area',deliveryDate:'2026-11-10'}]);mocks.activeTrips.mockImplementation(()=>mocks.trips());mocks.nodes.mockResolvedValue([]);mocks.privateTrips.mockResolvedValue([{agentId:4}]);mocks.productSales.mockResolvedValue([]);});
it('recovers only failed trip metadata after foreground events and preserves the current route and cart',async()=>{
 mocks.activeTrips.mockRejectedValueOnce(new ReadRequestError('metadata offline',true)).mockResolvedValue([]);mount('/products?node=1');await screen.findByText('metadata offline');const before=readDraft('user:7').cart;
 const tripCalls=mocks.trips.mock.calls.length;act(()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));});await waitFor(()=>expect(mocks.activeTrips).toHaveBeenCalledTimes(2));await waitFor(()=>expect(screen.queryByText('metadata offline')).not.toBeInTheDocument());expect(mocks.trips).toHaveBeenCalledTimes(tripCalls);expect(readDraft('user:7').cart).toEqual(before);expect(screen.getByTestId('route').textContent).toBe('/products?node=1');
});
function Probe(){const location=useLocation(),navigate=useNavigate();return <><output data-testid="route">{location.pathname+location.search}</output><button onClick={()=>navigate(-1)}>Back</button><button onClick={()=>navigate(1)}>Forward</button></>;}
function mount(path:string){return render(<I18nProvider><MemoryRouter initialEntries={[path]}><Probe/><Storefront/></MemoryRouter></I18nProvider>);}
it('keeps the home-linked brand in a separate header container while the remembered menu opens and closes',async()=>{
 localStorage.setItem('bobbuy_store_navigation_desktop','expanded');
 const view=mount('/products?node=1');
 const brandHeader=view.container.querySelector('.store-brand-header')!;
 const brand=brandHeader.querySelector<HTMLAnchorElement>('.browse-header-brand')!;
 expect(brand).toHaveAttribute('href','/?node=1');
 expect(brand.querySelector('.brand-lockup')).toBeVisible();
 await waitFor(()=>expect(document.querySelector('.browse-drawer .browse-links')).toBeInTheDocument());
 expect(document.querySelector('.browse-drawer .brand-lockup')).toBeNull();
 expect(brandHeader.contains(document.querySelector('.browse-drawer'))).toBe(false);
 fireEvent.click(screen.getByRole('button',{name:'Collapse navigation menu'}));
 await waitFor(()=>expect(document.querySelector('.browse-drawer .browse-links')).not.toBeInTheDocument());
 expect(brand.querySelector('.brand-lockup')).toBeVisible();
 expect(localStorage.getItem('bobbuy_store_navigation_desktop')).toBe('collapsed');
});
it('hides the whole trip page after retry exhaustion and recovers the failed read on reconnect',async()=>{
 mocks.activeTrips.mockResolvedValue([]);mocks.trips.mockRejectedValueOnce(new ReadRequestError('trip read failed',true)).mockResolvedValue([{id:11,merchantId:1,merchantName:'Shop',deliveryArea:'Recovered area',deliveryDate:'2026-11-10'}]);
 const view=mount('/trips');await waitFor(()=>expect(mocks.trips).toHaveBeenCalledTimes(1));
 expect(view.container.querySelector('.ant-spin')).toBeNull();
 expect(view.container.querySelector('.browse-trip-page')).toBeNull();expect(view.container.querySelector('.ant-empty')).toBeNull();
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Retry'})).not.toBeInTheDocument();
 expect(mocks.trips).toHaveBeenCalledTimes(1);
 act(()=>window.dispatchEvent(new Event('online')));
 await screen.findByRole('heading',{name:'Recovered area'});
 expect(view.container.querySelector('.ant-spin')).toBeNull();expect(mocks.trips).toHaveBeenCalledTimes(2);
 expect(screen.queryByText('trip read failed')).not.toBeInTheDocument();
});
it('keeps pending reads loading until retries settle and preserves real business errors',async()=>{
 let fail!:(error:Error)=>void;mocks.activeTrips.mockResolvedValue([]);mocks.trips.mockImplementation(()=>new Promise((_resolve,reject)=>{fail=reject;}));
 const view=mount('/trips');expect(view.container.querySelector('.ant-spin')).not.toBeNull();expect(view.container.querySelector('.ant-empty')).toBeNull();
 await act(async()=>fail(new Error('access denied')));
 await screen.findByText('access denied');expect(view.container.querySelector('.ant-spin')).toBeNull();expect(view.container.querySelector('.ant-empty')).toBeNull();
});
it('shows the bookable spinner only while its read is pending, independently of active trips',async()=>{
 let finish!:(value:unknown)=>void;mocks.trips.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));mocks.activeTrips.mockResolvedValue([]);
 const view=mount('/trips');expect(view.container.querySelector('.ant-spin')).not.toBeNull();
 await act(async()=>{});expect(view.container.querySelector('.ant-spin')).not.toBeNull();
 await act(async()=>finish([]));await waitFor(()=>expect(view.container.querySelector('.ant-spin')).toBeNull());
 expect(view.container.querySelector('.browse-trip-page')).toBeNull();expect(view.container.querySelector('.ant-empty')).toBeNull();
});
it.each(['','?node=7&query=milk&source=email','?query=milk%20tea&source=email&source=share'])('preserves the full home query string when redirecting to recommendations: %s',async search=>{
 mount('/'+search);
 await screen.findByRole('heading',{name:'Recommendations fixture'});
 expect(screen.getByTestId('route').textContent).toBe('/recommendations'+search);
});
it.each(['zh-CN','zh-TW','en-US','ja-JP'] as const)('lands / on the hidden newsletter route and keeps the sole account entry in the header in %s',async locale=>{
 const features=storefrontFeatures as {trips:boolean;dealsBulletin:boolean};features.dealsBulletin=false;
 try {localStorage.setItem('bobbuy_locale',locale);mocks.trips.mockImplementation(()=>new Promise(()=>{}));mocks.activeTrips.mockImplementation(()=>new Promise(()=>{}));const view=mount('/?node=7');await screen.findByRole('heading',{name:'Recommendations fixture'});expect(screen.getByTestId('route')).toHaveTextContent('/recommendations?node=7');const account=screen.getByRole('link',{name:translate(locale,'store.account')});expect(account).toHaveAttribute('href','/account?node=7');expect(view.container.querySelector('.store-header-actions')?.contains(account)).toBe(true);expect(view.container.querySelector('.browse-mobile-shortcuts')?.contains(account)).toBe(false);}
 finally {features.dealsBulletin=true;}
});
it('keeps direct newsletter URLs available while the newsletter navigation flag is off',async()=>{
 const features=storefrontFeatures as {trips:boolean;dealsBulletin:boolean};features.dealsBulletin=false;
 try {mount('/recommendations');await screen.findByRole('heading',{name:'Recommendations fixture'});expect(screen.getByTestId('route')).toHaveTextContent('/recommendations');expect(screen.queryByRole('link',{name:'Campaign Newsletter'})).not.toBeInTheDocument();}
 finally {features.dealsBulletin=true;}
});
function selected(path:string){
 const mobile=document.querySelector('.browse-mobile-shortcuts a[aria-current="page"]');
 if(path.startsWith('/products'))expect(mobile).toHaveAttribute('href',path);
 else expect(mobile).toBeNull();
}
it.each(['/products','/recommendations','/trips'])('keeps identity, node scope and cart while opening hidden-selector navigation on %s',async path=>{
 const cart={tripId:11,requestId:crypto.randomUUID(),items:{p:2},currency:'JPY',quotes:{p:{price:10,currency:'JPY',revision:1,token:'existing'}}};
 commitDraft('user:7','',cart);const before=readDraft('user:7');const identity=structuredClone(mocks.role.user);
 mount(path+'?node=1');await waitFor(()=>expect(mocks.nodes).toHaveBeenCalled());
 fireEvent.click(screen.getByRole('button',{name:'Open navigation menu'}));
 await waitFor(()=>expect(document.querySelector('.browse-drawer .ant-drawer-body')).toBeInTheDocument());
 expect(screen.queryByRole('combobox',{hidden:true})).not.toBeInTheDocument();
 expect(document.querySelector('.browse-node')).toBeNull();
 expect(screen.getByTestId('route').textContent).toBe(path+'?node=1');
 expect(readDraft('user:7')).toEqual(before);expect(mocks.role.user).toEqual(identity);
 fireEvent.click(document.querySelector('.ant-drawer-close')!);
 expect(readDraft('user:7')).toEqual(before);expect(screen.getByTestId('route').textContent).toBe(path+'?node=1');
 expect(screen.queryByText('Change merchant')).not.toBeInTheDocument();
});
it.each(['/products','/recommendations','/recommendations/99?item=900'])('renders direct route %s without waiting for metadata or full products',async path=>{mocks.trips.mockImplementation(()=>new Promise(()=>{}));mocks.activeTrips.mockImplementation(()=>new Promise(()=>{}));mount(path);await screen.findByRole('heading',{name:path.startsWith('/products')?'Catalog fixture':'Recommendations fixture'});expect(mocks.products).not.toHaveBeenCalled();expect(mocks.nodes).not.toHaveBeenCalled();expect(mocks.privateTrips).not.toHaveBeenCalled();expect(screen.getByTestId('eligibility')).toHaveTextContent('true');expect(screen.getByTestId('route').textContent).toBe(path);});
it('fetches node and private-trip metadata only when navigation is opened',async()=>{mount('/products');await screen.findByRole('heading',{name:'Catalog fixture'});expect(mocks.nodes).not.toHaveBeenCalled();expect(mocks.privateTrips).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Open navigation menu'}));await waitFor(()=>expect(mocks.nodes).toHaveBeenCalledTimes(1));await waitFor(()=>expect(mocks.privateTrips).toHaveBeenCalledTimes(1));});
it('resolves an explicitly selected recommendation-only node without opening navigation',async()=>{mocks.trips.mockResolvedValue([]);mocks.activeTrips.mockResolvedValue([]);mocks.nodes.mockResolvedValue([{id:7,name:'Current B'}]);const view=mount('/recommendations?node=7');await waitFor(()=>expect(view.container.querySelector('.browse-context-node')).toHaveTextContent('Current B'));expect(mocks.nodes).toHaveBeenCalledTimes(1);});
it('does not let late trip metadata overwrite the authoritative current public name',async()=>{let finish!:(value:unknown)=>void;mocks.trips.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));mocks.activeTrips.mockResolvedValue([]);mocks.nodes.mockResolvedValue([{id:7,name:'Current B'}]);const view=mount('/trips?node=7');await waitFor(()=>expect(view.container.querySelector('.browse-context-node')).toHaveTextContent('Current B'));await act(async()=>finish([{id:11,merchantId:7,merchantName:'Old A',deliveryArea:'Area',deliveryDate:'2026-11-10'}]));expect(view.container.querySelector('.browse-context-node')).toHaveTextContent('Current B');expect(view.container.querySelector('.browse-trip-card')).toHaveTextContent('Current B');expect(view.container.querySelector('.browse-trip-card')).not.toHaveTextContent('Old A');});
it('preserves stored cart quotes and requires explicit price review after the bounded quote response',async()=>{commitDraft('user:7','',{tripId:11,requestId:crypto.randomUUID(),items:{p:2},currency:'JPY',quotes:{p:{price:10,currency:'JPY',revision:1,token:'old'}}});mocks.productSales.mockResolvedValue([{id:'p',merchantId:1,name:{'en-US':'Product'},description:{},brand:'',price:12,currency:'JPY',categoryId:'',images:[],priceRevision:2,priceToken:'new'}]);mount('/cart');const review=await screen.findByRole('button',{name:'Review and update cart prices'});await waitFor(()=>expect(review).toBeEnabled());expect(mocks.productSales).toHaveBeenCalledWith(['p']);expect(readDraft('user:7').cart.quotes!.p.price).toBe(10);fireEvent.click(review);await waitFor(()=>expect(readDraft('user:7').cart.quotes!.p.price).toBe(12));expect(mocks.products).not.toHaveBeenCalled();});
it('restores explicit links and menu state with browser back/forward',async()=>{mocks.activeTrips.mockResolvedValue([]);mount('/?node=1');await screen.findByRole('heading',{name:'Recommendations fixture'});fireEvent.click(document.querySelector('.browse-mobile-shortcuts a[href="/products?node=1"]')!);await screen.findByRole('heading',{name:'Catalog fixture'});selected('/products?node=1');fireEvent.click(screen.getByRole('button',{name:'Back'}));await screen.findByRole('heading',{name:'Recommendations fixture'});selected('/recommendations?node=1');fireEvent.click(screen.getByRole('button',{name:'Forward'}));await screen.findByRole('heading',{name:'Catalog fixture'});selected('/products?node=1');});

it('allows eligible catalog purchases without an active trip on /products',async()=>{
 const features=storefrontFeatures as {trips:boolean;dealsBulletin:boolean};
 features.dealsBulletin=false;
 try {
  mocks.activeTrips.mockResolvedValue([]);mount('/products');
  await screen.findByRole('heading',{name:'Catalog fixture'});
  const quote:StoreProduct={id:'p',merchantId:1,name:{'en-US':'Product'},description:{},brand:'',price:120,currency:'JPY',categoryId:'',images:[],recommendationReady:true};
  const latest=()=>mocks.catalogProps.mock.calls.slice(-1)[0][0];
  await waitFor(()=>expect(latest().canBuy(quote)).toBe(true));
  expect(latest().canBuy({...quote,merchantId:99})).toBe(false);
  expect(latest().canBuy({...quote,price:NaN})).toBe(false);
  expect(latest().canBuy({...quote,recommendationReady:false})).toBe(false);
  await waitFor(()=>expect(readDraft('user:7').cart.tripId).toBe(11));
  act(()=>latest().onAdd(quote));
  await waitFor(()=>expect(readDraft('user:7').cart.items.p).toBe(1));
 } finally {features.dealsBulletin=true;}
});
