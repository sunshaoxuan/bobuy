import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {createBrowserRouter,createMemoryRouter,RouterProvider,Routes,Route} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {storeAuthSession} from '../authStorage';
import {I18nProvider} from '../i18n';
import Recommendations from './Recommendations';
import type {RecommendationDetail} from '../api';

const api=vi.hoisted(()=>({get:vi.fn(),list:vi.fn(),articleRevision:vi.fn(),publish:vi.fn(),articleHistory:vi.fn()}));
vi.mock('../api',()=>({recommendationApi:api}));
vi.mock('../components/RecommendationList',()=>({default:()=> <h2>Article list</h2>}));
vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));
vi.mock('../components/RecommendationFromProduct',()=>({default:()=>null}));
vi.mock('../components/RecommendationLocalization',()=>({default:()=>null}));
vi.mock('../components/RecommendationGallery',()=>({default:()=>null}));
vi.mock('../components/RecommendationClassification',()=>({default:()=>null}));
vi.mock('../components/RecommendationServiceEditor',()=>({default:()=>null}));
vi.mock('./PublicRecommendations',()=>({RecommendationPreview:()=>null}));

const locales=['ja-JP','zh-CN','zh-TW','en-US'];
const actor={id:1000,username:'synthetic-owner',name:'Synthetic',roles:['AGENT' as const]};
const detail=(id=1):RecommendationDetail=>({post:{id,title:'Server title '+id,published:true,version:125,updatedAt:''},
 body:'Server body '+id,items:[],articleSourceHash:'a'.repeat(64),articleSourceLocale:'ja-JP',
 articleTranslations:Object.fromEntries(locales.map(locale=>[locale,{title:`Server ${id} ${locale}`,body:`Server body ${id} ${locale}`,sourceHash:'a'.repeat(64),reviewedAt:'2026-11-09T12:00:00Z'}]))});
