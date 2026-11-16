import {fireEvent,render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import ShoppingNavigation from './ShoppingNavigation';

it('never treats backend or legacy IDs as shopping categories',()=>{
 localStorage.setItem('bobbuy_locale','en-US');
 render(<I18nProvider><ShoppingNavigation categories={[{id:'rec-cat-raw',name:{'en-US':'Raw backend name'},count:3},{id:'uuid-source',name:{'en-US':'Source tree name'},count:2}]} category="rec-cat-raw" onChoose={()=>{}}/></I18nProvider>);
 expect(screen.queryByText('Raw backend name')).toBeNull();expect(screen.queryByText('Source tree name')).toBeNull();
});
it('uses the same leaf identity and explicit parent action for a shared link',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const choose=vi.fn();
 render(<I18nProvider><ShoppingNavigation categories={[{id:'shop-drinks',parentId:null,name:{'en-US':'Drinks'},count:3},{id:'shop-juice',parentId:'shop-drinks',name:{'en-US':'Juice'},count:3}]} category="shop-juice" onChoose={choose}/></I18nProvider>);
 expect(screen.getByText('Juice')).toHaveAttribute('aria-current','page');
 fireEvent.click(screen.getByRole('button',{name:'Parent category'}));expect(choose).toHaveBeenCalledWith('shop-drinks');
});
