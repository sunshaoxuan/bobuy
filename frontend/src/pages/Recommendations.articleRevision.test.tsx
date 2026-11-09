import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import {storeAuthSession} from '../authStorage';
import {I18nProvider} from '../i18n';
import Recommendations from './Recommendations';
import type {RecommendationDetail} from '../api';
const mocks=vi.hoisted(()=>({get:vi.fn(),publish:vi.fn(),list:vi.fn(),initial:undefined as any,higher:undefined as any,late:undefined as any,accepted:[] as unknown[]}));
vi.mock('../api',()=>({recommendationApi:mocks}));
vi.mock('../components/ArticleLanguages',()=>({default:({title,body,onChanged,onPending}:any)=><div><input aria-label="Parent source title" value={title} readOnly/><textarea aria-label="Parent source body" value={body} readOnly/><button onClick={()=>{mocks.accepted.push(onChanged(mocks.higher));mocks.accepted.push(onChanged(mocks.late));}}>Resolve higher then late in one batch</button><button onClick={()=>onPending(true)}>Mark article dirty</button></div>}));
vi.mock('../components/RecommendationList',()=>({default:()=>null}));vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));vi.mock('../components/RecommendationFromProduct',()=>({default:()=>null}));vi.mock('../components/RecommendationLocalization',()=>({default:()=>null}));vi.mock('../components/RecommendationGallery',()=>({default:()=>null}));vi.mock('../components/RecommendationClassification',()=>({default:()=>null}));vi.mock('../components/RecommendationServiceEditor',()=>({default:()=>null}));
vi.mock('./PublicRecommendations',()=>({RecommendationPreview:()=>null}));
const make=(version:number,hash:string):RecommendationDetail=>({post:{id:1,title:'Source title '+version,published:true,version,updatedAt:''},body:'Source body '+version,items:[],articleSourceHash:hash.repeat(64),articleSourceLocale:'ja-JP',articleTranslations:{}});
const actor={id:1000,username:'synthetic',name:'Synthetic',roles:['AGENT' as const]};
function view(){return render(<I18nProvider><MemoryRouter initialEntries={['/admin/recommendations?post=1']}><Recommendations/></MemoryRouter></I18nProvider>);}
beforeEach(()=>{vi.clearAllMocks();mocks.accepted=[];localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');storeAuthSession({accessToken:'synthetic-token-1',user:actor});mocks.initial=make(4,'a');mocks.higher=make(6,'c');mocks.late=make(5,'b');mocks.get.mockResolvedValue(mocks.initial);mocks.list.mockResolvedValue([]);});
it('same-post late lower version cannot downgrade parent detail, title or body in one batched closure',async()=>{
 view();await screen.findByDisplayValue('Source body 4');fireEvent.click(screen.getByRole('button',{name:'Resolve higher then late in one batch'}));expect(screen.getByLabelText('Parent source title')).toHaveValue('Source title 6');expect(screen.getByLabelText('Parent source body')).toHaveValue('Source body 6');expect(mocks.accepted).toEqual([true,false]);
});
it('same version with an old hash or inconsistent source body cannot overwrite accepted parent state',async()=>{
 mocks.late={...mocks.higher,articleSourceHash:'b'.repeat(64),body:'Wrong old body'};view();await screen.findByDisplayValue('Source body 4');fireEvent.click(screen.getByRole('button',{name:'Resolve higher then late in one batch'}));expect(screen.getByLabelText('Parent source body')).toHaveValue('Source body 6');expect(mocks.accepted).toEqual([true,false]);
});
it('unsaved atomic article drafts block withdrawal and retain the existing leave confirmation/unload guard',async()=>{
 view();await screen.findByDisplayValue('Source body 4');fireEvent.click(screen.getByRole('button',{name:'Mark article dirty'}));expect(screen.getByRole('button',{name:/Withdraw/})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:/Withdraw/}));expect(mocks.publish).not.toHaveBeenCalled();const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);fireEvent.click(screen.getByRole('button',{name:'Back to List'}));expect(screen.getByLabelText('Parent source body')).toHaveValue('Source body 4');
});
it('keeps an unsaved four-language draft when same-window article navigation is cancelled and leaves new-tab links independent',async()=>{
 const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);const v=view();await screen.findByDisplayValue('Source body 4');fireEvent.click(screen.getByRole('button',{name:'Mark article dirty'}));
 const links=Array.from(v.container.querySelectorAll<HTMLAnchorElement>('a[href="/recommendations/1"]')),same=links.find(link=>!link.target)!,newTab=links.find(link=>link.target==='_blank')!;
 expect(fireEvent.click(same)).toBe(false);expect(confirm).toHaveBeenCalledOnce();expect(screen.getByLabelText('Parent source body')).toHaveValue('Source body 4');fireEvent.click(newTab);expect(confirm).toHaveBeenCalledOnce();confirm.mockRestore();
});
it('same-actor token rotation rejects an initial old GET without leaving loading stuck',async()=>{
 let finish!:(v:RecommendationDetail)=>void;mocks.get.mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValueOnce(mocks.higher);view();await waitFor(()=>expect(mocks.get).toHaveBeenCalledOnce());await act(async()=>storeAuthSession({accessToken:'synthetic-token-2',user:actor}));await screen.findByDisplayValue('Source body 6');await act(async()=>finish(mocks.initial));expect(screen.getByLabelText('Parent source body')).toHaveValue('Source body 6');
});
it('switching actor hides prior private article data while the new principal request is rejected',async()=>{
 mocks.get.mockResolvedValueOnce(mocks.initial).mockRejectedValueOnce(Error('not allowed'));view();await screen.findByDisplayValue('Source body 4');await act(async()=>storeAuthSession({accessToken:'other-token',user:{...actor,id:2000}}));await screen.findByText('not allowed');expect(screen.queryByDisplayValue('Source body 4')).not.toBeInTheDocument();
});
