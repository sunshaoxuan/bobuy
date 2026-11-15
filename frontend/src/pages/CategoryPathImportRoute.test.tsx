import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import App from '../App';

const role=vi.hoisted(()=>({merchant:false,admin:true}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({isAuthenticated:true,isMerchant:role.merchant,user:{name:'Synthetic admin',platformAdmin:role.admin},logout:vi.fn()})}));
vi.mock('../pages/Storefront',()=>({default:()=> <h1>Customer storefront</h1>}));
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');});
it.each([[false,true],[true,false],[true,true]])('serves import and a unique navigation entry for merchant=%s admin=%s',async(merchant,admin)=>{
 role.merchant=merchant;role.admin=admin;
 render(<I18nProvider><MemoryRouter initialEntries={['/admin/category-path-import']}><App/></MemoryRouter></I18nProvider>);
 expect(await screen.findByRole('heading',{name:'Category path import'})).toBeInTheDocument();
 const links=screen.getAllByRole('link',{name:'Category path import'});
 expect(links).toHaveLength(1);expect(links[0]).toHaveAttribute('href','/admin/category-path-import');
});
it('keeps customer accounts outside the import workspace',async()=>{
 role.merchant=false;role.admin=false;
 render(<I18nProvider><MemoryRouter initialEntries={['/admin/category-path-import']}><App/></MemoryRouter></I18nProvider>);
 expect(await screen.findByRole('heading',{name:'Customer storefront'})).toBeInTheDocument();
 expect(screen.queryByRole('link',{name:'Category path import'})).not.toBeInTheDocument();
});
