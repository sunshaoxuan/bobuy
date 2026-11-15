import {render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider,supportedLocales,translate} from '../i18n';
import StoreNavigation from './StoreNavigation';
import StoreMobileNavigation from './StoreMobileNavigation';

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

it.each(supportedLocales)('keeps account out of the two mobile bottom shortcuts in %s',locale=>{
  localStorage.setItem('bobbuy_locale',locale);
  render(<I18nProvider><MemoryRouter initialEntries={['/account?node=7']}><StoreMobileNavigation quantity={2}/></MemoryRouter></I18nProvider>);
  expect(screen.queryByRole('link',{name:translate(locale,'store.account')})).not.toBeInTheDocument();
  expect(screen.getAllByRole('link')).toHaveLength(2);
});

it.each([['zh-CN','活动邮报'],['zh-TW','活動郵報'],['en-US','Campaign Newsletter'],['ja-JP','キャンペーン便り']] as const)('names the campaign newsletter in %s', (locale,label)=>{
  expect(translate(locale,'rec.title')).toBe(label);
});
