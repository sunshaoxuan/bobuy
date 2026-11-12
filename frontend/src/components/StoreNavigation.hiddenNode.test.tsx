import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import {I18nProvider,supportedLocales,translate} from '../i18n';
import StoreNavigation from './StoreNavigation';

const role=vi.hoisted(()=>({isCustomer:false}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>role}));

function Location(){const location=useLocation();return <output data-testid="route">{location.pathname+location.search}</output>;}
beforeEach(()=>{localStorage.clear();role.isCustomer=false;});

const cases=supportedLocales.flatMap(locale=>[undefined,7].flatMap(node=>
  [false,true].map(open=>({locale,node,open}))));

it.each(cases)('omits selector and placeholder for $locale / node=$node / drawer=$open',async({locale,node,open})=>{
  localStorage.setItem('bobbuy_locale',locale);
  const change=vi.fn(),close=vi.fn(),search=node===undefined?'':'?node='+node;
  render(<I18nProvider><MemoryRouter initialEntries={['/recommendations'+search]}>
    <Location/><StoreNavigation nodes={[{id:7,name:'Existing merchant'}]} node={node} open={open}
      onClose={close} onNodeChange={change} loading={false}/>
  </MemoryRouter></I18nProvider>);
  const sidebar=document.querySelector('.browse-sidebar')!;
  const roots=[sidebar];
  if(open){await waitFor(()=>expect(document.querySelector('.browse-drawer .ant-drawer-body')).toBeInTheDocument());roots.push(document.querySelector('.browse-drawer .ant-drawer-body')!);}
  for(const root of roots){
    expect(root.children).toHaveLength(2);
    expect(root.children[0]).toHaveClass('browse-brand');
    expect(root.children[1]).toHaveClass('browse-links');
    expect(root.querySelector('.browse-node,select,input,[role="combobox"]')).toBeNull();
    expect(root.querySelector('.browse-brand')).toHaveAttribute('href','/'+search);
    expect(root.querySelector('.browse-brand-domain')).toHaveTextContent('bobuy.cc');
    expect(root.querySelector('.browse-brand-heading strong')).toHaveTextContent(translate(locale,'app.brand'));
    expect(root.querySelector('a[href="/trips'+search+'"]')).toBeInTheDocument();
  }
  for(const key of ['browse.node','browse.all_nodes','browse.node_hint'])
    expect(screen.queryByText(translate(locale,key))).not.toBeInTheDocument();
  expect(screen.queryByRole('combobox',{hidden:true})).not.toBeInTheDocument();
  expect(screen.getByTestId('route')).toHaveTextContent('/recommendations'+search);
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(sidebar.querySelector('a[href="/trips'+search+'"]')!);
  expect(screen.getByTestId('route')).toHaveTextContent('/trips'+search);
  expect(change).not.toHaveBeenCalled();
});

it.each(['anonymous','merchant','customer'])('preserves navigation permissions for %s',kind=>{
  localStorage.setItem('bobbuy_locale','en-US');role.isCustomer=kind==='customer';
  const change=vi.fn();
  render(<I18nProvider><MemoryRouter initialEntries={['/products?node=7']}>
    <StoreNavigation nodes={[]} node={7} open={false} onClose={vi.fn()} onNodeChange={change} loading={true}/>
  </MemoryRouter></I18nProvider>);
  expect(screen.getByRole('link',{name:'Product Picks'})).toHaveAttribute('href','/recommendations?node=7');
  const orders=document.querySelector('a[href="/client/orders?node=7"]');
  const billing=document.querySelector('a[href="/client/billing?node=7"]');
  if(kind==='customer'){expect(orders).toBeInTheDocument();expect(billing).toBeInTheDocument();}
  else{expect(orders).toBeNull();expect(billing).toBeNull();}
  expect(document.querySelector('a[href="/admin"]')).toBeNull();
  expect(change).not.toHaveBeenCalled();
});
