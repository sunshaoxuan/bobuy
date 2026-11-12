import {render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import ProductMarkerBadges from './ProductMarkerBadges';
import type {ProductMarkerDefinition} from '../api';
import type {PublicReferencePrice} from '../api';
const marker=(id:string,enabled=true):ProductMarkerDefinition=>({id,code:id,badge:'新',name:{'en-US':id},description:{},color:'green',sortOrder:0,enabled,version:0});
beforeEach(()=>localStorage.setItem('bobbuy_locale','en-US'));
it('renders enabled markers in order, hides disabled definitions',()=>{const view=render(<I18nProvider><ProductMarkerBadges markers={[marker('a'),marker('b',false)]}/></I18nProvider>);expect(screen.getByLabelText('a')).toHaveTextContent('新');expect(screen.queryByLabelText('b')).not.toBeInTheDocument();expect(view.container.querySelectorAll('li')).toHaveLength(1);});
it('bounds image overlays to three badges plus an overflow count and keeps details complete',()=>{const values=Array.from({length:50},(_,i)=>marker(String(i)));const view=render(<I18nProvider><ProductMarkerBadges markers={values} overlay/></I18nProvider>);expect(view.container.querySelectorAll('li')).toHaveLength(4);expect(screen.getByLabelText('47 more markers')).toHaveTextContent('+47');view.rerender(<I18nProvider><ProductMarkerBadges markers={values}/></I18nProvider>);expect(view.container.querySelectorAll('li')).toHaveLength(50);});
it('renders no decoration for an empty assignment',()=>{const view=render(<I18nProvider><ProductMarkerBadges markers={[]}/></I18nProvider>);expect(view.container.querySelector('ul')).toBeNull();});
const promotion=(extra:Partial<PublicReferencePrice>={}):PublicReferencePrice=>({documentId:1,documentNumber:'PC-SYNTHETIC',channel:'COSTCO_WAREHOUSE',currency:'JPY',unit:'pack',amount:800,regularAmount:1000,promotion:true,type:'PROMOTION',state:'ACTIVE',startsAt:'2026-11-01T15:00:00Z',endsAt:'2026-11-15T15:00:00Z',...extra});
const discount={...marker('discount'),badge:'惠',code:'discount'};
afterEach(()=>{vi.restoreAllMocks();});
it('shows only current approved promotional periods beside the discount badge, deduplicating date ranges in Japan time',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T00:00:00Z'));
 const prices=[promotion(),promotion({documentId:2,channel:'COSTCO_ONLINE'}),promotion({type:'TEMPORARY'}),promotion({type:'PERMANENT',endsAt:null}),promotion({state:'DRAFT'}),promotion({startsAt:'2026-11-14T15:00:00Z'}),promotion({endsAt:'2026-11-12T15:00:00Z'})];
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount,marker('other')]} promotionPrices={prices}/></I18nProvider>);
 const period=screen.getByLabelText('Offer / redemption period');expect(period).toHaveTextContent('2026/11/02 → 2026/11/15 JST');expect(period.children).toHaveLength(1);expect(period.closest('li')?.querySelector('.product-marker-badge')).toHaveTextContent('惠');expect(view.container.querySelectorAll('.product-marker-period')).toHaveLength(1);
});
it('keeps separate active periods and exact intraday times, and rejects the exclusive end boundary',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T01:00:00Z'));
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount]} promotionPrices={[promotion(),promotion({startsAt:'2026-11-13T00:00:00Z',endsAt:'2026-11-13T03:00:00Z'}),promotion({endsAt:'2026-11-13T01:00:00Z'})]}/></I18nProvider>);
 expect(view.container.querySelector('.product-marker-period')?.children).toHaveLength(2);expect(view.container.textContent).toContain('2026/11/13 09:00:00 → 2026/11/13 12:00:00 JST');
});
it('does not add periods to image overlays or other markers and leaves unknown periods unstated',()=>{
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount]} promotionPrices={[]} overlay/></I18nProvider>);expect(view.container.querySelector('.product-marker-period')).toBeNull();
 view.rerender(<I18nProvider><ProductMarkerBadges markers={[marker('other')]} promotionPrices={[promotion()]}/></I18nProvider>);expect(view.container.querySelector('.product-marker-period')).toBeNull();
 view.rerender(<I18nProvider><ProductMarkerBadges markers={[discount]} promotionPrices={[]}/></I18nProvider>);expect(screen.getByLabelText('Offer / redemption period')).toHaveTextContent('Not stated');
});
