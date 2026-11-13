import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import ProductPricingPanel,{jstInput,jstInstant} from './ProductPricingPanel';
import {I18nProvider} from '../i18n';
const mock=vi.hoisted(()=>({get:vi.fn(),regular:vi.fn(),list:vi.fn(),products:vi.fn(),currencies:vi.fn()}));
vi.mock('../api',()=>({productPricingApi:{get:mock.get,regular:mock.regular},priceDocumentApi:{list:mock.list,products:mock.products},masterDataApi:{currencies:mock.currencies}}));
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({options=[],value,onChange,disabled,mode,...props}:any)=><select multiple={mode==='multiple'} disabled={disabled} aria-label={props['aria-label']} value={value??(mode==='multiple'?[]:'')} onChange={event=>onChange?.(mode==='multiple'?Array.from(event.target.selectedOptions).map(option=>option.value):event.target.value)}>{options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
const sheet={productId:'p1',regular:{amount:1000,currency:'JPY',unit:'1 pack',revision:3,enabled:true},visibility:'DRAFTER_ONLY',orderMethod:'PRE_ORDER',now:'2026-11-12T00:00:00Z',timezone:'Asia/Tokyo',effective:{amount:1000,currency:'JPY',unit:'1 pack',regularAmount:1000},history:[]};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');mock.get.mockResolvedValue(sheet);mock.regular.mockResolvedValue(sheet);mock.list.mockResolvedValue([]);mock.products.mockResolvedValue([{id:'p1',name:{'en-US':'Synthetic'},currency:'JPY',unit:'1 pack'}]);mock.currencies.mockResolvedValue([{code:'JPY',fractionDigits:0,saleEnabled:true}]);});
it('includes both selected Japan-local days and round trips through midnight, leap day and year changes',()=>{for(const day of ['2026-11-13','2026-11-30','2026-12-31','2028-02-29']){const start=jstInstant(day),end=jstInstant(day,true);expect(Date.parse(end)-Date.parse(start)).toBe(86400000);expect(jstInput(start)).toBe(day);expect(jstInput(end,true)).toBe(day);expect(jstInstant(jstInput(end,true),true)).toBe(end);}expect(jstInstant('2026-11-13')).toBe('2026-11-12T15:00:00.000Z');expect(jstInstant('2026-11-13',true)).toBe('2026-11-13T15:00:00.000Z');for(const invalid of ['2026-02-30','2027-02-29','2026-11-13T00:00','bad'])expect(()=>jstInstant(invalid)).toThrow('pricing.invalid');});
it('requires a specific reason and confirmation before changing the regular price',async()=>{
 render(<I18nProvider><ProductPricingPanel id="p1" onClose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await screen.findByText(/1,000/);fireEvent.click(screen.getByText('Set regular selling price'));
 const save=await screen.findByRole('button',{name:'Confirm regular price'});expect(save).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Regular price change reason (required)'),{target:{value:'Verified supplier cost change'}});expect(save).toBeDisabled();fireEvent.click(screen.getByRole('checkbox',{name:'I reviewed the products, prices, period and reason'}));fireEvent.click(save);
 await waitFor(()=>expect(mock.regular).toHaveBeenCalledWith('p1',expect.objectContaining({reason:'Verified supplier cost change',amount:1000})));
 expect(screen.queryByLabelText('Start date')).toBeNull();
});
