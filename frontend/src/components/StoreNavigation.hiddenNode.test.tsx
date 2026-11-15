import {render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider,supportedLocales,translate} from '../i18n';
import StoreNavigation from './StoreNavigation';

const role=vi.hoisted(()=>({isCustomer:true}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>role}));
beforeEach(()=>localStorage.clear());

it.each(supportedLocales)('shows only enabled, non-duplicate customer entries in %s',async locale=>{
  localStorage.setItem('bobbuy_locale',locale);
  render(<I18nProvider><MemoryRouter initialEntries={['/products']}><StoreNavigation nodes={[]} open onClose={vi.fn()} onNodeChange={vi.fn()} loading={false}/></MemoryRouter></I18nProvider>);
  await waitFor(()=>expect(document.querySelector('.browse-drawer .browse-links')).toBeInTheDocument());
  expect(screen.getByRole('link',{name:translate(locale,'store.catalog')})).toHaveAttribute('href','/products');
  for(const key of ['browse.bookable','browse.executed','store.account','rec.title'])
    expect(screen.queryByRole('link',{name:translate(locale,key)})).not.toBeInTheDocument();
});
