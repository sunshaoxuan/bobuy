import {render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import AccountShortcuts from './AccountShortcuts';

it.each<[boolean,'/client/orders'|'/admin/orders'|undefined]>([[false,'/client/orders'],[true,'/admin/orders'],[true,'/client/orders'],[false,undefined],[true,undefined]])('exposes only permitted account destinations (manage=%s, order=%s)',(canManage,ordersPath)=>{
  localStorage.setItem('bobbuy_locale','zh-CN');
  render(<MemoryRouter initialEntries={['/account']}><I18nProvider><AccountShortcuts canManage={canManage} ordersPath={ordersPath}/></I18nProvider></MemoryRouter>);
  const menu=within(screen.getByRole('navigation',{name:'账户快捷菜单'}));
  expect(menu.getByRole('link',{name:/我的资料/})).toHaveAttribute('aria-current','page');
  if(ordersPath)expect(menu.getByRole('link',{name:/我的订单/})).toHaveAttribute('href',ordersPath);
  else expect(menu.queryByRole('link',{name:/我的订单/})).not.toBeInTheDocument();
  if(canManage)expect(menu.getByRole('link',{name:/商家维护/})).toHaveAttribute('href','/admin');
  else expect(menu.queryByRole('link',{name:/商家维护/})).not.toBeInTheDocument();
});
