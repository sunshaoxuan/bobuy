import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {I18nProvider,translate} from '../i18n';
import {serviceFixture} from '../serviceOffer.fixture';
import {storeAuthSession} from '../authStorage';
import Recommendations from './Recommendations';
const mocks=vi.hoisted(()=>({get:vi.fn(),list:vi.fn(),publishItem:vi.fn(),publish:vi.fn(),save:vi.fn()}));
vi.mock('../api',()=>({recommendationApi:mocks,storefrontApi:{products:vi.fn().mockResolvedValue([])}}));
vi.mock('../components/RecommendationList',()=>({default:()=>null}));
vi.mock('../components/RecommendationClassification',()=>({default:({detail}:any)=><div data-testid="classification-items">{detail.items.map((item:any)=>item.id).join(',')}</div>}));
vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));
vi.mock('../components/RecommendationFromProduct',()=>({default:()=>null}));
vi.mock('../components/RecommendationLocalization',()=>({default:()=>null}));
vi.mock('../components/RecommendationGallery',()=>({default:()=>null}));
vi.mock('../components/ReferenceQuoteHistory',()=>({default:()=>null}));
vi.mock('../components/RecommendationServiceEditor',()=>({default:()=>null}));
vi.mock('../components/ArticleLanguages',()=>({default:({title,body,disabled,onTitle,onBody}:any)=><><input aria-label="Title" value={title} disabled={disabled} onChange={e=>onTitle(e.target.value)}/><textarea aria-label="Body" value={body} disabled={disabled} onChange={e=>onBody(e.target.value)}/></>}));
const ready={id:801,name:'Ready Tea',itemNumber:'READY',productId:'product-ready',referencePrice:100,imageUrl:'/synthetic-ready.png',publicationState:'PENDING',publicationReviewHash:'a'.repeat(64),publicationProductVersion:2};
const missing={id:802,name:'Missing 1731065',itemNumber:'1731065',referencePrice:200,imageUrl:'/synthetic-gap.png',publicationState:'PENDING'};
const draft={post:{id:8,title:'Original issue',version:4,published:false,updatedAt:'2026-11-09'},body:'Saved article body',items:[ready,missing]};
const clone=<T,>(value:T):T=>structuredClone(value);
function published(value:any,itemId=801){return {...clone(value),post:{...value.post,published:true,version:value.post.version+1},items:value.items.map((item:any)=>item.id===itemId?{...item,publicationState:'PUBLISHED'}:{...item})};}
function RouteControl(){const navigate=useNavigate();return <button onClick={()=>navigate('/admin/recommendations?post=2')}>Other issue</button>;}
function show(postId=8){return render(<I18nProvider><MemoryRouter initialEntries={['/admin/recommendations?post='+postId]}><RouteControl/><Recommendations/></MemoryRouter></I18nProvider>);}
const card=(name:string)=>within(screen.getByRole('heading',{name}).closest('article')!);
function review(name='Ready Tea'){fireEvent.click(card(name).getByRole('checkbox',{name:/I checked this item/}));}
const publishButton=(name='Ready Tea')=>card(name).getByRole('button',{name:'Publish this item: '+name});
beforeEach(()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.resetAllMocks();mocks.get.mockResolvedValue(clone(draft));});

it('publishes a ready post8 item alone while 1731065 stays pending; synchronous double clicks send once',async()=>{
 let finish!:(value:any)=>void;mocks.publishItem.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 show();await screen.findByDisplayValue('Original issue');
 expect(screen.queryByRole('button',{name:new RegExp(translate('en-US','rec.publish')+'$')})).toBeNull();
 review();fireEvent.click(publishButton());fireEvent.click(publishButton());
 expect(mocks.publishItem).toHaveBeenCalledTimes(1);
 const [postId,itemId,input]=mocks.publishItem.mock.calls[0];expect([postId,itemId]).toEqual([8,801]);
 expect(input).toEqual({requestId:expect.stringMatching(/^[0-9a-f-]{36}$/),version:4,productVersion:2,sourceHash:'a'.repeat(64),reviewed:true});
 await act(async()=>finish(published(draft)));
 expect(card('Ready Tea').getByText('Published')).toBeInTheDocument();expect(card('Missing 1731065').getByText('Pending review')).toBeInTheDocument();
 expect(publishButton('Missing 1731065')).toBeDisabled();expect(card('Ready Tea').queryByRole('button',{name:/Edit item facts/})).toBeNull();
 expect(screen.getByTestId('classification-items')).toHaveTextContent('802');expect(mocks.publish).not.toHaveBeenCalled();
});

it('publishes the eighth post9 item while all seven previously public items remain displayed',async()=>{
 const seven=Array.from({length:7},(_,i)=>({...ready,id:901+i,name:'Existing '+(i+1),publicationState:'PUBLISHED'}));
 const eighth={...ready,id:908,name:'Eighth item'};const value={...draft,post:{...draft.post,id:9,published:true},items:[...seven,eighth]};
 mocks.get.mockResolvedValue(value);mocks.publishItem.mockResolvedValue(published(value,908));show(9);await screen.findByDisplayValue('Original issue');
 expect(screen.queryByRole('button',{name:new RegExp(translate('en-US','rec.withdraw')+'$')})).toBeNull();
 review('Eighth item');fireEvent.click(publishButton('Eighth item'));await waitFor(()=>expect(card('Eighth item').getByText('Published')).toBeInTheDocument());
 for(const item of seven)expect(card(item.name).getByText('Published')).toBeInTheDocument();
 expect(mocks.publish).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});

