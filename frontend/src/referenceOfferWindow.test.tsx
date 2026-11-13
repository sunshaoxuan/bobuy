import {render,screen} from '@testing-library/react';
import {resolvedOfferWindow} from './referenceOfferWindow';
import {itemOfferExpired} from './recommendationSchedule';
import {OfferInfo,FactsForm} from './components/RecommendationFacts';
import {I18nProvider} from './i18n';
import {priceChange} from './test/priceDocumentFixtures';
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({options=[],value,onChange,disabled,...props}:any)=><select disabled={disabled} aria-label={props['aria-label']} value={value??''} onChange={e=>onChange?.(e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
it('takes all display dates from the price document and ignores independent item and activity dates',()=>{
 const facts={name:'x',offerStart:'2000-01-01',offerEnd:'2099-01-01',referenceContext:{activityApplies:true,activityStart:'1999-01-01',activityEnd:'2099-01-01'},priceChange:priceChange()};
 expect(resolvedOfferWindow(facts)).toEqual({start:'2026-10-02',end:'2026-10-26'});
 expect(resolvedOfferWindow({...facts,priceChange:null})).toEqual({start:null,end:null});
});
it('does not infer a document or archive an item from source-only dates',()=>{const facts={name:'x',offerStart:'2020-01-01',offerEnd:'2020-01-02'};expect(itemOfferExpired(facts,'2026-11-20')).toBe(false);});
it('shows document identity and an unknown period without borrowing source dates',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const view=render(<I18nProvider><OfferInfo facts={{name:'x',offerEnd:'2026-11-08',priceChange:priceChange({startsAt:null,endsAt:null,state:'UNKNOWN',promotion:false})}}/></I18nProvider>);expect(view.container.textContent).toContain('PC-SYNTHETIC-1');expect(view.container.textContent).toContain('Needs review');expect(view.container.textContent).not.toContain('2026-11-08');
});
it('removes independent item price and offer-date editing and provides the document entry',()=>{
 localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><FactsForm facts={{name:'Synthetic'}} onChange={()=>{}}/></I18nProvider>);expect(screen.getByRole('link',{name:'Price adjustment documents'})).toHaveAttribute('href','/admin/products');expect(screen.queryByText('Offer / redemption start')).toBeNull();expect(screen.queryByText('Offer / redemption end')).toBeNull();expect(document.querySelectorAll('input[type=date]')).toHaveLength(2);
});
