import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import App from '../App';

const state=vi.hoisted(()=>({authenticated:true,merchant:true,currencies:vi.fn()}));
vi.mock('../api',()=>({masterDataApi:{currencies:state.currencies}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({isAuthenticated:state.authenticated,isMerchant:state.merchant,user:{name:'Synthetic merchant',platformAdmin:false},logout:vi.fn()})}));
vi.mock('../pages/Storefront',()=>({default:()=> <h1>Customer storefront</h1>}));
vi.mock('../pages/LoginPage',()=>({default:()=> <h1>Sign in required</h1>}));
const rows=[{code:'JPY',symbol:'¥',fractionDigits:0,name:'JPY',saleEnabled:true},{code:'USD',symbol:'$',fractionDigits:2,name:'USD',saleEnabled:false}];
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');state.authenticated=true;state.merchant=true;state.currencies.mockReset();state.currencies.mockResolvedValue(rows);});
function show(path='/admin/basic-data/currencies'){return render(<I18nProvider><MemoryRouter initialEntries={[path]}><App/></MemoryRouter></I18nProvider>);}
it('serves the shared read-only directory on direct and compatibility routes in Basic data',async()=>{
 show('/admin/currencies');expect(await screen.findByRole('heading',{name:'Currencies'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Currencies'})).toHaveAttribute('href','/admin/basic-data/currencies');
 expect(screen.getAllByText('Basic data').length).toBeGreaterThanOrEqual(2);
 expect(screen.getByText('JPY')).toBeInTheDocument();expect(screen.getByText('USD')).toBeInTheDocument();
 expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
 const reload=screen.getByRole('button',{name:/Reload/});await waitFor(()=>expect(reload).not.toHaveClass('ant-btn-loading'));
 fireEvent.click(reload);await waitFor(()=>expect(state.currencies).toHaveBeenCalledTimes(2));
});
it.each(['anonymous','customer'])('does not load the merchant directory for %s',async role=>{
 state.authenticated=role!=='anonymous';state.merchant=false;show();
 await screen.findByRole('heading',{name:role==='anonymous'?'Sign in required':'Customer storefront'});
 expect(state.currencies).not.toHaveBeenCalled();
 expect(screen.queryByRole('heading',{name:'Currencies'})).not.toBeInTheDocument();
});