it('does not enable publication with absent or malformed review/version metadata',async()=>{
 mocks.get.mockResolvedValue({...draft,items:[missing,{...ready,id:803,name:'Bad hash',publicationReviewHash:'short'},{...ready,id:804,name:'Bad version',publicationProductVersion:-1}]});
 show();await screen.findByDisplayValue('Original issue');
 for(const name of ['Missing 1731065','Bad hash','Bad version']){review(name);expect(publishButton(name)).toBeDisabled();}
 expect(mocks.publishItem).not.toHaveBeenCalled();
});

it('retries an uncertain response with exactly the same request key and facts',async()=>{
 mocks.publishItem.mockRejectedValueOnce(new TypeError('Response lost')).mockResolvedValueOnce(published(draft));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 const retry=await screen.findByRole('button',{name:'Retry this publication: Ready Tea'});fireEvent.click(retry);
 await waitFor(()=>expect(mocks.publishItem).toHaveBeenCalledTimes(2));expect(mocks.publishItem.mock.calls[1]).toEqual(mocks.publishItem.mock.calls[0]);
 await waitFor(()=>expect(card('Ready Tea').getByText('Published')).toBeInTheDocument());
});

it('keeps an article draft through conflict/reload and requires a fresh review and new attempt',async()=>{
 mocks.publishItem.mockRejectedValueOnce(Object.assign(new Error('Changed'),{status:409}));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 await screen.findAllByText(/The issue or product changed/);expect(publishButton()).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Kept local draft'}});
 const fresh={...clone(draft),post:{...draft.post,version:7},items:[{...ready,publicationReviewHash:'b'.repeat(64)},missing]};mocks.get.mockResolvedValueOnce(fresh);
 fireEvent.click(screen.getByRole('button',{name:/Reload$/}));await waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(2));
 expect(screen.getByDisplayValue('Kept local draft')).toBeInTheDocument();expect(mocks.publishItem).toHaveBeenCalledTimes(1);
 const saved={...fresh,post:{...fresh.post,title:'Kept local draft',version:8}};mocks.save.mockResolvedValue(saved);
 fireEvent.click(screen.getByRole('button',{name:/Save Draft$/}));await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(8,'Kept local draft','Saved article body',7));
 await waitFor(()=>expect(publishButton()).toBeDisabled());mocks.publishItem.mockResolvedValue(published(saved));review();fireEvent.click(publishButton());
 await waitFor(()=>expect(mocks.publishItem).toHaveBeenCalledTimes(2));
 expect(mocks.publishItem.mock.calls[1][2]).toMatchObject({version:8,sourceHash:'b'.repeat(64),reviewed:true});expect(mocks.publishItem.mock.calls[1][2].requestId).not.toBe(mocks.publishItem.mock.calls[0][2].requestId);
});

it('ignores a late publish response after navigating to another issue',async()=>{
 let finish!:(value:any)=>void;mocks.publishItem.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 mocks.get.mockResolvedValue({...clone(draft),post:{...draft.post,id:2,title:'Other current issue'}});fireEvent.click(screen.getByRole('button',{name:'Other issue'}));
 await screen.findByDisplayValue('Other current issue');await act(async()=>finish(published(draft)));
 expect(screen.getByDisplayValue('Other current issue')).toBeInTheDocument();expect(screen.queryByText('This item is published. Other pending items remain private.')).toBeNull();
});

it('discards a late response after an account/token change and does not reveal the previous issue',async()=>{
 storeAuthSession({accessToken:'synthetic-a',user:{id:100,username:'a',name:'A',roles:['AGENT']}});
 let finish!:(value:any)=>void;mocks.publishItem.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());mocks.get.mockRejectedValue(new Error('No access to this issue'));
 act(()=>storeAuthSession({accessToken:'synthetic-b',user:{id:200,username:'b',name:'B',roles:['AGENT']}}));
 await screen.findByText('No access to this issue');await act(async()=>finish(published(draft)));
 expect(screen.queryByDisplayValue('Original issue')).toBeNull();expect(screen.queryByText('This item is published. Other pending items remain private.')).toBeNull();
});

it('keeps the existing whole-article publication path for service offers',async()=>{
 const value={...clone(draft),items:[],serviceOffer:serviceFixture()};mocks.get.mockResolvedValue(value);mocks.publish.mockResolvedValue({...value,post:{...value.post,published:true,version:5}});
 show();await screen.findByText('Saved article body');fireEvent.click(screen.getByRole('button',{name:new RegExp(translate('en-US','rec.publish')+'$')}));
 await waitFor(()=>expect(mocks.publish).toHaveBeenCalledWith(8,4,true));expect(mocks.publishItem).not.toHaveBeenCalled();expect(await screen.findByRole('button',{name:new RegExp(translate('en-US','rec.withdraw')+'$')})).toBeInTheDocument();
});

it.each([{name:'an unpublished issue',postPublished:false,version:5},{name:'an older response',postPublished:true,version:3}])('does not declare success for $name even when its item flag says public',async({postPublished,version})=>{
 const contradictory=published(draft);contradictory.post.published=postPublished;contradictory.post.version=version;mocks.publishItem.mockResolvedValue(contradictory);
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());await screen.findByRole('button',{name:'Retry this publication: Ready Tea'});
 expect(card('Ready Tea').getByText('Pending review')).toBeInTheDocument();expect(screen.queryByText('This item is published. Other pending items remain private.')).toBeNull();expect(mocks.publishItem).toHaveBeenCalledTimes(1);
});
