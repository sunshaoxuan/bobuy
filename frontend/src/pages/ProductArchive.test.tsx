import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Route,Routes,useLocation,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import ProductArchive from './ProductArchive';
import LegacyProductRoute from '../components/LegacyProductRoute';
const state=vi.hoisted(()=>({admin:true,merchant:true,deleted:vi.fn()}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({isMerchant:state.merchant,user:{platformAdmin:state.admin}})}));
vi.mock('./StockMaster',()=>({default:()=> <input aria-label="Synthetic product edit" defaultValue="retained"/>}));
vi.mock('./DeletedProducts',()=>({default:()=>{state.deleted();return <p>Private deleted fixture</p>;}}));
function Position(){const p=useLocation(),navigate=useNavigate();return <><output aria-label="URL">{p.pathname+p.search+p.hash}</output><button onClick={()=>navigate(-1)}>Back</button></>;}
function open(path='/admin/products'){return render(<I18nProvider><MemoryRouter initialEntries={[path]}><Position/><Routes><Route path="/admin/products" element={<ProductArchive/>}/><Route path="/admin/stock-master" element={<LegacyProductRoute/>}/><Route path="/admin/deleted-products" element={<LegacyProductRoute deleted/>}/></Routes></MemoryRouter></I18nProvider>);}
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');state.admin=true;state.merchant=true;state.deleted.mockClear();});
it('uses one workspace and URL status while retaining active editor state and back navigation',async()=>{
 open();expect(screen.getByRole('heading',{name:'Product records'})).toBeVisible();fireEvent.change(screen.getByLabelText('Synthetic product edit'),{target:{value:'unsaved view state'}});
 fireEvent.click(screen.getByRole('tab',{name:'Deleted products'}));expect(await screen.findByText('Private deleted fixture')).toBeVisible();expect(screen.getByLabelText('URL')).toHaveTextContent('/admin/products?view=deleted');
 fireEvent.click(screen.getByRole('button',{name:'Back'}));await waitFor(()=>expect(screen.getByRole('tab',{name:'Active products'})).toHaveAttribute('aria-selected','true'));expect(screen.getByLabelText('Synthetic product edit')).toHaveValue('unsaved view state');
});
it('opens a refresh/deep link in the deleted status view',()=>{open('/admin/products?view=deleted');expect(screen.getByRole('tab',{name:'Deleted products'})).toHaveAttribute('aria-selected','true');expect(screen.getByText('Private deleted fixture')).toBeVisible();});
it('never mounts deleted data for a merchant even with a forged status URL',()=>{state.admin=false;open('/admin/products?view=deleted');expect(screen.queryByRole('tab',{name:'Deleted products'})).not.toBeInTheDocument();expect(screen.getByText('Platform administrator access required.')).toBeVisible();expect(state.deleted).not.toHaveBeenCalled();});
it.each([['/admin/stock-master?product=synthetic#editor','/admin/products?product=synthetic#editor'],['/admin/deleted-products?search=synthetic','/admin/products?search=synthetic&view=deleted']])('preserves old deep link %s',async(from,to)=>{open(from);await waitFor(()=>expect(screen.getByLabelText('URL')).toHaveTextContent(to));});
