import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import {CatalogSection,catalogText} from './PublicProductCatalog';
import {browsePage,productCard,productDetail,saleFixture} from '../test/browseFixtures';
const mocks=vi.hoisted(()=>({productOverview:vi.fn(),productShelf:vi.fn(),productBrowse:vi.fn(),productDetail:vi.fn(),productSales:vi.fn(),publicAssignments:vi.fn()}));
vi.mock('../api',()=>({storefrontApi:mocks,productMarkerApi:mocks}));
const props={products:[],quantities:{},onAdd:vi.fn(),canBuy:()=>false};
function mount(path='/products?sort=rating-desc',extra={}){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={[path]}><CatalogSection {...props} {...extra}/></MemoryRouter></I18nProvider>);}
beforeEach(()=>{vi.clearAllMocks();mocks.productBrowse.mockResolvedValue(browsePage([productCard()]));mocks.productDetail.mockResolvedValue({item:productDetail(),markers:[],revision:'detail'});mocks.productSales.mockResolvedValue([]);});
it('renders the reviewed current introduction without replacing historical offer data',async()=>{
 const item={...productDetail(),introduction:{'en-US':'Current source-backed product introduction'}};
 mocks.productDetail.mockResolvedValue({item,markers:[],revision:'current-introduction'});mount('/products?sort=rating-desc&product=p');
 const dialog=within(await screen.findByRole('dialog'));expect(await dialog.findByText('Current source-backed product introduction')).toBeInTheDocument();expect(dialog.queryByText('Full description')).not.toBeInTheDocument();
});
it('opens catalog card metadata through the same scoped detail without enabling management or purchase actions',async()=>{
 const onEdit=vi.fn(),view=mount('/products?node=1&category=keep',{canEdit:()=>true,onEdit});await screen.findByRole('heading',{name:'Product'});
 const card=view.container.querySelector('.catalog-master-card')!;fireEvent.click(card.querySelector('.marker-product-actions span')!);fireEvent.click(card.querySelector('.marker-product-trigger')!);expect(onEdit).toHaveBeenCalledTimes(1);expect(mocks.productDetail).not.toHaveBeenCalled();
 expect(card.querySelector('.catalog-card-spec')).toBeNull();fireEvent.click(card.querySelector('.rec-pin-code')!);await screen.findByText('Full description');expect(mocks.productDetail).toHaveBeenCalledTimes(1);expect(mocks.productDetail).toHaveBeenCalledWith('p',1);expect(view.container.querySelector('button button')).toBeNull();
});
it('shows summary text before a delayed quote without fetching later pages, markers or details',async()=>{mocks.productSales.mockImplementation(()=>new Promise(()=>{}));mocks.productBrowse.mockResolvedValue(browsePage(Array.from({length:24},(_,i)=>productCard(i===0?'p':'p'+i)),{scopeTotal:225,matchedTotal:225,hasNext:true}));mount();await screen.findByRole('heading',{name:'Product'});expect(screen.queryAllByText(/Checking current sale price/)).toHaveLength(0);expect(screen.queryByRole('button',{name:/Add to cart:/})).not.toBeInTheDocument();expect(screen.queryByText('Not available to buy')).not.toBeInTheDocument();expect(mocks.productBrowse).toHaveBeenCalledTimes(1);expect(mocks.productSales.mock.calls[0][0]).toHaveLength(24);expect(mocks.publicAssignments).not.toHaveBeenCalled();expect(mocks.productDetail).not.toHaveBeenCalled();});
it('uses complete-scope server facets and search without loading later pages or clearing a valid URL category',async()=>{mocks.productBrowse.mockImplementation(async q=>browsePage([productCard(q.category?'later':'p')],{categories:[{id:'shop-later',name:{'en-US':'Later category'},count:99}],scopeTotal:100,matchedTotal:q.category?99:100,hasNext:true}));mount('/products?category=shop-later',{query:'Only later text'});await screen.findByRole('heading',{name:'later'});expect(screen.getByText('Later category',{selector:'strong'})).toHaveAttribute('aria-current','page');expect(mocks.productBrowse.mock.calls[0][0]).toMatchObject({page:0,category:'shop-later',query:'Only later text',locale:'en-US'});expect(screen.getByRole('status')).toHaveTextContent('1 of 99');expect(mocks.productBrowse).toHaveBeenCalledTimes(1);});
it('preserves earlier rows on continuation failure and retries that page without duplicates',async()=>{mocks.productBrowse.mockResolvedValueOnce(browsePage([productCard()],{scopeTotal:2,matchedTotal:2,hasNext:true})).mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(browsePage([productCard('next')],{page:1,scopeTotal:2,matchedTotal:2}));mount();await screen.findByRole('heading',{name:'Product'});fireEvent.click(screen.getByRole('button',{name:/Load more/}));await screen.findByRole('alert');expect(screen.getByRole('heading',{name:'Product'})).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Retry'}));await screen.findByRole('heading',{name:'next'});expect(document.querySelectorAll('.catalog-master-card')).toHaveLength(2);expect(mocks.productBrowse.mock.calls.map(call=>call[0].page)).toEqual([0,1,1]);});
it('stops 409 and refreshes deliberately rather than silently combining versions',async()=>{mocks.productBrowse.mockResolvedValueOnce(browsePage([productCard()],{scopeTotal:2,matchedTotal:2,hasNext:true})).mockRejectedValueOnce(Error('browse.changed')).mockResolvedValueOnce(browsePage([productCard('fresh')]));mount();await screen.findByRole('heading',{name:'Product'});fireEvent.click(screen.getByRole('button',{name:/Load more/}));await screen.findByText('The catalog changed. Refresh to load a consistent version.');expect(mocks.productBrowse).toHaveBeenCalledTimes(2);fireEvent.click(screen.getByRole('button',{name:'Refresh catalog'}));await screen.findByRole('heading',{name:'fresh'});expect(screen.queryByRole('heading',{name:'Product'})).not.toBeInTheDocument();});
it('opens a later-page deep-linked detail directly with zero page traversal',async()=>{mocks.productDetail.mockResolvedValue({item:productDetail('later'),markers:[],revision:'x'});mount('/products?sort=rating-desc&product=later');await screen.findByText('Full description');expect(mocks.productDetail).toHaveBeenCalledTimes(1);expect(mocks.productDetail).toHaveBeenCalledWith('later',undefined);expect(mocks.productBrowse).toHaveBeenCalledTimes(1);});
it('uses the genuine first image and keeps text usable when it fails',async()=>{mocks.productBrowse.mockResolvedValue(browsePage([{...productCard(),image:{id:'img',url:'/real-image.png',sourceUrl:'https://example.com/source',label:'Photo'}}]));mount();await screen.findByRole('heading',{name:'Product'});const img=screen.getByAltText('Product');expect(img).toHaveAttribute('src','/real-image.png');fireEvent.error(img);expect(screen.getByRole('heading',{name:'Product'})).toBeInTheDocument();});
it('gives the Japanese original a separate semantic line in catalog detail',async()=>{mocks.productDetail.mockResolvedValue({item:{...productCard(),name:{'en-US':'Product','ja-JP':'原名'},description:{},gallery:[],referenceOffers:[]},markers:[],revision:'detail'});mount('/products?sort=rating-desc&product=p');const original=await within(await screen.findByRole('dialog')).findByText('（原名）');expect(original).toHaveAttribute('lang','ja');expect(original).toHaveClass('rec-name-original');});
it('enables buying only after the actual bounded quote and existing eligibility agree',async()=>{const quote=saleFixture();mocks.productSales.mockResolvedValue([quote]);const onAdd=vi.fn();mount('/products?sort=rating-desc',{canBuy:()=>true,onAdd});await screen.findByRole('heading',{name:'Product'});await waitFor(()=>expect(screen.getByRole('button',{name:'Add to cart: Product'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Add to cart: Product'}));expect(onAdd).toHaveBeenCalledWith(quote);});
it('does not reinsert old-merchant rows after a quick scope change',async()=>{let finish!:(value:unknown)=>void;mocks.productBrowse.mockImplementation(q=>q.merchantId===1?new Promise(done=>{finish=done;}):Promise.resolve(browsePage([productCard('new',2)])));function Harness(){const navigate=useNavigate();return <><button onClick={()=>navigate('/products?sort=rating-desc&node=2')}>Switch</button><CatalogSection {...props}/></>;}localStorage.setItem('bobbuy_locale','en-US');render(<I18nProvider><MemoryRouter initialEntries={['/products?sort=rating-desc&node=1']}><Harness/></MemoryRouter></I18nProvider>);fireEvent.click(screen.getByRole('button',{name:'Switch'}));await screen.findByRole('heading',{name:'new'});await act(async()=>finish(browsePage([productCard('old')])));expect(screen.queryByRole('heading',{name:'old'})).not.toBeInTheDocument();});
it('keeps language attribution on fallback text',()=>{expect(catalogText({'ja-JP':'原文'},'en-US')).toMatchObject({value:'原文',language:'ja-JP',fallback:true});});

it.each(['pending','rejected'])('keeps the open detail action pending and disabled when the quote is %s',async state=>{
  if(state==='pending')mocks.productSales.mockImplementation(()=>new Promise(()=>{}));
  else mocks.productSales.mockRejectedValue(Error('quote offline'));
  mount('/products?sort=rating-desc&product=p',{canBuy:()=>true});
  await screen.findByText('Full description');
  if(state==='rejected')await screen.findByText('quote offline');
  const dialog=within(screen.getByRole('dialog'));
  expect(dialog.getByRole('button',{name:/Checking current sale price/})).toBeDisabled();
  expect(dialog.queryByRole('button',{name:'Not open for booking yet'})).not.toBeInTheDocument();
});
it('offers the verified detail quote only after eligibility succeeds',async()=>{
  const quote=saleFixture(),onAdd=vi.fn();mocks.productSales.mockResolvedValue([quote]);
  mount('/products?sort=rating-desc&product=p',{canBuy:()=>true,onAdd});await screen.findByText('Full description');
  const action=within(screen.getByRole('dialog')).getByRole('button',{name:'Add to cart'});
  await waitFor(()=>expect(action).toBeEnabled());fireEvent.click(action);expect(onAdd).toHaveBeenCalledWith(quote);
});
it('marks the detail unavailable only after a successful quote lookup confirms no sale',async()=>{
  mocks.productSales.mockResolvedValue([]);mount('/products?sort=rating-desc&product=p',{canBuy:()=>true});await screen.findByText('Full description');
  const dialog=within(screen.getByRole('dialog'));
  await waitFor(()=>expect(dialog.getByRole('button',{name:'Not open for booking yet'})).toBeDisabled());
  expect(dialog.queryByRole('button',{name:/Checking current sale price/})).not.toBeInTheDocument();
});
it('keeps the detail pending and disabled while required purchase context is unresolved',async()=>{
  mocks.productSales.mockResolvedValue([saleFixture()]);mount('/products?sort=rating-desc&product=p',{purchasePending:true,canBuy:()=>false});await screen.findByText('Full description');
  await waitFor(()=>expect(mocks.productSales).toHaveBeenCalled());
  expect(within(screen.getByRole('dialog')).getByRole('button',{name:/Checking current sale price/})).toBeDisabled();
});

it('links to all eligible roots in server order, including roots outside the product preview', async () => {
  mocks.productBrowse.mockResolvedValue(browsePage([productCard()], {categories: [
    {id: 'shop-z', name: {'en-US': 'Z first'}, count: 7, imageUrl: '/api/storefront/recommendation-images/staged-image'},
    {id: 'shop-child', parentId: 'shop-z', name: {'en-US': 'Child'}, count: 7},
    {id: 'legacy', name: {'en-US': 'Legacy'}, count: 12},
    {id: 'shop-empty', name: {'en-US': 'Empty'}, count: 0},
    {id: 'shop-a', name: {'en-US': 'A later'}, count: 30},
  ]}));
  mocks.productOverview.mockImplementation(async () => ({...await mocks.productBrowse({}),items:[],scopeTotal:37,matchedTotal:37,shelves:[{category:'shop-z',items:Array.from({length:7},(_,i)=>productCard('z'+i)),total:7},{category:'shop-a',items:[],total:30}]}));
  mocks.productShelf.mockImplementation(()=>new Promise(()=>{}));
  mount('/products?node=7');
  const shortcuts = within(await screen.findByRole('navigation', {name: 'All categories'}));
  expect(screen.queryByRole('button', {name: 'Product Picks'})).not.toBeInTheDocument();
  const links = shortcuts.getAllByRole('link');
  expect(links.map(link => link.textContent)).toEqual(['All', 'Z first', 'A later']);
  expect(links[2]).toHaveAttribute('href', '/products?node=7&category=shop-a');
  expect(links[1].querySelector('img')).toHaveAttribute('src', '/api/storefront/recommendation-images/staged-image');
  expect(links[2].querySelector('span.category-shortcuts-image')).toBeInTheDocument();
  fireEvent.click(links[2]);
  await waitFor(() => expect(mocks.productBrowse.mock.lastCall?.[0]).toMatchObject({merchantId: 7, category: 'shop-a'}));
  expect(screen.getByRole('navigation', {name: 'All categories'})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'A later'})).toHaveAttribute('aria-current','true');
  expect(screen.getByRole('button', {name: 'Product Picks'})).toBeInTheDocument();
});

it('keeps shortcuts out of search results even when the server returns roots', async () => {
  mocks.productBrowse.mockResolvedValue(browsePage([productCard()], {categories: [
    {id: 'shop-z', name: {'en-US': 'Z first'}, count: 7},
  ]}));
  mount('/products', {query: 'Search term'});
  await screen.findByRole('heading', {name: 'Product'});
  expect(screen.queryByRole('navigation', {name: 'All categories'})).not.toBeInTheDocument();
});

it('renders overview cards for whitespace queries without requesting a grid or a second page',async()=>{
 mocks.productOverview.mockResolvedValue(browsePage([],{scopeTotal:1,matchedTotal:1,categories:[{id:'shop-first',name:{'en-US':'First'},count:1}],shelves:[{category:'shop-first',total:1,items:[productCard()]}]}));
 mount('/products',{query:'   '});await screen.findByRole('heading',{name:'Product'});
 expect(mocks.productBrowse).not.toHaveBeenCalled();expect(mocks.productShelf).not.toHaveBeenCalled();expect(screen.getByRole('navigation',{name:'All categories'})).toBeInTheDocument();
});

it('keeps root shortcuts on direct leaf URLs and shows the selected category full vertical results, not its shelf preview',async()=>{
 const categories=[{id:'shop-root',name:{'en-US':'Root'},count:3},{id:'shop-leaf',parentId:'shop-root',name:{'en-US':'Leaf'},count:3},{id:'shop-other',name:{'en-US':'Other'},count:7}];
 mocks.productBrowse.mockResolvedValue(browsePage([productCard('first'),productCard('second'),productCard('third')],{categories,matchedTotal:3,shelves:[{category:'shop-leaf',items:[productCard('first')],total:3}]}));
 const view=mount('/products?node=7&category=shop-leaf');
 await screen.findByRole('heading',{name:'third'});
 expect(screen.getByRole('link',{name:'Root'})).toHaveAttribute('aria-current','true');
 expect(screen.getByRole('link',{name:'Other'})).not.toHaveAttribute('aria-current');
 expect(screen.getByText('Leaf',{selector:'strong'})).toHaveAttribute('aria-current','page');
 expect(view.container.querySelectorAll('.catalog-master-card')).toHaveLength(3);expect(view.container.querySelector('.shopping-shelf')).toBeNull();
 expect(mocks.productBrowse.mock.calls[0][0]).toMatchObject({category:'shop-leaf',merchantId:7});
});
