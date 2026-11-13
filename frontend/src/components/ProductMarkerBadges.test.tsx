import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import ProductMarkerBadges from './ProductMarkerBadges';
import type {ProductMarkerDefinition} from '../api';
import type {PublicReferencePrice} from '../api';
import {storefrontApi,type PublicCatalogEntry} from '../api';
import {currentOfferPeriods} from './offerPeriodText';
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
 const period=screen.getByLabelText('Offer period');expect(period).toHaveTextContent('Nov 2 to Nov 15');expect(period.querySelectorAll('.offer-period-copy > span')).toHaveLength(1);expect(period.closest('li')?.querySelector('.product-marker-badge')).toHaveTextContent('惠');expect(view.container.querySelectorAll('.product-marker-period')).toHaveLength(1);expect(period.textContent).not.toMatch(/JST|→|2026\/11/);
});
it('keeps separate active periods and exact intraday times, and rejects the exclusive end boundary',()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T01:00:00Z'));
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount]} promotionPrices={[promotion(),promotion({startsAt:'2026-11-13T00:00:00Z',endsAt:'2026-11-13T03:00:00Z'}),promotion({endsAt:'2026-11-13T01:00:00Z'})]}/></I18nProvider>);
 expect(view.container.querySelectorAll('.offer-period-copy > span')).toHaveLength(2);expect(view.container.textContent).toContain('Nov 13 09:00 to 12:00 (Japan time)');
});
it('does not add periods to image overlays or other markers and leaves unknown periods unstated',()=>{
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount]} promotionPrices={[]} overlay/></I18nProvider>);expect(view.container.querySelector('.product-marker-period')).toBeNull();
 view.rerender(<I18nProvider><ProductMarkerBadges markers={[marker('other')]} promotionPrices={[promotion()]}/></I18nProvider>);expect(view.container.querySelector('.product-marker-period')).toBeNull();
 view.rerender(<I18nProvider><ProductMarkerBadges markers={[discount]} promotionPrices={[]}/></I18nProvider>);expect(screen.getByLabelText('Offer period')).toHaveTextContent('Offer dates to be confirmed');
});
it('uses everyday Chinese dates, inclusive whole days, cross-year dates and meaningful seconds',()=>{
 const now=Date.parse('2026-11-13T01:00:00Z');
 expect(currentOfferPeriods([promotion()],'zh-CN',now)).toEqual(['11月2日至11月15日']);
 expect(currentOfferPeriods([promotion({startsAt:'2026-11-12T15:00:00Z',endsAt:'2026-11-13T15:00:00Z'})],'zh-CN',now)).toEqual(['11月13日']);
 expect(currentOfferPeriods([promotion({startsAt:'2026-12-30T15:00:00Z',endsAt:'2027-01-02T15:00:00Z'})],'zh-CN',Date.parse('2026-12-31T01:00:00Z'))).toEqual(['2026年12月31日至2027年1月2日']);
 expect(currentOfferPeriods([promotion({startsAt:'2026-11-13T00:00:00Z',endsAt:'2026-11-13T03:00:30Z'})],'zh-CN',now)[0]).toContain('12:00:30（日本时间）');
 expect(currentOfferPeriods([promotion({startsAt:'bad'}),promotion({endsAt:'bad'})],'zh-CN',now)).toEqual([]);
});
it('loads dates only when opened, keeps the tooltip on the right, and caches a successful read',async()=>{
 vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T00:00:00Z'));
 const load=vi.spyOn(storefrontApi,'productDetail').mockResolvedValue({item:{referencePrices:[promotion()]} as PublicCatalogEntry,markers:[],revision:'r'});
 const view=render(<I18nProvider><ProductMarkerBadges markers={[discount]} overlay productId="p"/></I18nProvider>);
 const badge=screen.getByLabelText('discount');expect(load).not.toHaveBeenCalled();expect(badge).toHaveAttribute('data-card-action','offer-period');
 fireEvent.focus(badge);await screen.findByText('Nov 2 to Nov 15');expect(load).toHaveBeenCalledWith('p');
 expect(document.querySelector('.offer-period-tooltip')).toHaveClass('ant-tooltip-placement-right');
 fireEvent.blur(badge);fireEvent.focus(badge);await waitFor(()=>expect(load).toHaveBeenCalledTimes(1));view.unmount();
});
it('offers a plain retry message after a failed read and does not invent dates',async()=>{
 const load=vi.spyOn(storefrontApi,'productDetail').mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({item:{referencePrices:[]} as PublicCatalogEntry,markers:[],revision:'r'});
 render(<I18nProvider><ProductMarkerBadges markers={[discount]} overlay productId="retry"/></I18nProvider>);
 const badge=screen.getByLabelText('discount');fireEvent.focus(badge);await screen.findByText('Offer dates are unavailable. Please try again shortly.');
 fireEvent.blur(badge);await waitFor(()=>expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());fireEvent.focus(badge);await screen.findByText('Offer dates to be confirmed');expect(load).toHaveBeenCalledTimes(2);
});
it('rechecks the end boundary when cached dates are reopened without another read',async()=>{
 const clock=vi.spyOn(Date,'now').mockReturnValue(Date.parse('2026-11-13T01:00:00Z'));
 const load=vi.spyOn(storefrontApi,'productDetail').mockResolvedValue({item:{referencePrices:[promotion({endsAt:'2026-11-13T02:00:00Z'})]} as PublicCatalogEntry,markers:[],revision:'r'});
 render(<I18nProvider><ProductMarkerBadges markers={[discount]} overlay productId="expiring"/></I18nProvider>);
 const badge=screen.getByLabelText('discount');fireEvent.focus(badge);await screen.findByText(/11:00/);
 fireEvent.blur(badge);await waitFor(()=>expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());clock.mockReturnValue(Date.parse('2026-11-13T02:00:00Z'));
 fireEvent.focus(badge);await screen.findByText('Offer dates to be confirmed');expect(load).toHaveBeenCalledTimes(1);
});
