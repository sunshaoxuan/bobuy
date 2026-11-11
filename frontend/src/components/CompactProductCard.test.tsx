import {fireEvent,render,screen,within} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CompactProductCard,{referenceForCard} from './CompactProductCard';
import {saleFixture} from '../test/browseFixtures';
const reference={amount:999999999999,currency:'JPY',unit:'pack',postId:7,itemId:9,state:'EXPIRED' as const};
it('keeps the inclusive source window and occurrence identity when summarizing a reference',()=>{
 const facts={id:9,name:'Product',referencePrice:0,offerStart:'2026-11-10',offerEnd:'2026-11-11'};
 expect(referenceForCard(facts,7,'2026-11-11')).toMatchObject({amount:0,postId:7,itemId:9,state:'ACTIVE'});
 expect(referenceForCard(facts,7,'2026-11-12')?.state).toBe('EXPIRED');
 expect(referenceForCard({...facts,offerStart:null},7,'2026-11-12')?.state).toBe('UNKNOWN');
});
it('keeps a discount-only fact unknown instead of presenting the discount as a price',()=>{
 expect(referenceForCard({id:9,name:'Product',referencePrice:null,discountAmount:400},7,'2026-11-11')).toBeUndefined();
});
function mount(extra={}){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><CompactProductCard name="Product" itemNumber="ITEM" onOpen={vi.fn()} {...extra}/></I18nProvider>);}
it('shows a source-bound reference amount when no sale quote exists',()=>{const view=mount({reference});const price=view.container.querySelector('[data-price-kind="reference"]')!;expect(within(price as HTMLElement).getByText('Past reference price')).toBeInTheDocument();expect(price).toHaveAttribute('data-price-source-post','7');expect(price).toHaveAttribute('data-price-source-item','9');expect(price.querySelector('strong')).toHaveTextContent('999,999,999,999');expect(price.querySelector('wbr')).toBeNull();});
it('uses an actual zero-price quote ahead of a reference without inventing another amount',()=>{const view=mount({quote:{...saleFixture(),price:0},reference});expect(view.container.querySelector('[data-price-kind="sale"] strong')).toHaveTextContent('0');expect(screen.queryByText('Past reference price')).not.toBeInTheDocument();});
it('keeps an explicit unknown state and five gray stars',()=>{const view=mount();expect(screen.getByText('Price unconfirmed')).toBeInTheDocument();expect(view.container.querySelectorAll('.ant-rate-star-zero')).toHaveLength(5);expect(view.container.querySelector('[data-price-kind="unknown"] strong')).toBeNull();});
it('keeps occurrence identity and opens details from both photo and copy',()=>{const open=vi.fn(),view=mount({occurrenceKey:'7:9',productId:'p',onOpen:open,heading:3});expect(view.container.querySelector('article')).toHaveAttribute('data-occurrence-key','7:9');fireEvent.click(screen.getByRole('button',{name:'Product'}));fireEvent.click(view.container.querySelector('.rec-pin-code')!);expect(open).toHaveBeenCalledTimes(2);expect(screen.getByRole('heading',{level:3,name:'Product'})).toBeInTheDocument();expect(view.container.querySelector('.rec-offer-info,.catalog-card-spec,.product-card-source')).toBeNull();});
