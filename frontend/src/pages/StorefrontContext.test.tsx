import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import {CART_KEY} from '../cart';
import Storefront from './Storefront';
const mocks=vi.hoisted(()=>({trips:vi.fn(),products:vi.fn(),nodes:vi.fn(),privateTrips:vi.fn(),role:{user:{id:7,name:'Fixture',roles:['CUSTOMER']},isCustomer:true,isAuthenticated:true,logout:vi.fn()}}));
vi.mock('../api',()=>({api:{customerTrips:mocks.privateTrips},storefrontApi:{trips:mocks.trips,products:mocks.products},recommendationApi:{nodes:mocks.nodes}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>mocks.role}));
vi.mock('./PublicRecommendations',()=>({default:()=> <h1>Recommendations fixture</h1>}));
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({id,value,onChange,options,'aria-label':label}:{id:string;value:number;onChange:(id:number)=>void;options:{value:number;label:string}[];'aria-label':string})=><select id={id} aria-label={label} value={value} onChange={event=>onChange(Number(event.target.value))}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
beforeEach(()=>{
 localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.clearAllMocks();mocks.role.user={id:7,name:'Fixture',roles:['CUSTOMER']};
 mocks.trips.mockResolvedValue([{id:11,merchantId:1,merchantName:'Public A',deliveryArea:'A',deliveryDate:'2026-11-01'},{id:22,merchantId:2,merchantName:'Public B',deliveryArea:'B',deliveryDate:'2026-11-02'}]);
 mocks.products.mockResolvedValue([1,2].map(id=>({id:String(id),merchantId:id,name:{'en-US':'Product '+id},description:{},brand:'Fixture',images:['/fixture.png'],price:10,categoryId:''})));
 mocks.nodes.mockResolvedValue([]);mocks.privateTrips.mockResolvedValue([{id:33,agentId:3,status:'COMPLETED',deliveryArea:'Private',deliveryDate:'2026-10-01'}]);
});
function LocationProbe(){const location=useLocation(),navigate=useNavigate();return <><output data-testid="route">{location.pathname+location.search}</output><button onClick={()=>navigate(-1)}>History back</button><button onClick={()=>navigate(1)}>History forward</button></>;}
function startAt(path:string){return render(<I18nProvider><MemoryRouter initialEntries={[path]}><LocationProbe/><Storefront/></MemoryRouter></I18nProvider>);}
it('defaults a successfully loaded empty home to recommendations without trapping explicit trip browsing or history',async()=>{
 mocks.trips.mockResolvedValue([]);startAt('/?node=2');
 await screen.findByRole('heading',{name:'Recommendations fixture'});expect(screen.getByTestId('route')).toHaveTextContent('/recommendations?node=2');
 const shortcuts=screen.getByRole('navigation',{name:'Quick navigation'});
 fireEvent.click(shortcuts.querySelector('a[href="/products?node=2"]')!);
 await screen.findByRole('heading',{name:/^Trip finds/});expect(screen.getByTestId('route')).toHaveTextContent('/products?node=2');
 expect(shortcuts.querySelector('a[aria-current="page"]')).toHaveAttribute('href','/products?node=2');
 fireEvent.click(screen.getByRole('button',{name:'History back'}));await screen.findByRole('heading',{name:'Recommendations fixture'});
 fireEvent.click(screen.getByRole('button',{name:'History forward'}));await screen.findByRole('heading',{name:/^Trip finds/});
});
it('keeps an available trip home and only considers the selected node',async()=>{
 const view=startAt('/?node=2');await screen.findByRole('heading',{name:'Product 2'});expect(screen.getByTestId('route')).toHaveTextContent('/?node=2');view.unmount();
 startAt('/?node=999');await screen.findByRole('heading',{name:'Recommendations fixture'});expect(screen.getByTestId('route')).toHaveTextContent('/recommendations?node=999');
});
it.each(['/cart?node=2','/products?node=2','/recommendations/3?node=2&item=153'])('does not override explicit deep link %s without trips',async path=>{
 mocks.trips.mockResolvedValue([]);startAt(path);await waitFor(()=>expect(mocks.trips).toHaveBeenCalled());
 await waitFor(()=>expect(document.querySelector('.store-loading')).not.toBeInTheDocument());expect(screen.getByTestId('route').textContent).toBe(path);
});
it('does not mistake an unavailable trip service for no trips',async()=>{
 mocks.trips.mockRejectedValue(new Error('Trip service unavailable'));startAt('/');
 await screen.findByText('Trip service unavailable');expect(screen.getByTestId('route').textContent).toBe('/');expect(screen.queryByRole('heading',{name:'Recommendations fixture'})).not.toBeInTheDocument();
 fireEvent.click(document.querySelector('.store-main .ant-alert-close-icon')!);expect(screen.getByTestId('route').textContent).toBe('/');
});
it('chooses the URL node trip on refresh and preserves cart identity when selecting All',async()=>{
 render(<I18nProvider><MemoryRouter initialEntries={['/?node=2']}><Storefront/></MemoryRouter></I18nProvider>);
 await screen.findByRole('heading',{name:'Product 2'});expect(screen.queryByRole('heading',{name:'Product 1'})).not.toBeInTheDocument();
 await screen.findByRole('option',{name:'Node 3'});const prior=JSON.parse(localStorage.getItem(CART_KEY)!);expect(prior.tripId).toBe(22);
 fireEvent.change(screen.getByRole('combobox',{name:'Current node'}),{target:{value:'0'}});
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Current node'})).toHaveValue('0'));
 expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual(prior);
});
it('drops old private node choices immediately and ignores a late response after account change',async()=>{
 let resolveA!:(value:unknown)=>void;const first=new Promise(resolve=>{resolveA=resolve;});mocks.privateTrips.mockReturnValueOnce(first).mockResolvedValue([{id:44,agentId:4,status:'COMPLETED'}]);
 const contents=()=> <I18nProvider><MemoryRouter><Storefront/></MemoryRouter></I18nProvider>;
 const view=render(contents());await screen.findByRole('heading',{name:'Product 1'});mocks.role.user={...mocks.role.user,id:8};view.rerender(contents());
 await screen.findByRole('option',{name:'Node 4'});await act(async()=>resolveA([{id:33,agentId:3,status:'COMPLETED'}]));
 expect(screen.queryByRole('option',{name:'Node 3'})).not.toBeInTheDocument();expect(screen.getByRole('option',{name:'Node 4'})).toBeInTheDocument();
});
it('requires an explicit cart refresh even when an unchanged regular revision has a new effective-price token',async()=>{
 mocks.products.mockResolvedValue([{id:'1',merchantId:1,name:{'en-US':'Product 1'},description:{},brand:'Fixture',images:[],price:12,currency:'JPY',priceRevision:0,priceToken:'new-effective-token',categoryId:''}]);
 localStorage.setItem(CART_KEY,JSON.stringify({tripId:11,requestId:crypto.randomUUID(),items:{'1':2},currency:'JPY',quotes:{'1':{price:10,currency:'JPY',revision:0,token:'old-token'}}}));
 render(<I18nProvider><MemoryRouter initialEntries={['/cart?node=1']}><Storefront/></MemoryRouter></I18nProvider>);
 const refresh=await screen.findByRole('button',{name:'Review and update cart prices'});expect(JSON.parse(localStorage.getItem(CART_KEY)!).quotes['1'].price).toBe(10);
 fireEvent.click(refresh);await waitFor(()=>expect(JSON.parse(localStorage.getItem(CART_KEY)!).quotes['1']).toMatchObject({price:12,token:'new-effective-token'}));
});
