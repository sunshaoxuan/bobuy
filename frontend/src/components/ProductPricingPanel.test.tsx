import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import ProductPricingPanel,{jstInput,jstInstant} from './ProductPricingPanel';
import {I18nProvider} from '../i18n';
const mock=vi.hoisted(()=>({get:vi.fn(),draft:vi.fn(),approve:vi.fn(),cancel:vi.fn(),regular:vi.fn(),currencies:vi.fn()}));
vi.mock('../api',()=>({productPricingApi:mock,recommendationApi:{currencies:mock.currencies}}));
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({options=[],value,onChange,disabled,...props}:any)=><select disabled={disabled} aria-label={props['aria-label']} value={value??''} onChange={event=>onChange?.(event.target.value)}>{options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
const row={id:42,version:0,productId:'p1',channel:'STOREFRONT',currency:'JPY',amount:800,startsAt:'2026-10-31T15:00:00Z',endsAt:'2026-11-01T15:00:00Z',status:'DRAFT',sourceNote:'Synthetic reviewed terms',createdAt:'2026-10-26T01:00:00Z'};
const sheet={productId:'p1',regular:{amount:1000,currency:'JPY',unit:'1 item',revision:3,enabled:true},visibility:'DRAFTER_ONLY',orderMethod:'PRE_ORDER',now:'2026-10-26T01:00:00Z',timezone:'Asia/Tokyo',effective:{amount:1000,currency:'JPY',unit:'1 item',regularAmount:1000},history:[{value:row,state:'DRAFT'}]};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');mock.get.mockResolvedValue(sheet);mock.draft.mockResolvedValue(sheet);mock.approve.mockResolvedValue({...sheet,history:[{value:{...row,version:1,status:'APPROVED'},state:'SCHEDULED'}]});mock.currencies.mockResolvedValue([{code:'JPY',fractionDigits:0,saleEnabled:true},{code:'USD',fractionDigits:2,saleEnabled:false}]);});
it('uses explicit JST conversion across midnight without truncating seconds',()=>{expect(jstInstant('2026-11-01T00:00')).toBe('2026-10-31T15:00:00.000Z');expect(jstInput('2026-10-31T15:00:45Z')).toBe('2026-11-01T00:00:45');expect(()=>jstInstant('missing')).toThrow('pricing.invalid');});
it('saves a separate draft without activating or changing the regular quote',async()=>{
 render(<I18nProvider><ProductPricingPanel id="p1" onClose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await screen.findByText('Adjustment history');
 expect(mock.regular).not.toHaveBeenCalled();expect(mock.approve).not.toHaveBeenCalled();
 fireEvent.change(screen.getByRole('spinbutton',{name:'Adjusted amount'}),{target:{value:'800'}});
 fireEvent.change(screen.getByLabelText('Start time (JST, inclusive)'),{target:{value:'2026-11-01T00:00'}});fireEvent.change(screen.getByLabelText('End time (JST, exclusive)'),{target:{value:'2026-11-02T00:00'}});
 fireEvent.change(screen.getByLabelText('Source and review notes (internal)'),{target:{value:'First terms'}});fireEvent.change(screen.getByLabelText('Source and review notes (internal)'),{target:{value:'Reviewed terms'}});
 fireEvent.click(screen.getByRole('button',{name:'Create adjustment draft'}));
 await waitFor(()=>expect(mock.draft).toHaveBeenCalled());expect(mock.draft.mock.calls[0][1]).toMatchObject({channel:'STOREFRONT',currency:'JPY',amount:800,startsAt:'2026-10-31T15:00:00.000Z',endsAt:'2026-11-01T15:00:00.000Z'});expect(mock.regular).not.toHaveBeenCalled();expect(mock.approve).not.toHaveBeenCalled();
});
it('requires an explicit review before approving the precise history record',async()=>{
 render(<I18nProvider><ProductPricingPanel id="p1" onClose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await screen.findByText('Adjustment history');
 // jsdom does not apply the real desktop/mobile media query; scope the desktop surface.
 fireEvent.click(within(document.querySelector('.pricing-history-table')!).getByRole('button',{name:'Approve adjustment'}));
 const modal=screen.getByRole('dialog',{name:'Review pricing action'});const ok=within(modal).getByRole('button',{name:'OK'});expect(ok).toBeDisabled();expect(mock.approve).not.toHaveBeenCalled();
 fireEvent.click(within(modal).getByRole('checkbox'));fireEvent.click(ok);await waitFor(()=>expect(mock.approve).toHaveBeenCalledWith('p1',row));
});
