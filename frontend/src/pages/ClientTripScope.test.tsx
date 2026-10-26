import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import ClientOrders from './ClientOrders';
import ClientTrips from './ClientTrips';
const mocks=vi.hoisted(()=>({trips:vi.fn(),orders:vi.fn(),role:{isAuthenticated:true,isCustomer:true,user:{id:7}}}));
vi.mock('../api',()=>({api:{customerTrips:mocks.trips,customerOrders:mocks.orders}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>mocks.role}));
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({value,onChange,options}:{value:number;onChange:(id:number)=>void;options:{value:number;label:string}[]})=><select value={value} onChange={event=>onChange(Number(event.target.value))}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
const trips=[{id:11,agentId:1,deliveryArea:'Node A started',deliveryDate:'2026-10-26',status:'IN_PROGRESS'},{id:12,agentId:1,deliveryArea:'Node A done',deliveryDate:'2026-10-25',status:'COMPLETED'},{id:21,agentId:2,deliveryArea:'Node B done',deliveryDate:'2026-10-24',status:'SETTLED'},{id:22,agentId:2,deliveryArea:'Node B upcoming',deliveryDate:'2026-11-01',status:'PUBLISHED'}];
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');vi.clearAllMocks();mocks.role.isAuthenticated=true;mocks.role.isCustomer=true;mocks.trips.mockResolvedValue(trips);});
it('shows only authorized executed statuses for the selected node and never fetches anonymously',async()=>{
 const view=render(<I18nProvider><MemoryRouter><ClientTrips node={2}/></MemoryRouter></I18nProvider>);
 await screen.findByRole('heading',{name:'Node B done'});expect(screen.queryByText('Node A done')).not.toBeInTheDocument();expect(screen.queryByText('Node B upcoming')).not.toBeInTheDocument();view.unmount();
 mocks.role.isAuthenticated=false;mocks.role.isCustomer=false;mocks.trips.mockClear();render(<I18nProvider><MemoryRouter><ClientTrips node={2}/></MemoryRouter></I18nProvider>);
 await screen.findByText('Sign in to view executed trips');expect(mocks.trips).not.toHaveBeenCalled();
});
it('ignores an old trip response after a newer selection and never requests a different node',async()=>{
 let resolveFirst!:(value:unknown)=>void;const first=new Promise(resolve=>{resolveFirst=resolve;});
 mocks.orders.mockImplementation(id=>id===11?first:Promise.resolve([{id:1200,tripId:12,businessId:'New order',status:'CONFIRMED',totalAmount:20,lines:[]}]));
 render(<I18nProvider><ClientOrders node={1}/></I18nProvider>);
 await screen.findByRole('option',{name:/Node A done/});fireEvent.change(screen.getByRole('combobox'),{target:{value:'12'}});
 await screen.findByText('#1200');await act(async()=>resolveFirst([{id:1100,tripId:11,businessId:'Stale order',status:'CONFIRMED',totalAmount:10,lines:[]}]));
 expect(screen.queryByText('#1100')).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:/Node B/})).not.toBeInTheDocument();
 await waitFor(()=>expect(mocks.orders).toHaveBeenLastCalledWith(12));expect(mocks.orders).not.toHaveBeenCalledWith(21);
});
