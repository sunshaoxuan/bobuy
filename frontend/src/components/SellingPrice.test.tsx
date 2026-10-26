import {render} from '@testing-library/react';
import {expect,it} from 'vitest';
import {I18nProvider} from '../i18n';
import SellingPrice from './SellingPrice';
import {type StoreProduct} from '../api';
const product:StoreProduct={id:'fixture',merchantId:1,name:{'ja-JP':'合成商品'},description:{},brand:'Fixture',price:800,categoryId:'',images:[],currency:'JPY',saleUnit:'100g'};
it('shows an adjusted selling amount separately from regular price and its explicit JST interval',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><SellingPrice product={{...product,regularPrice:1000,priceAdjustmentId:42,priceValidFrom:'2026-10-26T15:00:00Z',priceValidUntil:'2026-10-26T16:00:00Z'}}/></I18nProvider>);
 expect(view.container.querySelector('del')?.textContent).toContain('1,000');expect(view.container.textContent).toContain('100g');expect(view.container.textContent).toContain('10/27/2026');expect(view.container.textContent).toContain('00:00:00');expect(view.container.textContent).toContain('01:00:00');expect(view.container.textContent).toContain('JST');expect(view.container.textContent).toContain('end excluded');
});
it('does not advertise a discount interval when only a regular quote applies',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><SellingPrice product={product}/></I18nProvider>);expect(view.container.querySelector('del')).toBeNull();expect(view.container.textContent).not.toContain('Applicable interval');expect(view.container.textContent).toContain('800');
});
