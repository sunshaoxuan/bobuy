import{act,fireEvent,render,screen,waitFor}from'@testing-library/react';
import{MemoryRouter}from'react-router-dom';
import{I18nProvider}from'../i18n';
import{cartStorageKey,commitDraft,emptyCart,readDraft}from'../cart';
import{installCartLocks}from'../test/cartLock';
import Storefront from'./Storefront';
const mocks=vi.hoisted(()=>({checkout:vi.fn(),profile:vi.fn(),saveProfile:vi.fn(),productSales:vi.fn(),trips:vi.fn(),activeTrips:vi.fn(),role:{user:{id:7,name:'A',email:'a@example.com',roles:['CUSTOMER']},isCustomer:true,isAuthenticated:true,loading:false,logout:vi.fn()}}));
vi.mock('../api',()=>({api:{customerTrips:vi.fn()},recommendationApi:{nodes:vi.fn().mockResolvedValue([])},storefrontApi:mocks}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>mocks.role}));
// Same narrow Select adapter as StorefrontContext: JSDOM cannot parse AntD's selector.
// Address Form, buttons, Storefront/cart hooks and all checkout assertions remain real.
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return{...actual,Select:({id,value,onChange,options,'aria-label':label}:{id:string;value:number;onChange:(id:number)=>void;options:{value:number;label:string}[];'aria-label':string})=><select id={id} aria-label={label} value={value} onChange={event=>onChange(Number(event.target.value))}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
const address={contactName:'Buyer',countryRegion:'Japan',city:'Tokyo',addressLine:'Street'};
const product={id:'p',merchantId:1,name:{'en-US':'Product'},description:{},brand:'',price:12,currency:'JPY',categoryId:'',images:[],priceRevision:1,priceToken:'q1'};
function seed(id=7,qty=2){const prior=readDraft('user:'+id);commitDraft('user:'+id,prior.revision,{...emptyCart(),tripId:11,items:{p:qty},quotes:{p:{price:12,currency:'JPY',revision:1,token:'q1'}}});}
function tree(){return<I18nProvider><MemoryRouter initialEntries={['/checkout']}><Storefront/></MemoryRouter></I18nProvider>;}
const submit=()=>screen.getByRole('button',{name:/^Submit order/});
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();installCartLocks();localStorage.setItem('bobbuy_locale','en-US');mocks.role.user={id:7,name:'A',email:'a@example.com',roles:['CUSTOMER']};mocks.role.loading=false;mocks.role.isAuthenticated=true;
 mocks.trips.mockResolvedValue([{id:11,merchantId:1,merchantName:'Shop',deliveryArea:'Area',deliveryDate:'2026-11-10'}]);mocks.activeTrips.mockResolvedValue([]);mocks.productSales.mockResolvedValue([product]);mocks.profile.mockImplementation(async()=>({id:mocks.role.user.id,defaultAddress:address}));mocks.saveProfile.mockImplementation(async(body)=>({id:mocks.role.user.id,defaultAddress:body.defaultAddress}));seed();
});
it('synchronously blocks double submit and retries an uncertain result with the identical key and payload',async()=>{
 let reject!:(error:Error)=>void;mocks.checkout.mockImplementationOnce(()=>new Promise((_ok,no)=>{reject=no;})).mockResolvedValue({orderId:99,total:24,currency:'JPY'});
 render(tree());await waitFor(()=>expect(submit()).toBeEnabled());const button=submit();act(()=>{fireEvent.click(button);fireEvent.click(button);});await waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(1));
 const first=structuredClone(mocks.checkout.mock.calls[0][0]);await act(async()=>reject(Error('Network uncertain')));await screen.findByText('Network uncertain');expect(readDraft('user:7').cart.requestId).toBe(first.requestId);
 await waitFor(()=>expect(submit()).toBeEnabled());fireEvent.click(submit());await waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(2));expect(mocks.checkout.mock.calls[1][0]).toEqual(first);await screen.findByText(/Order #99/);expect(readDraft('user:7').cart.items).toEqual({});
});
it('does not clear edits added while an earlier selection is submitting',async()=>{
 let finish!:(value:unknown)=>void;mocks.checkout.mockImplementation(()=>new Promise(ok=>{finish=ok;}));render(tree());await waitFor(()=>expect(submit()).toBeEnabled());const key=readDraft('user:7').cart.requestId;fireEvent.click(submit());await waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByRole('button',{name:'Increase Product'}));await waitFor(()=>expect(readDraft('user:7').cart.items.p).toBe(3));expect(readDraft('user:7').cart.requestId).not.toBe(key);
 await act(async()=>finish({orderId:99,total:24,currency:'JPY'}));await screen.findByText('Your earlier selection was submitted. Your current cart has been kept.');expect(readDraft('user:7').cart.items.p).toBe(3);
});
it('ignores A late success after switch to B and leaves both drafts private and intact',async()=>{
 let finish!:(value:unknown)=>void;mocks.checkout.mockImplementation(()=>new Promise(ok=>{finish=ok;}));seed(8,5);const view=render(tree());await waitFor(()=>expect(submit()).toBeEnabled());fireEvent.click(submit());await waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(1));
 mocks.role.user={id:8,name:'B',email:'b@example.com',roles:['CUSTOMER']};view.rerender(tree());await waitFor(()=>expect(screen.getByLabelText('Quantity for Product')).toHaveTextContent('5'));
 await act(async()=>finish({orderId:99,total:24,currency:'JPY'}));expect(screen.queryByText(/Order #99/)).not.toBeInTheDocument();expect(readDraft('user:7').cart.items.p).toBe(2);expect(readDraft('user:8').cart.items.p).toBe(5);
});
it('rejects a cross-tab draft change before sending and offers explicit recovery',async()=>{
 render(tree());await waitFor(()=>expect(submit()).toBeEnabled());seed(7,8);fireEvent.click(submit());await screen.findByText(/This cart changed in another tab/);expect(mocks.checkout).not.toHaveBeenCalled();expect(readDraft('user:7').cart.items.p).toBe(8);
 fireEvent.click(screen.getByRole('button',{name:'Use saved cart'}));await waitFor(()=>expect(screen.getByLabelText('Quantity for Product')).toHaveTextContent('8'));
});
it('completes only required delivery fields inline, keeps cart, and waits for a successful profile save',async()=>{
 mocks.profile.mockResolvedValue({id:7,defaultAddress:null});render(tree());await screen.findByLabelText('Contact name');expect(submit()).toBeDisabled();const key=readDraft('user:7').cart.requestId;
 for(const[label,value]of [['Contact name','Buyer'],['Country or region','Japan'],['City','Tokyo'],['Street address','Street']])fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Save address and return to order'}));await waitFor(()=>expect(submit()).toBeEnabled());expect(mocks.saveProfile).toHaveBeenCalledWith({defaultAddress:{...address,phone:null,postalCode:null}});expect(readDraft('user:7').cart.requestId).toBe(key);expect(localStorage.getItem(cartStorageKey('user:7'))).not.toContain('Tokyo');
});
it('failed delivery save keeps cart and cannot submit an order',async()=>{
 mocks.profile.mockResolvedValue({id:7,defaultAddress:address});mocks.saveProfile.mockRejectedValue(Error('Save failed'));render(tree());await waitFor(()=>expect(submit()).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Delivery address (optional)'}));fireEvent.click(screen.getByRole('button',{name:'Save address and return to order'}));await screen.findByText('Save failed');expect(submit()).toBeDisabled();expect(readDraft('user:7').cart.items.p).toBe(2);expect(mocks.checkout).not.toHaveBeenCalled();
});
it('requires explicit price review rather than repricing during quantity adjustment',async()=>{
 mocks.productSales.mockResolvedValue([{...product,price:15,priceRevision:2,priceToken:'q2'}]);render(tree());await screen.findByRole('button',{name:'Review and update cart prices'});
 const key=readDraft('user:7').cart.requestId;fireEvent.click(screen.getByRole('button',{name:'Increase Product'}));await waitFor(()=>expect(readDraft('user:7').cart.items.p).toBe(2));expect(readDraft('user:7').cart.quotes!.p.price).toBe(12);expect(readDraft('user:7').cart.requestId).toBe(key);
 fireEvent.click(screen.getByRole('button',{name:'Review and update cart prices'}));await waitFor(()=>expect(readDraft('user:7').cart.quotes!.p.price).toBe(15));expect(readDraft('user:7').cart.requestId).not.toBe(key);expect(mocks.checkout).not.toHaveBeenCalled();
});
it('ignores late checkout response after unmount',async()=>{
 let finish!:(value:unknown)=>void;mocks.checkout.mockImplementation(()=>new Promise(ok=>{finish=ok;}));const view=render(tree());await waitFor(()=>expect(submit()).toBeEnabled());fireEvent.click(submit());await waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(1));view.unmount();await act(async()=>finish({orderId:99,total:24,currency:'JPY'}));expect(readDraft('user:7').cart.items.p).toBe(2);
});
it('does not accept a response after token rotation even before the auth rerender',async()=>{
 localStorage.setItem('bobbuy_access_token','test-old');let finish!:(value:unknown)=>void;mocks.checkout.mockImplementation(()=>new Promise(ok=>{finish=ok;}));render(tree());await waitFor(()=>expect(submit()).toBeEnabled());fireEvent.click(submit());await waitFor(()=>expect(mocks.checkout).toHaveBeenCalledTimes(1));
 localStorage.setItem('bobbuy_access_token','test-new');await act(async()=>finish({orderId:99,total:24,currency:'JPY'}));expect(readDraft('user:7').cart.items.p).toBe(2);expect(screen.queryByText(/Order #99/)).not.toBeInTheDocument();
});
it.each([['en-US','Keep account cart'],['zh-CN','保留账号购物车'],['zh-TW','保留帳號購物車'],['ja-JP','アカウントのカートを残す']])('offers the explicit guest/account choice in %s without an automatic merge',async(locale,keep)=>{
 localStorage.setItem('bobbuy_locale',locale);commitDraft('guest','',{...readDraft('user:7').cart,items:{p:3}});render(tree());const choice=await screen.findByRole('button',{name:keep});expect(readDraft('user:7').cart.items.p).toBe(2);fireEvent.click(choice);await waitFor(()=>expect(screen.queryByRole('button',{name:keep})).not.toBeInTheDocument());expect(readDraft('user:7').cart.items.p).toBe(2);expect(readDraft('guest').cart.items.p).toBe(3);expect(mocks.checkout).not.toHaveBeenCalled();
});
