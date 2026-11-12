import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import PriceAdjustmentWorkspace from './PriceAdjustmentWorkspace';
import {I18nProvider} from '../i18n';
const mock=vi.hoisted(()=>({list:vi.fn(),products:vi.fn(),save:vi.fn(),act:vi.fn(),currencies:vi.fn()}));
vi.mock('../api',()=>({priceDocumentApi:mock,masterDataApi:{currencies:mock.currencies}}));
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({options=[],value,onChange,disabled,mode,...props}:any)=><select multiple={mode==='multiple'} disabled={disabled} aria-label={props['aria-label']} value={value??(mode==='multiple'?[]:'')} onChange={event=>onChange?.(mode==='multiple'?Array.from(event.target.selectedOptions).map(option=>option.value):event.target.value)}>{options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
const row={id:42,version:3,documentNumber:'PC-SYNTHETIC',type:'PROMOTION',channel:'STOREFRONT',currency:'JPY',startsAt:'2026-11-12T15:00:00Z',endsAt:'2026-11-13T15:00:00Z',sourceNote:'Synthetic reviewed promotion',status:'DRAFT',evidence:{},lines:[{id:1,productId:'p1',amount:800,beforeAmount:1000,unit:'1 pack'}]};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');mock.list.mockResolvedValue([{value:row,state:'DRAFT'}]);mock.products.mockResolvedValue([{id:'p1',itemNumber:'001',name:{'en-US':'Synthetic one'},currency:'JPY',unit:'1 pack'},{id:'p2',itemNumber:'002',name:{'en-US':'Synthetic two'},currency:'JPY',unit:'1 pack'}]);mock.currencies.mockResolvedValue([{code:'JPY',fractionDigits:0}]);mock.save.mockResolvedValue({value:row,state:'DRAFT'});mock.act.mockResolvedValue({value:row,state:'SCHEDULED'});});
function view(){return render(<I18nProvider><PriceAdjustmentWorkspace productId="p1"/></I18nProvider>);}
it('requires a reason and keeps a new adjustment scoped to the current product',async()=>{
 view();await screen.findByText('PC-SYNTHETIC');await waitFor(()=>expect(screen.getByRole('button',{name:'New document'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'New document'}));const drawer=await screen.findByRole('dialog',{name:'New document'});
 expect(within(drawer).getByRole('button',{name:'Save draft'})).toBeDisabled();
 const select=within(drawer).getByRole('listbox',{name:'Select products, multiple allowed'}) as HTMLSelectElement;expect(select).toBeDisabled();expect(Array.from(select.selectedOptions).map(option=>option.value)).toEqual(['p1']);
 fireEvent.change(within(drawer).getByLabelText('Price change reason (required)'),{target:{value:'Holiday campaign approved budget'}});
 fireEvent.change(within(drawer).getByLabelText('Start time (JST, inclusive)'),{target:{value:'2026-11-13T00:00'}});fireEvent.change(within(drawer).getByLabelText('End time (JST, exclusive)'),{target:{value:'2026-11-14T00:00'}});
 const amounts=within(drawer).getAllByRole('spinbutton',{name:/Adjusted price/});amounts.forEach((input,n)=>fireEvent.change(input,{target:{value:String(800+n*100)}}));fireEvent.click(within(drawer).getByRole('button',{name:'Save draft'}));
 await waitFor(()=>expect(mock.save).toHaveBeenCalled());expect(mock.save.mock.calls[0][0]).toMatchObject({type:'PROMOTION',reason:'Holiday campaign approved budget',startsAt:'2026-11-12T15:00:00.000Z',endsAt:'2026-11-13T15:00:00.000Z'});expect(mock.save.mock.calls[0][0].lines).toHaveLength(1);expect(mock.act).not.toHaveBeenCalled();
});
it('requires approval confirmation for the exact document version',async()=>{
 view();await screen.findByText('PC-SYNTHETIC');fireEvent.click(screen.getByRole('button',{name:'Approve'}));const modal=screen.getByRole('dialog',{name:'Approve'});expect(within(modal).getByRole('button',{name:'OK'})).toBeDisabled();fireEvent.click(within(modal).getByRole('checkbox'));fireEvent.click(within(modal).getByRole('button',{name:'OK'}));await waitFor(()=>expect(mock.act).toHaveBeenCalledWith(row,'approve',''));
});
it('requires a separate cancellation reason and keeps the original reason visible',async()=>{
 view();await screen.findByText('PC-SYNTHETIC');fireEvent.click(screen.getByRole('button',{name:'Cancel document'}));const modal=await screen.findByRole('dialog',{name:'Cancel document'});fireEvent.click(within(modal).getByRole('checkbox'));expect(within(modal).getByRole('button',{name:'OK'})).toBeDisabled();await waitFor(()=>expect(within(modal).getByText('Synthetic reviewed promotion')).toBeVisible());fireEvent.change(within(modal).getByLabelText('Cancellation reason (required)'),{target:{value:'Campaign withdrawn before activation'}});fireEvent.click(within(modal).getByRole('button',{name:'OK'}));await waitFor(()=>expect(mock.act).toHaveBeenCalledWith(row,'cancel','Campaign withdrawn before activation'));
});