function Content(){return <Routes><Route path="/admin/recommendations" element={<Recommendations/>}/><Route path="*" element={<h2>Another page</h2>}/></Routes>;}
const routers:Array<{dispose:()=>void}>=[];
function mount(browser=false){
 const routes=[{path:'*',element:<Content/>}];
 const router=browser?createBrowserRouter(routes):createMemoryRouter(routes,{initialEntries:['/admin/recommendations','/admin/recommendations?post=1','/other'],initialIndex:1});
 routers.push(router);render(<I18nProvider><RouterProvider router={router}/></I18nProvider>);return router;
}
async function drafts(){
 for(const locale of locales){fireEvent.click(screen.getByRole('tab',{name:locale}));
  fireEvent.change(screen.getByRole('textbox',{name:'Title '+locale}),{target:{value:'Draft title '+locale}});
  fireEvent.change(screen.getByRole('textbox',{name:'Body '+locale}),{target:{value:'Draft body '+locale}});
 }
}
async function preserved(){
 for(const locale of locales){fireEvent.click(screen.getByRole('tab',{name:locale+' *'}));
  expect(screen.getByRole('textbox',{name:'Title '+locale})).toHaveValue('Draft title '+locale);
  expect(screen.getByRole('textbox',{name:'Body '+locale})).toHaveValue('Draft body '+locale);
 }
 expect(api.articleRevision).not.toHaveBeenCalled();expect(api.publish).not.toHaveBeenCalled();
}
async function stay(){await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Keep editing'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());}
beforeEach(async()=>{vi.clearAllMocks();
 // Node's Request requires a Node signal; jsdom replaces the global constructor.
 const {transferableAbortController}=await vi.importActual<{transferableAbortController:()=>AbortController}>('node:util');
 vi.stubGlobal('AbortController',class {constructor(){return transferableAbortController();}});
 localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');
 storeAuthSession({accessToken:'synthetic-token',user:actor});api.get.mockImplementation(async id=>detail(id));api.list.mockResolvedValue([]);api.articleHistory.mockResolvedValue([]);
 window.history.replaceState({idx:0,key:'baseline'},'','/admin/recommendations');
});
afterEach(()=>{routers.splice(0).forEach(router=>router.dispose());vi.unstubAllGlobals();});

it('Back to List Cancel keeps every locale and explicit discard alone permits a fresh reopen',async()=>{
 const router=mount();await screen.findByDisplayValue('Server 1 ja-JP');await drafts();
 fireEvent.click(screen.getByRole('button',{name:'Back to List'}));await stay();await preserved();
 fireEvent.click(screen.getByRole('button',{name:'Back to List'}));await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Discard and leave'}));
 await screen.findByRole('heading',{name:'Article list'});await act(async()=>{await router.navigate('/admin/recommendations?post=1');});
 await screen.findByDisplayValue('Server 1 ja-JP');expect(screen.queryByDisplayValue('Draft title ja-JP')).not.toBeInTheDocument();
 expect(api.articleRevision).not.toHaveBeenCalled();
});
it.each([-1,1])('blocks POP delta %i before the article unmounts and Cancel retains all drafts',async delta=>{
 const router=mount();await screen.findByDisplayValue('Server 1 ja-JP');await drafts();await act(async()=>{await router.navigate(delta);});
 await stay();expect(router.state.location.search).toBe('?post=1');await preserved();
});
it('protects same-window links and programmatic replace without double prompting',async()=>{
 const router=mount();await screen.findByDisplayValue('Server 1 ja-JP');await drafts();
 fireEvent.click(document.querySelector('a[href="/recommendations/1"]:not([target])')!);await stay();await preserved();
 await act(async()=>{await router.navigate('/other',{replace:true});});await stay();await preserved();expect(router.state.location.pathname).toBe('/admin/recommendations');
});
it('does not transfer unsaved drafts between posts after explicit discard',async()=>{
 const router=mount();await screen.findByDisplayValue('Server 1 ja-JP');await drafts();
 await act(async()=>{await router.navigate('/admin/recommendations?post=2');});await stay();await preserved();expect(api.get).not.toHaveBeenCalledWith(2);
 await act(async()=>{await router.navigate('/admin/recommendations?post=2');});await screen.findByRole('dialog');fireEvent.click(screen.getByRole('button',{name:'Discard and leave'}));
 await screen.findByDisplayValue('Server 2 ja-JP');expect(screen.queryByDisplayValue('Draft title ja-JP')).not.toBeInTheDocument();
});
it('does not show a prior principal draft or block the new identity after an account switch',async()=>{
 const router=mount();await screen.findByDisplayValue('Server 1 ja-JP');await drafts();api.get.mockRejectedValueOnce(Error('not allowed'));
 await act(async()=>storeAuthSession({accessToken:'other-token',user:{...actor,id:2000}}));await screen.findByText('not allowed');
 expect(screen.queryByDisplayValue('Draft title en-US')).not.toBeInTheDocument();await act(async()=>{await router.navigate('/other');});
 await screen.findByRole('heading',{name:'Another page'});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('native browser history Back is restored before Cancel and leaves four-language drafts mounted',async()=>{
 const router=mount(true);await screen.findByRole('heading',{name:'Article list'});await act(async()=>{await router.navigate('/admin/recommendations?post=1');});
 await screen.findByDisplayValue('Server 1 ja-JP');await drafts();await act(async()=>{window.history.back();});await screen.findByRole('dialog');
 await waitFor(()=>expect(window.location.search).toBe('?post=1'));await stay();await preserved();
 const close=new Event('beforeunload',{cancelable:true});window.dispatchEvent(close);expect(close.defaultPrevented).toBe(true);
});
it('clean history navigation proceeds without confirmation',async()=>{
 const router=mount();await screen.findByDisplayValue('Server 1 ja-JP');await act(async()=>{await router.navigate(-1);});
 await screen.findByRole('heading',{name:'Article list'});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
