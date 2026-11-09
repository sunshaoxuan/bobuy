import {render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import {I18nProvider} from '../i18n';
import {DetailOffer} from './ConsumerDetail';
import {CatalogSection} from '../pages/PublicProductCatalog';
import {browsePage,productCard} from '../test/browseFixtures';
const mocks=vi.hoisted(()=>({productBrowse:vi.fn(),productDetail:vi.fn(),productSales:vi.fn(),publicAssignments:vi.fn()}));
vi.mock('../api',()=>({storefrontApi:mocks,productMarkerApi:mocks}));
const source={name:'FX medicine',itemNumber:'26440',specification:'240 tablets',referencePrice:2820,originalPrice:3480,discountAmount:660,priceUnit:'240 tablets',offerStart:'2026-11-02',offerEnd:'2026-11-15',referenceContext:{channel:'COSTCO_ONLINE' as const,sourceUrl:'https://www.costco.co.jp/actual-source',startSearchComplete:true},referenceQuote:{state:'ACTIVE',amount:2820,itemIds:[1],unknownWindows:0}};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');});
it('labels historical reference price as not real time and shows each source amount only once',()=>{
 const view=render(<I18nProvider><DetailOffer facts={source}/></I18nProvider>);
 expect(screen.getByRole('heading',{name:'Reference price (not real time)'})).toBeInTheDocument();expect(view.container.textContent?.match(/2,820/g)).toHaveLength(1);expect(view.container.textContent).toContain('660');expect(view.container.textContent).toContain('3,480');
});
it('does not repeat equal original/reference prices or infer a reduction',()=>{
 const view=render(<I18nProvider><DetailOffer facts={{...source,referencePrice:500,originalPrice:500,discountAmount:null,referenceQuote:undefined}}/></I18nProvider>);expect(view.container.textContent?.match(/500/g)).toHaveLength(1);expect(view.container.textContent).not.toContain('Discount amount');
});
it('retains exact channel, source, offer and coupon dates instead of discarding conditions',()=>{
 render(<I18nProvider><DetailOffer facts={{...source,couponStart:'2026-10-20',couponEnd:'2026-10-25',offerNotes:'Medicine reference only. Cannot be purchased here.'}}/></I18nProvider>);
 expect(screen.getByRole('link',{name:/Source/})).toHaveAttribute('href',source.referenceContext.sourceUrl);expect(screen.getByText('Costco Online')).toBeInTheDocument();expect(screen.getByText(/2026-11-02/)).toHaveTextContent('2026-11-15');expect(screen.getByText(/2026-10-20/)).toHaveTextContent('2026-10-25');expect(screen.getByText('Medicine reference only. Cannot be purchased here.')).toBeInTheDocument();
});
it('keeps an unknown price unknown despite a known original price and discount',()=>{
 const view=render(<I18nProvider><DetailOffer facts={{...source,referencePrice:null,referenceQuote:undefined}}/></I18nProvider>);expect(view.container.textContent).not.toContain('2,820');expect(view.container.textContent).toContain('Not stated');
});
it('preserves an explicitly supplied currency instead of hardcoding JPY',()=>{
 const facts={...source,currency:'USD',referencePrice:12.5,originalPrice:15,discountAmount:2.5,referenceQuote:undefined};const view=render(<I18nProvider><DetailOffer facts={facts}/></I18nProvider>);expect(view.container.textContent).toContain('USD');expect(view.container.textContent).toContain('12.50');expect(view.container.textContent).toContain('15.00');expect(view.container.textContent).toContain('2.50');expect(view.container.textContent).not.toContain('JPY');
});
it('preserves a genuinely stated zero price without inventing an absent discount',()=>{
 const view=render(<I18nProvider><DetailOffer facts={{...source,referencePrice:0,originalPrice:null,discountAmount:null,referenceQuote:undefined}}/></I18nProvider>);expect(view.container.textContent).toContain('JPY');expect(view.container.querySelector('.consumer-reference-price')).not.toBeNull();expect(view.container.textContent).not.toContain('Discount amount');
});
it('renders the real catalog detail entry once while retaining both source-price rows and unavailable medical purchasing',async()=>{
 const shared='Shared medicine introduction. Reference information only.';
 const first={...source,id:1,productId:'p',description:shared,imageUrl:'/original-1.png',offerNotes:'Medicine reference only. Cannot be purchased here.'},second={...source,id:2,productId:'p',description:shared,imageUrl:'/original-2.png',referencePrice:3300,originalPrice:null,discountAmount:null,referenceQuote:{state:'ACTIVE',amount:3300,itemIds:[2],unknownWindows:0},referenceContext:{...source.referenceContext,channel:'COSTCO_WAREHOUSE' as const}};
 const card={...productCard(),name:{'en-US':'FX medicine'},itemNumber:'26440',specification:{'en-US':'Changed current master size'}};
 mocks.productBrowse.mockResolvedValue(browsePage([card]));mocks.productSales.mockResolvedValue([]);mocks.productDetail.mockResolvedValue({item:{...card,description:{'en-US':'New current-master text must not overwrite historical introductions'},gallery:[],referenceOffers:[{postId:7,facts:first},{postId:5,facts:second}]},markers:[],revision:'detail'});
 const onAdd=vi.fn();render(<I18nProvider><MemoryRouter initialEntries={['/products?product=p']}><CatalogSection products={[]} quantities={{}} onAdd={onAdd} canBuy={()=>false}/></MemoryRouter></I18nProvider>);
 const dialog=within(await screen.findByRole('dialog'));await dialog.findByText(shared);expect(dialog.getAllByText(shared)).toHaveLength(1);expect(dialog.queryByText('New current-master text must not overwrite historical introductions')).not.toBeInTheDocument();
 const root=screen.getByRole('dialog');expect(root.querySelectorAll('.consumer-product-code strong')).toHaveLength(1);expect(root.querySelector('.consumer-product-code strong')).toHaveTextContent('26440');expect(root.querySelectorAll('[data-reference-key]')).toHaveLength(2);expect(root.querySelectorAll('.consumer-reference-price')).toHaveLength(2);expect(root.textContent?.match(/2,820/g)).toHaveLength(1);expect(root.textContent?.match(/3,300/g)).toHaveLength(1);expect(dialog.getByText('Costco Online')).toBeInTheDocument();expect(dialog.getByText('Costco warehouse')).toBeInTheDocument();
 await waitFor(()=>expect(dialog.getByRole('button',{name:'Not open for booking yet'})).toBeDisabled());expect(onAdd).not.toHaveBeenCalled();
});
