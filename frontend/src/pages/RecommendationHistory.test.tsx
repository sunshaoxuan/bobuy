import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import PublicRecommendations from './PublicRecommendations';
import {I18nProvider} from '../i18n';
import type {RecommendationDetail} from '../api';
const mocks=vi.hoisted(()=>({feed:vi.fn()}));
vi.mock('../api',()=>({recommendationApi:mocks,storefrontApi:{products:vi.fn().mockResolvedValue([])}}));
const old:RecommendationDetail={post:{id:1,title:'Past fixture',published:true,version:1,updatedAt:'',publishedAt:'2026-10-01T00:00:00Z'},body:'',items:[{id:1,name:'Past item',imageUrl:'',offerEnd:'2026-10-01'}]};
const mixed:RecommendationDetail={...old,post:{...old.post,id:2,title:'Mixed fixture',publishedAt:'2026-10-20T00:00:00Z'},items:[{...old.items[0],id:2,categoryIds:['a'],categories:[{id:'a',name:{'en-US':'A'}}]},{id:3,name:'Unknown item',imageUrl:'',categoryIds:['b'],categories:[{id:'b',name:{'en-US':'B'}}]}]};
const fresh:RecommendationDetail={...old,post:{...old.post,id:3,title:'Newest fixture',publishedAt:'2026-10-28T00:00:00Z'},items:[{id:4,name:'New item',imageUrl:''}]};
function open(path='/recommendations'){return render(<I18nProvider><MemoryRouter initialEntries={[path]}><PublicRecommendations products={[]} quantities={{}} onDetail={()=>{}} onAdd={()=>{}} canBuy={()=>false}/></MemoryRouter></I18nProvider>);}
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-28T00:00:00Z'));mocks.feed.mockReset();mocks.feed.mockResolvedValue([old,mixed,fresh]);});
afterEach(()=>{vi.useRealTimers();});
it('keeps newest and mixed issues prominent while preserving collapsed historical topics and content',async()=>{
 const view=open();await screen.findByRole('heading',{name:'Newest fixture'});expect([...view.container.querySelectorAll('.rec-issue-directory a')].map(a=>a.textContent)).toEqual(['All','Newest fixture','Mixed fixture']);
 const history=view.container.querySelector('.rec-history-content') as HTMLDetailsElement;expect(history.open).toBe(false);expect(history.querySelector('h2')?.textContent).toBe('Past fixture');expect(mocks.feed).toHaveBeenCalledTimes(1);
 const topics=view.container.querySelector('.rec-history-topics') as HTMLDetailsElement;fireEvent.click(topics.querySelector('summary')!);fireEvent.click(topics.querySelector('a')!);await waitFor(()=>expect(screen.queryByRole('heading',{name:'Newest fixture'})).not.toBeInTheDocument());expect(screen.getByRole('heading',{name:'Past fixture'})).toBeVisible();expect(screen.getByText(/stated offer periods/)).toBeVisible();expect(topics.open).toBe(true);
});
it('does not classify a mixed issue as expired after selecting only its expired-item category',async()=>{
 const view=open('/recommendations?topic=2&category=a');await screen.findByRole('heading',{name:'Mixed fixture'});expect(view.container.querySelector('.rec-history-note')).toBeNull();expect(screen.getByRole('button',{name:'A (1)'})).toHaveAttribute('aria-pressed','true');expect(screen.getByRole('button',{name:'B (1)'})).toBeVisible();expect(view.container.querySelectorAll('.rec-pin')).toHaveLength(1);
});
