import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,Routes,Route} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import PublicRecommendations from './PublicRecommendations';
import {browsePage,occurrence,saleFixture} from '../test/browseFixtures';
import {serviceFixture} from '../serviceOffer.fixture';
const mocks=vi.hoisted(()=>({browseItems:vi.fn(),browseIssues:vi.fn(),productSales:vi.fn(),get:vi.fn(),feed:vi.fn(),products:vi.fn()}));vi.mock('../api',()=>({storefrontApi:mocks,recommendationApi:mocks}));
const props={products:[],quantities:{},onDetail:vi.fn(),onAdd:vi.fn(),canBuy:()=>false};
function mount(path='/recommendations',extra={}){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/recommendations" element={<PublicRecommendations {...props} {...extra}/>}/><Route path="/recommendations/:id" element={<PublicRecommendations {...props} {...extra}/>}/></Routes></MemoryRouter></I18nProvider>);}
beforeEach(()=>{vi.clearAllMocks();mocks.browseItems.mockResolvedValue(browsePage([occurrence()],{productOccurrences:1,serviceCards:0}));mocks.browseIssues.mockResolvedValue({items:[{post:occurrence().post,title:'Directory issue',itemCount:50,service:false,history:false}],page:0,size:20,total:1,hasNext:false,revision:'dir',datasetRevision:'d'.repeat(64),japanDay:'2026-11-07'});mocks.productSales.mockResolvedValue([]);mocks.get.mockResolvedValue({post:occurrence().post,body:'Explicit full body',items:[{...occurrence().item!,imageUrl:'',description:'Full item description',gallery:[]}]});});
it('makes first current cards usable with no directory/history/body/gallery or full-sale requests',async()=>{mocks.browseItems.mockResolvedValue(browsePage(Array.from({length:24},(_,i)=>occurrence(1,i+1,'p'+i)),{scopeTotal:100,matchedTotal:100,hasNext:true}));mount();await screen.findByRole('heading',{name:'Item 1'});expect(mocks.browseItems).toHaveBeenCalledTimes(1);expect(mocks.browseItems.mock.calls[0][0]).toMatchObject({page:0,period:'current',locale:'en-US'});expect(mocks.get).not.toHaveBeenCalled();expect(mocks.feed).not.toHaveBeenCalled();expect(mocks.browseIssues).not.toHaveBeenCalled();expect(mocks.products).not.toHaveBeenCalled();expect(mocks.productSales.mock.calls[0][0]).toHaveLength(24);});
it('does not deduplicate repeated products from distinct issue/item occurrences',async()=>{mocks.browseItems.mockResolvedValue(browsePage([occurrence(1,1,'shared'),occurrence(2,1,'shared')]));const view=mount();await screen.findAllByRole('heading',{name:'Item 1'});expect([...view.container.querySelectorAll('[data-occurrence-key]')].map(card=>card.getAttribute('data-occurrence-key'))).toEqual(['1:1','2:1']);expect(mocks.productSales).toHaveBeenCalledWith(['shared']);});
it('loads a historical stream only after opening it, without fetching issue bodies',async()=>{mocks.browseItems.mockImplementation(async q=>browsePage([occurrence(q.period==='history'?2:1,q.period==='history'?2:1)]));const view=mount();await screen.findByRole('heading',{name:'Item 1'});const history=[...view.container.querySelectorAll('details')].find(element=>element.querySelector('summary')?.textContent?.startsWith('Past'))??view.container.querySelectorAll('details')[1];act(()=>{history.open=true;fireEvent(history,new Event('toggle'));});await screen.findByRole('heading',{name:'Item 2'});expect(mocks.browseItems.mock.calls.map(call=>call[0].period)).toEqual(['current','history']);expect(mocks.get).not.toHaveBeenCalled();});
it('loads only a light directory on explicit open and keeps it version-aligned with the stream',async()=>{const view=mount();await screen.findByRole('heading',{name:'Item 1'});const directory=view.container.querySelector('details')!;act(()=>{directory.open=true;fireEvent(directory,new Event('toggle'));});await screen.findByRole('link',{name:'Directory issue (50)'});expect(mocks.browseIssues).toHaveBeenCalledTimes(1);expect(mocks.get).not.toHaveBeenCalled();expect(mocks.browseItems).toHaveBeenCalledTimes(1);});
it('reports directory/items dataset mismatch instead of mixing their metadata',async()=>{mocks.browseIssues.mockResolvedValue({items:[],page:0,size:20,total:0,hasNext:false,revision:'directory',datasetRevision:'other'});const view=mount();await screen.findByRole('heading',{name:'Item 1'});const directory=view.container.querySelector('details')!;act(()=>{directory.open=true;fireEvent(directory,new Event('toggle'));});await screen.findAllByText('The catalog changed. Refresh to load a consistent version.');expect(mocks.browseIssues).toHaveBeenCalledTimes(1);});
it('resolves a later item directly in the one explicitly selected issue without traversing pages',async()=>{mocks.get.mockResolvedValue({post:occurrence(8).post,body:'Selected issue body',items:[{...occurrence(8,900).item!,imageUrl:'',description:'Later detail',gallery:[]}]});mount('/recommendations/8?item=900&node=1');await screen.findByText('Later detail');expect(mocks.get).toHaveBeenCalledWith(8,true,1);expect(mocks.get).toHaveBeenCalledTimes(1);expect(mocks.browseItems).toHaveBeenCalledTimes(1);expect(mocks.browseItems.mock.calls[0][0]).toMatchObject({issueId:8,period:'all',page:0});});
it('shows service costs, fee conditions and windows without any inventory/cart fiction',async()=>{const service=serviceFixture();mocks.browseItems.mockResolvedValue(browsePage([{...occurrence(),key:'1:service',service:true,item:null,serviceSummary:service}],{productOccurrences:0,serviceCards:1}));const view=mount();await screen.findByText(new RegExp(service.provider));expect(view.container.querySelector('.service-summary')).toHaveTextContent(service.price!.toLocaleString('en-US'));expect(screen.queryByRole('button',{name:/Add to cart/})).not.toBeInTheDocument();expect(mocks.productSales).not.toHaveBeenCalled();expect(mocks.get).not.toHaveBeenCalled();});
it('keeps sale eligibility pending until the bounded quote arrives and then uses the actual server quote',async()=>{let resolve!:(value:unknown)=>void;mocks.productSales.mockImplementation(()=>new Promise(done=>{resolve=done;}));const onAdd=vi.fn();mount('/recommendations',{canBuy:()=>true,onAdd});await screen.findByRole('heading',{name:'Item 1'});expect(screen.getByRole('button',{name:'Add to cart: Item 1'})).toBeDisabled();expect(screen.getByText(/Checking current sale price/)).toBeInTheDocument();const quote=saleFixture();await act(async()=>resolve([quote]));fireEvent.click(screen.getByRole('button',{name:'Add to cart: Item 1'}));expect(onAdd).toHaveBeenCalledWith(quote);});
it('renders source titles as text and retains explicit publication metadata on the selected issue',async()=>{mocks.get.mockResolvedValue({post:{...occurrence().post,title:'<script>alert(1)</script>',publisherName:'Publisher fixture',publishedAt:'2026-11-01T01:00:00Z'},body:'Plain body',items:[]});const view=mount('/recommendations/1');await screen.findByRole('heading',{name:'<script>alert(1)</script>'});expect(view.container.querySelector('script')).toBeNull();});
it('fetches and displays full service restrictions only after the selected issue is explicitly opened',async()=>{const service=serviceFixture();mocks.get.mockResolvedValue({post:occurrence().post,body:'Explicit full service body',items:[],serviceOffer:service});mount('/recommendations?topic=1');await screen.findByText('Explicit full service body');expect(screen.getByText(service.terms['en-US'].restrictions)).toBeInTheDocument();expect(screen.getByText(service.terms['en-US'].cancellation)).toBeInTheDocument();expect(mocks.get).toHaveBeenCalledTimes(1);});
it('returns from an explicit issue without dropping merchant, query or category context',async()=>{const view=mount('/recommendations/1?node=1&query=later&category=cat&item=900',{query:'later'});await screen.findByText('Explicit full body');expect(view.container.querySelector('.rec-back')).toHaveAttribute('href','/recommendations?node=1&query=later&category=cat');});

it.each([
  {sourceUrl:null,label:'',link:null,text:null},
  {sourceUrl:undefined,label:'',link:null,text:null},
  {sourceUrl:'',label:'',link:null,text:null},
  {sourceUrl:'   ',label:'  ',link:null,text:null},
  {sourceUrl:'not a URL',label:'',link:null,text:null},
  {sourceUrl:'https://',label:'',link:null,text:null},
  {sourceUrl:'javascript:alert(1)',label:'Existing label',link:null,text:'Existing label'},
  {sourceUrl:null,label:'Existing label',link:null,text:'Existing label'},
  {sourceUrl:'https://example.org/original',label:'',link:'https://example.org/original',text:'example.org'},
  {sourceUrl:'https://example.org/original',label:'Original source',link:'https://example.org/original',text:'Original source'},
])('keeps source attribution safe for $sourceUrl / $label',async({sourceUrl,label,link,text})=>{
  mocks.get.mockResolvedValue({post:occurrence(961001).post,body:'Selected source issue',items:[{...occurrence(961001,981027).item!,imageUrl:'',description:'Source detail',gallery:[{id:'image',url:'/fixture.png',hash:'',assetKey:'',sourceUrl,label}]}]});
  mount('/recommendations/961001?item=981027');await screen.findByText('Source detail');
  const dialog=screen.getByRole('dialog');expect(dialog.querySelector('img[src="/fixture.png"]')).toBeInTheDocument();
  const links=dialog.querySelectorAll('details a');expect(links).toHaveLength(link?1:0);
  if(link){expect(links[0]).toHaveAttribute('href',link);expect(links[0]).toHaveTextContent(text!);expect(links[0]).toHaveAttribute('rel','noopener noreferrer');}
  else if(text)expect(within(dialog).getByText(text)).toBeInTheDocument();
  else expect(dialog.querySelector('details')).toBeNull();
});
it('keeps source attribution safe through detail close, item switch and return',async()=>{
  mocks.browseItems.mockResolvedValue(browsePage([occurrence(1,1),occurrence(1,2)]));
  mocks.get.mockResolvedValue({post:occurrence().post,body:'Selected source issue',items:[
    {...occurrence(1,1).item!,imageUrl:'',description:'First source detail',gallery:[{id:'first',url:'/first.png',hash:'',assetKey:'',sourceUrl:null,label:''}]},
    {...occurrence(1,2).item!,imageUrl:'',description:'Second source detail',gallery:[{id:'second',url:'/second.png',hash:'',assetKey:'',sourceUrl:'https://example.org/second',label:'Second source'}]},
  ]});
  const view=mount('/recommendations/1?item=1');await screen.findByText('First source detail');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Close'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Product details: Item 2'}));
  await screen.findByText('Second source detail');expect(within(screen.getByRole('dialog')).getByText('Second source')).toHaveAttribute('href','https://example.org/second');
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Close'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Product details: Item 1'}));await screen.findByText('First source detail');
  expect(screen.getByRole('dialog').querySelector('details')).toBeNull();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Close'}));
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(view.container.querySelector('.rec-back')).toHaveAttribute('href','/recommendations');
});
