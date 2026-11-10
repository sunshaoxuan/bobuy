import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import RecommendationBrowse from './RecommendationBrowse';
import {browsePage,occurrence} from '../test/browseFixtures';
const mocks=vi.hoisted(()=>({browseItems:vi.fn(),browseIssues:vi.fn(),productSales:vi.fn(),get:vi.fn()}));
vi.mock('../api',()=>({storefrontApi:mocks,recommendationApi:mocks}));
const props={products:[],quantities:{p:2},onDetail:vi.fn(),onAdd:vi.fn(),canBuy:()=>false,renderProduct:()=>null};
function mount(){localStorage.setItem('bobbuy_locale','en-US');return render(<I18nProvider><MemoryRouter initialEntries={['/recommendations?node=1&category=keep']}><RecommendationBrowse {...props}/></MemoryRouter></I18nProvider>);}
beforeEach(()=>{vi.clearAllMocks();mocks.productSales.mockResolvedValue([]);mocks.browseItems.mockImplementation(async q=>browsePage([occurrence(1,q.page?2:1)],{page:q.page,matchedTotal:2,scopeTotal:2,hasNext:q.page===0}));});
it('preserves paged occurrences on repeated visibility and focus without preloading the closed directory',async()=>{
 vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 mount();await screen.findByRole('heading',{name:'Item 1'});fireEvent.click(screen.getByRole('button',{name:/Load more/}));await screen.findByRole('heading',{name:'Item 2'});const calls=mocks.browseItems.mock.calls.length;
 await act(async()=>{for(let i=0;i<3;i++){fireEvent.blur(window);fireEvent(document,new Event('visibilitychange'));fireEvent.focus(window);fireEvent(document,new Event('visibilitychange'));}});
 expect(mocks.browseItems).toHaveBeenCalledTimes(calls);expect(mocks.browseIssues).not.toHaveBeenCalled();expect(screen.getByRole('heading',{name:'Item 2'})).toBeInTheDocument();expect(mocks.browseItems.mock.calls[0][0]).toMatchObject({category:'keep',merchantId:1});
});
afterEach(()=>{vi.restoreAllMocks();});
it('keeps explicit dataset-change refresh usable',async()=>{
 mocks.browseItems.mockResolvedValueOnce(browsePage([occurrence()],{scopeTotal:2,matchedTotal:2,hasNext:true})).mockRejectedValueOnce(Error('browse.changed')).mockResolvedValueOnce(browsePage([occurrence(1,3)]));mount();await screen.findByRole('heading',{name:'Item 1'});fireEvent.click(screen.getByRole('button',{name:/Load more/}));await screen.findByText('The catalog changed. Refresh to load a consistent version.');fireEvent.click(screen.getByRole('button',{name:'Refresh catalog'}));await screen.findByRole('heading',{name:'Item 3'});expect(mocks.browseItems).toHaveBeenCalledTimes(3);
});
