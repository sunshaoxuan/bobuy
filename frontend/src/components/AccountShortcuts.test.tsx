import {render,screen,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import AccountShortcuts from './AccountShortcuts';

it.each([[false,true],[true,false],[true,true],[false,false]])('exposes only permitted account destinations (manage=%s, order=%s)',(canManage,canOrder)=>{
  localStorage.setItem('bobbuy_locale','zh-CN');
  render(<MemoryRouter initialEntries={['/account']}><I18nProvider><AccountShortcuts canManage={canManage} canOrder={canOrder}/></I18nProvider></MemoryRouter>);
  const menu=within(screen.getByRole('navigation',{name:'账户快捷菜单'}));
  expect(menu.getByRole('link',{name:/我的资料/})).toHaveAttribute('aria-current','page');
  if(canOrder)expect(menu.getByRole('link',{name:/我的订单/})).toHaveAttribute('href','/client/orders');
  else expect(menu.queryByRole('link',{name:/我的订单/})).not.toBeInTheDocument();
  if(canManage)expect(menu.getByRole('link',{name:/商家维护/})).toHaveAttribute('href','/admin');
  else expect(menu.queryByRole('link',{name:/商家维护/})).not.toBeInTheDocument();
});
